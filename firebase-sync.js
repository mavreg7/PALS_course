// firebase-sync.js

// ── FB_READY promise — modules await this before calling window.FB ──────────
// firebase-config.js (a regular, non-deferred script) creates the promise
// synchronously so plain-<script> pages can await it before this module runs.
// Reuse it if present; otherwise create our own as a fallback.
let _fbResolve;
if (window.FB_READY && window.__FB_RESOLVE) {
  _fbResolve = window.__FB_RESOLVE;
} else {
  window.FB_READY = new Promise(res => { _fbResolve = res; });
}

// ───────────────────────────────────────────────
// PALS 2025 — Shared Firebase Sync Layer  (Phase 1 — UID-based)
//
// Loaded by: hub_student.html, hub_instructor.html,
//            pals_instructor_dashboard.html, all 12 slide modules
//
// REQUIRES: firebase-config.js + auth.js loaded BEFORE this file
// EXPOSES:  window.FB  (all async helpers)
//
// KEY CHANGE from v1: student identity is now auth.currentUser.uid
// (not a session name string). All Firestore paths use UID.
// ───────────────────────────────────────────────

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  doc, setDoc, getDoc,
  onSnapshot, collection, getDocs,
  query, where
}                            from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// ── Init (reuses any app already started by auth.js or the host page) ──
let _db, _auth;
function _ensureInit() {
  if (_db) return;
  if (window.PALS_AUTH && window.PALS_AUTH.db) {
    _db   = window.PALS_AUTH.db;
    _auth = window.PALS_AUTH.auth;
  } else {
    // Reuse the existing default app if the page already created one
    // (e.g. the hubs) — calling initializeApp twice throws "already exists".
    const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
    _db       = getFirestore(app);
    _auth     = getAuth(app);
  }
}

// ── Auth readiness — resolves once Firebase restores the session ─────
// (currentUser is null synchronously until persistence loads; without
//  waiting, deck progress writes silently no-op.)
let _authReady;
function _ensureAuthReady() {
  if (_authReady) return _authReady;
  _ensureInit();
  _authReady = new Promise(res => {
    const unsub = onAuthStateChanged(_auth, u => { unsub(); res(u); });
  });
  return _authReady;
}

// ── Get current UID ─────────────────────────────────────────
function _uid() {
  _ensureInit();
  const u = _auth.currentUser;
  if (!u) { console.warn('[PALS FB] No authenticated user'); return null; }
  return u.uid;
}

// ── STUDENT: Save module progress ───────────────────────────
async function fbSaveProgress(progress) {
  try {
    await _ensureAuthReady();
    const uid = _uid(); if (!uid) return;
    await setDoc(doc(_db,'students',uid), { progress, updatedAt: Date.now() }, { merge:true });
  } catch(e) { console.warn('[PALS FB] saveProgress:', e.message); }
}

// ── STUDENT: Save course flags ───────────────────────────────
async function fbSaveFlags(flags) {
  try {
    await _ensureAuthReady();
    const uid = _uid(); if (!uid) return;
    await setDoc(doc(_db,'students',uid), { flags, flagsUpdatedAt: Date.now() }, { merge:true });
  } catch(e) { console.warn('[PALS FB] saveFlags:', e.message); }
}

// ── STUDENT: Load own record ─────────────────────────────────
async function fbLoadMyData() {
  try {
    await _ensureAuthReady();
    const uid = _uid(); if (!uid) return null;
    const snap = await getDoc(doc(_db,'students',uid));
    return snap.exists() ? snap.data() : null;
  } catch(e) { console.warn('[PALS FB] loadMyData:', e.message); return null; }
}

// ── Load the signed-in user's own cohort (from users/{uid}) ─────────
// Used to route a student to their cohort's course plan.
async function fbLoadMyCohort() {
  try {
    await _ensureAuthReady();
    const uid = _uid(); if (!uid) return '';
    const snap = await getDoc(doc(_db,'users',uid));
    return snap.exists() ? (snap.data().cohort || '') : '';
  } catch(e) { console.warn('[PALS FB] loadMyCohort:', e.message); return ''; }
}

// ── STUDENT: Load + sync (returns merged object, no sessionStorage) ─
async function fbLoadAndSync() {
  try {
    const data = await fbLoadMyData();
    if (!data) return {};
    return {
      progress: data.progress || {},
      flags: data.flags || {},
      preTest: data.preTest || null,
      finalExam: data.finalExam || null,
      certificate: data.certificate || null,
      feedback: data.feedback || null,
      examUnlocked: !!data.examUnlocked,
    };
  } catch(e) { console.warn('[PALS FB] loadAndSync:', e.message); return {}; }
}

