// firebase-config.js
// ─────────────────────────────────────────────────────────────
// PALS 2025 — Firebase Project Configuration
// Project: pals-course
// ─────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDcxmm6wZPGcVUrVnqiNwnPEr8N_tzipss",
  authDomain:        "pals-course.firebaseapp.com",
  projectId:         "pals-course",
  storageBucket:     "pals-course.firebasestorage.app",
  messagingSenderId: "223195595338",
  appId:             "1:223195595338:web:1106d6243ed7b214915cb3",
  measurementId:     "G-Y2ZVZQ8C6N"
};

// ── FB_READY promise, created synchronously ──────────────────────────────────
// firebase-sync.js is a deferred ES module, so it runs AFTER regular inline
// scripts. Pages whose logic is a plain <script> (e.g. the course planner) call
// window.FB_READY.then(...) during parse — before the module exists. Defining
// the promise here (a regular script loaded first on every page) guarantees it
// is always available; firebase-sync.js resolves this same promise.
window.FB_READY = new Promise(res => { window.__FB_RESOLVE = res; });
