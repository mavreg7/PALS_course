// netlify/functions/set-user-password.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Admin-only endpoint to set another user's Firebase Auth password directly.
//
// The Firebase client SDK cannot change another user's password — that needs the
// Admin SDK, which must run on a trusted backend. This function:
//   1. Verifies the caller's Firebase ID token.
//   2. Confirms the caller's Firestore role is 'admin'.
//   3. Calls admin.auth().updateUser(targetUid, { password }).
//
// Required Netlify environment variable:
//   FIREBASE_SERVICE_ACCOUNT — the full service-account JSON (as a single
//   string) for the pals-course Firebase project. Generate one in the Firebase
//   console: Project settings → Service accounts → Generate new private key.
// ─────────────────────────────────────────────────────────────────────────────
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function ensureInit() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Server not configured: FIREBASE_SERVICE_ACCOUNT is not set.');
  let sa;
  try { sa = JSON.parse(raw); }
  catch (e) { throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.'); }
  initializeApp({ credential: cert(sa) });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await req.json(); }
  catch (e) { return json({ error: 'Invalid JSON body' }, 400); }

  const { idToken, targetUid, newPassword } = body || {};
  if (!idToken || !targetUid || !newPassword) {
    return json({ error: 'Missing idToken, targetUid or newPassword' }, 400);
  }
  if (String(newPassword).length < 6) {
    return json({ error: 'Password must be at least 6 characters.' }, 400);
  }

  try {
    ensureInit();

    // 1) Who is calling?
    let decoded;
    try { decoded = await getAuth().verifyIdToken(idToken); }
    catch (e) { return json({ error: 'Invalid or expired sign-in. Please reload and try again.' }, 401); }

    // 2) Is the caller an admin? (role lives in Firestore users/{uid})
    const callerSnap = await getFirestore().doc(`users/${decoded.uid}`).get();
    const callerRole = callerSnap.exists ? callerSnap.get('role') : null;
    if (callerRole !== 'admin') {
      return json({ error: 'Only an admin can set passwords.' }, 403);
    }

    // 3) Set the target user's password.
    try {
      await getAuth().updateUser(targetUid, { password: String(newPassword) });
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        return json({ error: 'No Firebase account for this user yet (they may not have registered).' }, 404);
      }
      throw e;
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message || String(e) }, 500);
  }
};
