# Pediatric Sedation Safety — course system

A second course running on the **same Firebase project** as PALS, with fully
**isolated data**. Built by reusing the PALS pages + shared JS.

## Isolation conventions (every page in this folder)
A shim runs first, before any other script:
```html
<script>window.COURSE_NS='peds_';window.COURSE_BASE='/peds_sedation/'; /* + localStorage prefixer */</script>
```
- **Firestore**: all collections are prefixed `peds_` (`peds_users`, `peds_students`,
  `peds_allowlist`, `peds_attendance`, `peds_attendanceCode`, `peds_courseFlags`,
  `peds_coursePlan`, `peds_courseStats`, `peds_teachingPlan`, `peds_meta`).
  - Shared `../firebase-sync.js` / `../auth.js` read `window.COURSE_NS` automatically.
  - Pages with **inline** Firestore (hub_instructor, dashboard, index, register)
    have their collection literals wrapped as `(window.COURSE_NS||'')+'name'`.
- **localStorage/sessionStorage**: transparently prefixed `peds_` by the shim, so
  caches never collide with PALS on the same origin.
- **Auth**: Firebase Auth is project-wide (shared logins); a person's *role* is
  read from `peds_users`, so they can be staff here and a student in PALS.
- **Redirects**: `window.COURSE_BASE` keeps login/role routing inside this folder.

## Shared vs local files
- Shared (one copy, at repo root): `firebase-config.js`, `firebase-sync.js`, `auth.js`.
- Local to this folder: the HTML pages + `modules.js` (course content).

## Status
- ✅ System structure: sign-in, registration, instructor hub (roster, cohorts,
  enrollment, attendance, WhatsApp/SMS), student portal shell, dashboard, planner.
- ⏳ Educational content deferred: `modules.js` is empty, the planner schedule is
  blank, and the Forms/Exam portal is a placeholder.

## Firestore rules
The `peds_*` rules are in the repo-root `firestore.rules` (with `peds_`-aware role
helpers). Deploy them before using this course.

## First-time setup (one-time)
1. **Deploy** the `peds_*` rules from `firestore.rules` (Firebase console → Firestore
   → Rules → Publish, or `firebase deploy --only firestore:rules`).
2. **Create the first admin** (accounts are admin-provisioned; there is no in-app
   bootstrap): sign up a Firebase Auth account for yourself, then in the Firebase
   console create `peds_users/<your-uid>` with at least:
   `{ email, name, role: "admin", cohort: "Unassigned" }`.
3. Sign in at `/peds_sedation/` → Instructor Hub → create/invite people, build
   cohorts, set schedule & start dates, run attendance, send WhatsApp/SMS — all
   isolated to the `peds_` data.
