// firebase-sync.js
// ───────────────────────────────────────────────
// PALS 2025 — Shared Firebase Sync Layer
// Loaded by: hub_student.html, hub_instructor.html,
//            pals_instructor_dashboard.html, all 12 slide modules
//
// REQUIRES: firebase-config.js loaded BEFORE this file
// EXPOSES:  window.FB  (all async helpers)
// ───────────────────────────────────────────────

import { initializeApp }    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, doc, setDoc, getDoc,
  onSnapshot, collection, getDocs
}                            from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth, signInAnonymously }
                             from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// ── Init ───────────────────────────────────────
let _app, _db, _auth;
function _ensureInit() {
  if (_db) return;
  _app  = initializeApp(FIREBASE_CONFIG);
  _db   = getFirestore(_app);
  _auth = getAuth(_app);
}

// ── Anonymous auth ────────────────────────────
async function _ensureAuth() {
  _ensureInit();
  if (_auth.currentUser) return _auth.currentUser;
  const cred = await signInAnonymously(_auth);
  return cred.user;
}

// ── Student doc ID ─────────────────────────────
// Derived from session name: lowercase + spaces→underscores
function _studentId() {
  try {
    const s = JSON.parse(sessionStorage.getItem('pals_sess_v2') || 'null');
    if (s && s.name) return s.name.toLowerCase().replace(/\s+/g, '_');
  } catch(e) {}
  return null;
}

// ── Save progress ──────────────────────────────
// progress = { "0": true, "1": true, ... }
async function fbSaveProgress(progress) {
  try {
    await _ensureAuth();
    const sid = _studentId();
    if (!sid) return;
    await setDoc(doc(_db,'students',sid), { progress, updatedAt: Date.now() }, { merge:true });
  } catch(e) { console.warn('[PALS FB] saveProgress:', e.message); }
}

// ── Save flags ────────────────────────────────
async function fbSaveFlags(flags) {
  try {
    await _ensureAuth();
    const sid = _studentId();
    if (!sid) return;
    await setDoc(doc(_db,'students',sid), { flags, flagsUpdatedAt: Date.now() }, { merge:true });
  } catch(e) { console.warn('[PALS FB] saveFlags:', e.message); }
}

// ── Save student profile (called at login) ───────
async function fbSaveProfile(name, role) {
  try {
    await _ensureAuth();
    const sid = name.toLowerCase().replace(/\s+/g, '_');
    await setDoc(doc(_db,'students',sid), { name, role, lastLogin: Date.now() }, { merge:true });
  } catch(e) { console.warn('[PALS FB] saveProfile:', e.message); }
}

// ── Load one student ────────────────────────────
async function fbLoadStudent(sid) {
  try {
    await _ensureAuth();
    const snap = await getDoc(doc(_db,'students',sid));
    return snap.exists() ? snap.data() : null;
  } catch(e) { console.warn('[PALS FB] loadStudent:', e.message); return null; }
}

// ── Load Firebase data → merge into sessionStorage ─
async function fbLoadAndSync() {
  try {
    const sid = _studentId();
    if (!sid) return;
    const data = await fbLoadStudent(sid);
    if (!data) return;
    if (data.progress) {
      sessionStorage.setItem('pals_progress', JSON.stringify(data.progress));
    }
    if (data.flags) {
      let local = {};
      try { local = JSON.parse(sessionStorage.getItem('pals_flags') || '{}'); } catch(e) {}
      sessionStorage.setItem('pals_flags', JSON.stringify(Object.assign({}, local, data.flags)));
    }
  } catch(e) { console.warn('[PALS FB] loadAndSync:', e.message); }
}

// ── Mark one module complete + sync ──────────────
// moduleIndex: 0-based  (Module 01 → 0 … Module 12 → 11)
async function fbMarkModuleComplete(moduleIndex) {
  try {
    let prog = {};
    try { prog = JSON.parse(sessionStorage.getItem('pals_progress') || '{}'); } catch(e) {}
    prog[moduleIndex] = true;
    sessionStorage.setItem('pals_progress', JSON.stringify(prog));
    await fbSaveProgress(prog);
  } catch(e) { console.warn('[PALS FB] markComplete:', e.message); }
}

// ── INSTRUCTOR: get all students ─────────────────
async function fbGetAllStudents() {
  try {
    await _ensureAuth();
    const snap = await getDocs(collection(_db, 'students'));
    const out = [];
    snap.forEach(d => out.push({ id: d.id, ...d.data() }));
    return out;
  } catch(e) { console.warn('[PALS FB] getAllStudents:', e.message); return []; }
}

// ── INSTRUCTOR: push flags to one student ────────
async function fbPushFlagsToStudent(sid, flags) {
  try {
    await _ensureAuth();
    await setDoc(doc(_db,'students',sid), { flags, flagsUpdatedAt: Date.now() }, { merge:true });
  } catch(e) { console.warn('[PALS FB] pushFlags:', e.message); }
}

// ── INSTRUCTOR: broadcast announcement to all ───
async function fbBroadcastAnnouncement(msg) {
  try {
    await _ensureAuth();
    const students = await fbGetAllStudents();
    const ann = { msg, ts: Date.now() };
    await Promise.all(
      students.map(s => setDoc(doc(_db,'students',s.id), { flags: { _announcement: ann } }, { merge:true }))
    );
  } catch(e) { console.warn('[PALS FB] broadcast:', e.message); }
}

// ── INSTRUCTOR: real-time listener for all students ─
function fbWatchAllStudents(callback) {
  _ensureInit();
  _ensureAuth().then(() => {
    onSnapshot(collection(_db, 'students'), snap => {
      const students = [];
      snap.forEach(d => students.push({ id: d.id, ...d.data() }));
      callback(students);
    });
  });
}

// ── Expose everything on window.FB ────────────────
window.FB = {
  saveProgress:          fbSaveProgress,
  saveFlags:             fbSaveFlags,
  saveProfile:           fbSaveProfile,
  loadStudent:           fbLoadStudent,
  loadAndSync:           fbLoadAndSync,
  markModuleComplete:    fbMarkModuleComplete,
  getAllStudents:         fbGetAllStudents,
  pushFlagsToStudent:    fbPushFlagsToStudent,
  broadcastAnnouncement: fbBroadcastAnnouncement,
  watchAllStudents:      fbWatchAllStudents,
};
