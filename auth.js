// auth.js
// ─────────────────────────────────────────────────────────────
// PALS 2025 — Unified Auth & Identity Layer  (Phase 1)
//
// Loaded by: index.html, hub_student.html, hub_instructor.html,
//            pals_instructor_dashboard.html, pals_forms_portal.html,
//            all slide modules
//
// REQUIRES: firebase-config.js loaded BEFORE this file
// EXPOSES:  window.PALS_AUTH  (all auth helpers)
// ROLES:
//   admin         → full control (you only)
//   lead_instructor → all instructor tools, no role management
//   instructor    → forms, roster read, no admin controls
//   student       → own data only
// ─────────────────────────────────────────────────────────────

import { initializeApp }         from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
}                                 from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  doc, getDoc, setDoc, serverTimestamp
}                                 from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Init ───────────────────────────────────────────────────────
let _app, _auth, _db;
function _init() {
  if (_db) return;
  _app  = initializeApp(FIREBASE_CONFIG);
  _auth = getAuth(_app);
  _db   = getFirestore(_app);
}
_init();

// ── Get current user with role from Firestore ──────────────────
// Returns: { uid, email, role, displayName, canAdmin, isAdmin }
// or null if not signed in
async function getUser() {
  const u = _auth.currentUser;
  if (!u) return null;
  try {
    const snap = await getDoc(doc(_db, 'users', u.uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      uid:         u.uid,
      email:       u.email,
      displayName: d.displayName || d.name || u.displayName || '',
      role:        d.role || 'student',
      canAdmin:    d.canAdmin === true,
      isAdmin:     d.role === 'admin',
    };
  } catch(e) {
    console.warn('[PALS AUTH] getUser:', e.message);
    return null;
  }
}

// ── Sign in ────────────────────────────────────────────────────
// Returns: { ok: true, user } or { ok: false, error: string }
async function signIn(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(_auth, email, password);
    let u      = await getUser();
    if (!u) {
      // Self-heal an orphaned registration: the Firebase Auth account exists but
      // its users/{uid} profile was never created (a registration that
      // half-completed). Re-provision it from the invite (allowlist) entry so
      // the person can sign in and shows up on the roster.
      u = await repairMissingProfile(cred.user);
    }
    if (!u) return { ok: false, error: 'Account exists but profile not found. Ask your administrator to re-invite this email, then sign in again.' };
    // Write last login timestamp
    await setDoc(doc(_db, 'users', cred.user.uid), { lastLogin: serverTimestamp() }, { merge: true });
    return { ok: true, user: u };
  } catch(e) {
    const msg = {
      'auth/user-not-found':       'No account found with that email.',
      'auth/wrong-password':       'Incorrect password. Please try again.',
      'auth/invalid-email':        'Please enter a valid email address.',
      'auth/user-disabled':        'This account has been disabled. Contact your administrator.',
      'auth/too-many-requests':    'Too many attempts. Please wait a moment and try again.',
      'auth/invalid-credential':   'Incorrect email or password.',
    }[e.code] || 'Sign-in failed. Please try again.';
    return { ok: false, error: msg };
  }
}

// ── Recover a registered-in-Auth but profile-less account ──────────────────
// Rebuilds users/{uid} from the person's allowlist invite. Only works while the
// invite is still present and not yet marked registered (which is the case when
// the original registration failed before writing the profile), and the
// Firestore rules permit a self-create whose role matches the invite.
async function repairMissingProfile(authUser) {
  try {
    const email = (authUser.email || '').toLowerCase();
    if (!email) return null;
    const inv = await getDoc(doc(_db, 'allowlist', email));
    if (!inv.exists()) return null;
    const a = inv.data() || {};
    if (a.registered) return null;          // rules require registered==false to self-create
    const role = a.role || 'student';
    const parts = (a.name || '').split(/\s+/);
    await setDoc(doc(_db, 'users', authUser.uid), {
      uid:       authUser.uid,
      email,
      name:      a.name || ((a.firstName||'') + ' ' + (a.lastName||'')).trim() || email.split('@')[0],
      firstName: a.firstName || parts[0] || '',
      lastName:  a.lastName  || parts.slice(1).join(' ') || '',
      role,
      cohort:    a.cohort || 'Unassigned',
      createdAt: serverTimestamp(),
      viaInvite: true,
      progress:  {},
    });
    await setDoc(doc(_db, 'allowlist', email), { registered: true, registeredAt: serverTimestamp() }, { merge: true });
    return await getUser();
  } catch(e) {
    console.warn('[PALS AUTH] repairMissingProfile:', e.message);
    return null;
  }
}