// ── STUDENT: Mark one module complete ─────────────────────────
async function fbMarkModuleComplete(moduleIndex) {
  try {
    const data  = await fbLoadMyData();
    const prog  = (data && data.progress) ? { ...data.progress } : {};
    prog[String(moduleIndex)] = true;
    await fbSaveProgress(prog);
    return prog;
  } catch(e) { console.warn('[PALS FB] markComplete:', e.message); return {}; }
}

// ── STUDENT: Save exam score ─────────────────────────────────
async function fbSaveExamScore(examType, score, total, details) {
  try {
    await _ensureAuthReady();
    const uid = _uid(); if (!uid) return;
    const field = examType === 'final' ? 'finalExam' : 'preTest';
    const rec = { score, total, pct: Math.round((score/total)*100), completedAt: Date.now() };
    // Record which questions were missed (final exam) so instructors can review.
    if (details && Array.isArray(details.mistakes)) rec.mistakes = details.mistakes;
    await setDoc(doc(_db,'students',uid), { [field]: rec }, { merge:true });
  } catch(e) { console.warn('[PALS FB] saveExamScore:', e.message); }
}

// ── STUDENT: Save course feedback ────────────────────────────
// Stored once per student on their own doc. Editable until the final
// exam is unlocked for them; the forms portal freezes it after that.
async function fbSaveFeedback(feedback) {
  try {
    await _ensureAuthReady();
    const uid = _uid(); if (!uid) return;
    await setDoc(doc(_db,'students',uid), {
      feedback: { ...feedback, submittedAt: Date.now() }
    }, { merge:true });
  } catch(e) { console.warn('[PALS FB] saveFeedback:', e.message); }
}

// ── STUDENT: Save certificate ────────────────────────────────
async function fbSaveCertificate(issued) {
  try {
    await _ensureAuthReady();
    const uid = _uid(); if (!uid) return;
    await setDoc(doc(_db,'students',uid), {
      certificate: { issued, issuedAt: issued ? Date.now() : null }
    }, { merge:true });
  } catch(e) { console.warn('[PALS FB] saveCertificate:', e.message); }
}

// ── INSTRUCTOR: get all students ─────────────────────────────
async function fbGetAllStudents() {
  try {
    _ensureInit();
    const snap = await getDocs(collection(_db, 'students'));
    const out  = [];
    snap.forEach(d => out.push({ uid: d.id, ...d.data() }));
    return out;
  } catch(e) { console.warn('[PALS FB] getAllStudents:', e.message); return []; }
}

// ── INSTRUCTOR: get all user profiles ────────────────────────
async function fbGetAllUsers() {
  try {
    _ensureInit();
    await _ensureAuthReady();
    const snap = await getDocs(collection(_db, 'users'));
    const out  = [];
    snap.forEach(d => out.push({ uid: d.id, ...d.data() }));
    return out;
  } catch(e) { console.warn('[PALS FB] getAllUsers:', e.message); return []; }
}

// ── INSTRUCTOR: load one student by UID ──────────────────────
async function fbLoadStudent(uid) {
  try {
    _ensureInit();
    const snap = await getDoc(doc(_db,'students',uid));
    return snap.exists() ? { uid, ...snap.data() } : null;
  } catch(e) { console.warn('[PALS FB] loadStudent:', e.message); return null; }
}

// ── INSTRUCTOR: push flags to one student ───────────────────
async function fbPushFlagsToStudent(uid, flags) {
  try {
    _ensureInit();
    await setDoc(doc(_db,'students',uid), { flags, flagsUpdatedAt: Date.now() }, { merge:true });
  } catch(e) { console.warn('[PALS FB] pushFlags:', e.message); }
}

// ── INSTRUCTOR: broadcast announcement ──────────────────────
async function fbBroadcastAnnouncement(msg, expiresInMs) {
  try {
    _ensureInit();
    const expires = Date.now() + (expiresInMs || 7200000);
    await setDoc(doc(_db,'courseFlags','current'), {
      _announcement: { msg, ts: Date.now(), expires }
    }, { merge:true });
  } catch(e) { console.warn('[PALS FB] broadcast:', e.message); }
}

// ── INSTRUCTOR: set global course flag ──────────────────────
// key: 'examUnlocked' (global Final-Exam gate) plus any future flags
async function fbSetCourseFlag(key, value) {
  try {
    _ensureInit();
    await setDoc(doc(_db,'courseFlags','current'), { [key]: value }, { merge:true });
  } catch(e) { console.warn('[PALS FB] setCourseFlag:', e.message); }
}

