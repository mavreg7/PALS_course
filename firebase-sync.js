// firebase-sync.js

// ── FB_READY promise — modules await this before calling window.FB ──────────
let _fbResolve;
window.FB_READY = new Promise(res => { _fbResolve = res; });

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

import { initializeApp }    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  doc, setDoc, getDoc,
  onSnapshot, collection, getDocs
}                            from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth }           from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// ── Init (reuses app already started by auth.js if present) ───
let _db, _auth;
function _ensureInit() {
  if (_db) return;
  if (window.PALS_AUTH && window.PALS_AUTH.db) {
    _db   = window.PALS_AUTH.db;
    _auth = window.PALS_AUTH.auth;
  } else {
    const app = initializeApp(FIREBASE_CONFIG);
    _db       = getFirestore(app);
    _auth     = getAuth(app);
  }
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
    _ensureInit();
    const uid = _uid(); if (!uid) return;
    await setDoc(doc(_db,'students',uid), { progress, updatedAt: Date.now() }, { merge:true });
  } catch(e) { console.warn('[PALS FB] saveProgress:', e.message); }
}

// ── STUDENT: Save course flags ───────────────────────────────
async function fbSaveFlags(flags) {
  try {
    _ensureInit();
    const uid = _uid(); if (!uid) return;
    await setDoc(doc(_db,'students',uid), { flags, flagsUpdatedAt: Date.now() }, { merge:true });
  } catch(e) { console.warn('[PALS FB] saveFlags:', e.message); }
}

// ── STUDENT: Load own record ─────────────────────────────────
async function fbLoadMyData() {
  try {
    _ensureInit();
    const uid = _uid(); if (!uid) return null;
    const snap = await getDoc(doc(_db,'students',uid));
    return snap.exists() ? snap.data() : null;
  } catch(e) { console.warn('[PALS FB] loadMyData:', e.message); return null; }
}

// ── STUDENT: Load + sync (returns merged object, no sessionStorage) ─
async function fbLoadAndSync() {
  try {
    const data = await fbLoadMyData();
    if (!data) return {};
    return { progress: data.progress || {}, flags: data.flags || {} };
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
async function fbSaveExamScore(examType, score, total) {
  try {
    _ensureInit();
    const uid = _uid(); if (!uid) return;
    const field = examType === 'final' ? 'finalExam' : 'preTest';
    await setDoc(doc(_db,'students',uid), {
      [field]: { score, total, pct: Math.round((score/total)*100), completedAt: Date.now() }
    }, { merge:true });
  } catch(e) { console.warn('[PALS FB] saveExamScore:', e.message); }
}

// ── STUDENT: Save certificate ────────────────────────────────
async function fbSaveCertificate(issued) {
  try {
    _ensureInit();
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
// key: 'preTestUnlocked' | 'finalExamUnlocked' | 'certUnlocked'
async function fbSetCourseFlag(key, value) {
  try {
    _ensureInit();
    await setDoc(doc(_db,'courseFlags','current'), { [key]: value }, { merge:true });
  } catch(e) { console.warn('[PALS FB] setCourseFlag:', e.message); }
}

// ── STUDENT: watch course flags ───────────────────────────────
function fbWatchCourseFlags(callback) {
  _ensureInit();
  return onSnapshot(doc(_db,'courseFlags','current'), snap => {
    callback(snap.exists() ? snap.data() : {});
  });
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

// ── Expose on window.FB ───────────────────────────────────────
// Resolve FB_READY
if (_fbResolve) _fbResolve(window.FB);
window.FB = {
  saveProgress:          fbSaveProgress,
  saveFlags:             fbSaveFlags,
  loadMyData:            fbLoadMyData,
  loadAndSync:           fbLoadAndSync,
  markModuleComplete:    fbMarkModuleComplete,
  saveExamScore:         fbSaveExamScore,
  saveCertificate:       fbSaveCertificate,
  watchCourseFlags:      fbWatchCourseFlags,
  getAllStudents:         fbGetAllStudents,
  getAllUsers:            fbGetAllUsers,
  loadStudent:           fbLoadStudent,
  pushFlagsToStudent:    fbPushFlagsToStudent,
  broadcastAnnouncement: fbBroadcastAnnouncement,
  setCourseFlag:         fbSetCourseFlag,
  watchAllStudents:      fbWatchAllStudents,
};