// ── Sign out ───────────────────────────────────────────────────
async function logOut() {
  try { await signOut(_auth); } catch(e) {}
  window.location.href = '/index.html';
}

// ── Require auth guard ─────────────────────────────────────────
// Call at top of each protected page.
// allowedRoles: array like ['admin','lead_instructor','instructor']
// If not signed in or wrong role → redirects to index.html
async function requireAuth(allowedRoles) {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(_auth, async (firebaseUser) => {
      unsub();
      if (!firebaseUser) {
        window.location.href = '/index.html'; return;
      }
      const u = await getUser();
      if (!u) { window.location.href = '/index.html'; return; }
      if (allowedRoles && !allowedRoles.includes(u.role)) {
        // Wrong role: send to correct hub
        window.location.href = (u.role === 'student') ? '/hub_student.html' : '/hub_instructor.html';
        return;
      }
      resolve(u);
    });
  });
}

// ── Require admin guard ────────────────────────────────────────
// Redirects anyone who is not role === 'admin'
async function requireAdmin() {
  return requireAuth(['admin']);
}

// ── Create user profile (admin only — called from admin panel) ─
// role: 'admin' | 'lead_instructor' | 'instructor' | 'student'
async function createUserProfile(uid, email, displayName, role) {
  const caller = await getUser();
  if (!caller || caller.role !== 'admin') {
    throw new Error('Only the admin can create user profiles.');
  }
  await setDoc(doc(_db, 'users', uid), {
    email,
    displayName,
    role,
    canAdmin:   role === 'admin' || role === 'lead_instructor',
    createdAt:  serverTimestamp(),
    createdBy:  caller.uid,
    active:     true,
  });
}

// ── Bootstrap admin (one-time only) ───────────────────────────
// Creates the admin profile for the currently signed-in user
// ONLY if no admin document exists yet in Firestore.
async function bootstrapAdmin(displayName) {
  const u = _auth.currentUser;
  if (!u) throw new Error('You must be signed in to claim admin.');
  // Check if any admin already exists
  const snap = await getDoc(doc(_db, 'meta', 'admin_bootstrap'));
  if (snap.exists() && snap.data().done === true) {
    throw new Error('Admin already bootstrapped. This page is now disabled.');
  }
  // Write admin profile
  await setDoc(doc(_db, 'users', u.uid), {
    email:       u.email,
    displayName: displayName || u.displayName || u.email,
    role:        'admin',
    canAdmin:    true,
    createdAt:   serverTimestamp(),
    active:      true,
  });
  // Lock bootstrap so it can never be run again
  await setDoc(doc(_db, 'meta', 'admin_bootstrap'), { done: true, adminUid: u.uid, at: serverTimestamp() });
}

// ── Auth state listener ────────────────────────────────────────
function onAuthChange(callback) {
  onAuthStateChanged(_auth, async (firebaseUser) => {
    if (!firebaseUser) { callback(null); return; }
    const u = await getUser();
    callback(u);
  });
}

// ── Expose ────────────────────────────────────────────────────
window.PALS_AUTH = {
  signIn,
  logOut,
  getUser,
  requireAuth,
  requireAdmin,
  createUserProfile,
  bootstrapAdmin,
  onAuthChange,
  get currentFirebaseUser() { return _auth ? _auth.currentUser : null; },
  get db() { return _db; },
  get auth() { return _auth; },
};