// ── INSTRUCTOR: publish the course plan (schedule + meta) ────
// Default plan lives at coursePlan/current (shared by all cohorts). A specific
// cohort can have its own plan at coursePlan/c_<cohortKey>; pass the cohortKey
// to target it. Pre-existing callers pass nothing → 'current' (unchanged).
function _planDocId(cohortKey) {
  return (cohortKey && cohortKey !== 'current') ? ('c_' + cohortKey) : 'current';
}
async function fbSaveCoursePlan(plan, cohortKey) {
  try {
    _ensureInit();
    // coursePlan writes require an authenticated staff user (isStaff()).
    // Firebase auth restores asynchronously AFTER FB_READY resolves, so without
    // this wait an early publish fires with request.auth==null → permission
    // denied → silently caught, and the plan never syncs.
    await _ensureAuthReady();
    await setDoc(doc(_db,'coursePlan',_planDocId(cohortKey)),
      { ...plan, updatedAt: Date.now() }, { merge:true });
  } catch(e) { console.warn('[PALS FB] saveCoursePlan:', e.message); }
}

// ── STUDENT: watch the published course plan ────────────────
function fbWatchCoursePlan(callback, cohortKey) {
  _ensureInit();
  // Reads require signedIn(); subscribe only once auth has restored, otherwise
  // the listener is immediately permission-denied and never recovers.
  let unsub = () => {};
  let cancelled = false;
  _ensureAuthReady().then(() => {
    if (cancelled) return;
    unsub = onSnapshot(doc(_db,'coursePlan',_planDocId(cohortKey)), snap => {
      callback(snap.exists() ? snap.data() : null);
    }, err => console.warn('[PALS FB] watchCoursePlan:', err.message));
  });
  return () => { cancelled = true; unsub(); };
}

// ══ DAILY ATTENDANCE CHECK-IN ════════════════════════════════
// A daily class code proves a student is physically present. The code lives in
// a staff-only doc (students can't read it); a code-free "window open" status
// is mirrored to courseFlags so students know when check-in is live. The
// student's check-in is accepted only if the submitted code matches the secret
// (enforced by Firestore rules), so it can't be done remotely or in advance.
function _daySlug(day){ return String(day||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''); }

// INSTRUCTOR: open the check-in window for a day with a code.
async function fbOpenAttendance(day, code, durationMs) {
  try {
    _ensureInit();
    const expiresAt = Date.now() + (durationMs || 45*60*1000);
    await setDoc(doc(_db,'attendanceCode','current'),
      { code:String(code), day, open:true, openedAt:Date.now(), expiresAt }, { merge:false });
    // Public, code-free status so students see the window is open.
    await setDoc(doc(_db,'courseFlags','current'),
      { attendance:{ open:true, day, expiresAt } }, { merge:true });
    return { day, code, expiresAt };
  } catch(e) { console.warn('[PALS FB] openAttendance:', e.message); return null; }
}

// INSTRUCTOR: close the check-in window.
async function fbCloseAttendance() {
  try {
    _ensureInit();
    await setDoc(doc(_db,'attendanceCode','current'), { open:false }, { merge:true });
    await setDoc(doc(_db,'courseFlags','current'), { attendance:{ open:false } }, { merge:true });
  } catch(e) { console.warn('[PALS FB] closeAttendance:', e.message); }
}

// INSTRUCTOR: live list of all check-ins.
function fbWatchAttendance(callback) {
  _ensureInit();
  return onSnapshot(collection(_db,'attendance'), snap => {
    const rows = []; snap.forEach(d => rows.push({ id:d.id, ...d.data() }));
    callback(rows);
  });
}

// STUDENT: submit a check-in. Resolves true on success, false otherwise.
// codeDoc identifies which attendance code doc to validate against ('current'
// by default, or 'c_<cohortKey>' when the student's cohort runs its own window).
async function fbCheckIn(day, code, name, codeDoc) {
  try {
    await _ensureAuthReady();
    const uid = _uid(); if (!uid) return false;
    const id = `${uid}_${_daySlug(day)}`;
    await setDoc(doc(_db,'attendance',id),
      { uid, day, code:String(code), codeDoc: codeDoc || 'current', name: name||'', checkedInAt: Date.now() }, { merge:false });
    return true;
  } catch(e) { console.warn('[PALS FB] checkIn:', e.message); return false; }
}

// STUDENT: live view of own check-ins (to show "already checked in today").
function fbWatchMyAttendance(callback) {
  _ensureInit();
  const uid = _uid();
  if (!uid) { _ensureAuthReady().then(()=>{ const u=_uid(); if(u) fbWatchMyAttendance(callback); }); return ()=>{}; }
  return onSnapshot(query(collection(_db,'attendance'), where('uid','==',uid)), snap => {
    const rows = []; snap.forEach(d => rows.push({ id:d.id, ...d.data() }));
    callback(rows);
  });
}

// ── STUDENT: watch course flags ───────────────────────────────
function fbWatchCourseFlags(callback) {
  _ensureInit();
  return onSnapshot(doc(_db,'courseFlags','current'), snap => {
    callback(snap.exists() ? snap.data() : {});
  });
}

