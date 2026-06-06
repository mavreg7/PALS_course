// firebase-config.js
// ─────────────────────────────────────────────────────────────
// PALS 2025 — Firebase Project Configuration
//
// HOW TO SET UP:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (or open an existing one)
// 3. Click the </> web icon to register a web app
// 4. Copy the firebaseConfig object values into the fields below
// 5. In Firebase console → Firestore Database → Create database
//    (choose production mode, pick your region)
// 6. In Firebase console → Authentication → Sign-in method
//    → Enable "Anonymous" sign-in
// 7. In Firestore → Rules, paste:
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /students/{sid} {
//          allow read, write: if request.auth != null;
//        }
//      }
//    }
// ─────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey:            "REPLACE_WITH_YOUR_API_KEY",
  authDomain:        "REPLACE_WITH_YOUR_AUTH_DOMAIN",
  projectId:         "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket:     "REPLACE_WITH_YOUR_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId:             "REPLACE_WITH_YOUR_APP_ID"
};