// Watch a cohort's own flags (courseFlags/c_<key>) — used to override the
// course start date and attendance window per cohort. No-op without a cohort.
function fbWatchCohortFlags(cohortKey, callback) {
  _ensureInit();
  if (!cohortKey) { callback(null); return () => {}; }
  let unsub = () => {}, cancelled = false;
  _ensureAuthReady().then(() => {
    if (cancelled) return;
    unsub = onSnapshot(doc(_db,'courseFlags','c_'+cohortKey), snap => {
      callback(snap.exists() ? snap.data() : null);
    }, err => console.warn('[PALS FB] watchCohortFlags:', err.message));
  });
  return () => { cancelled = true; unsub(); };
}

// ── COHORT REGISTRY ────────────────────────────────────────────
// Names of cohorts that exist even before anyone is enrolled, so brand-new
// cohorts can be set up (plan, start date) in advance. Stored in
// courseFlags/_cohorts as { names: [...] }.
async function fbLoadCohortRegistry() {
  try { _ensureInit(); await _ensureAuthReady();
    const snap = await getDoc(doc(_db,'courseFlags','_cohorts'));
    return (snap.exists() && Array.isArray(snap.data().names)) ? snap.data().names : [];
  } catch(e) { console.warn('[PALS FB] loadCohortRegistry:', e.message); return []; }
}
async function fbAddCohort(name) {
  name = String(name||'').trim();
  const cur = await fbLoadCohortRegistry();
  if (!name) return cur;
  if (!cur.some(n => String(n).toLowerCase() === name.toLowerCase())) cur.push(name);
  try { await setDoc(doc(_db,'courseFlags','_cohorts'), { names: cur }, { merge:true }); }
  catch(e) { console.warn('[PALS FB] addCohort:', e.message); }
  return cur;
}

// ── INSTRUCTOR: real-time listener for all students ────────────
function fbWatchAllStudents(callback) {
  _ensureInit();
  return onSnapshot(collection(_db, 'students'), snap => {
    const students = [];
    snap.forEach(d => students.push({ uid: d.id, ...d.data() }));
    callback(students);
  });
}

// ── INSTRUCTOR: set per-student exam unlock ───────────────────
async function fbSetStudentExamUnlock(uid, unlocked) {
  try {
    _ensureInit();
    await setDoc(doc(_db,'students',uid), { examUnlocked: unlocked, examUnlockedAt: Date.now() }, { merge:true });
  } catch(e) { console.warn('[PALS FB] setStudentExamUnlock:', e.message); }
}

// ── Cohort key: stable slug for a cohort name, used to address per-cohort
// docs (coursePlan/c_<key>, etc.). Empty/Unassigned → '' (the default plan).
function fbCohortKey(name) {
  const n = String(name == null ? '' : name).trim();
  if (!n || n.toLowerCase() === 'unassigned' || n.toLowerCase() === 'all') return '';
  return n.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// ── Expose on window.FB ───────────────────────────────────────
window.FB = {
  saveProgress:          fbSaveProgress,
  saveFlags:             fbSaveFlags,
  loadMyData:            fbLoadMyData,
  loadAndSync:           fbLoadAndSync,
  markModuleComplete:    fbMarkModuleComplete,
  saveExamScore:         fbSaveExamScore,
  saveFeedback:          fbSaveFeedback,
  saveCertificate:       fbSaveCertificate,
  watchCourseFlags:      fbWatchCourseFlags,
  watchCohortFlags:      fbWatchCohortFlags,
  getAllStudents:         fbGetAllStudents,
  getAllUsers:            fbGetAllUsers,
  loadStudent:           fbLoadStudent,
  pushFlagsToStudent:    fbPushFlagsToStudent,
  broadcastAnnouncement: fbBroadcastAnnouncement,
  setCourseFlag:         fbSetCourseFlag,
  saveCoursePlan:        fbSaveCoursePlan,
  watchCoursePlan:       fbWatchCoursePlan,
  cohortKey:             fbCohortKey,
  loadMyCohort:          fbLoadMyCohort,
  loadCohortRegistry:    fbLoadCohortRegistry,
  addCohort:             fbAddCohort,
  openAttendance:        fbOpenAttendance,
  closeAttendance:       fbCloseAttendance,
  watchAttendance:       fbWatchAttendance,
  checkIn:               fbCheckIn,
  watchMyAttendance:     fbWatchMyAttendance,
  setStudentExamUnlock:  fbSetStudentExamUnlock,
  watchAllStudents:      fbWatchAllStudents,
};

// Resolve FB_READY now that window.FB is fully assigned
if (_fbResolve) _fbResolve(window.FB);
