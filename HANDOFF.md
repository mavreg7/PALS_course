# PALS 2025 — AI Handoff Note
_Last updated: 2026-06-18 (later session) IDT_

---

## What was done last session (June 18, 2026 — exam/feedback flow rework)

Branch: `claude/gifted-fermi-gfv6c1` (draft PR into `main`). Firestore rules
were confirmed already deployed and the first admin already bootstrapped.

**Exam / feedback / enrollment flow rework (5 requested fixes):**

1. **Pre-test now gated** — locked until all 9 modules are complete, then
   auto-unlocks (was "always open"). Hub card + forms-portal panel both gated.
   (`hub_student.html`, `pals_forms_portal.html`)
2. **De-duplicated module 9** — removed the shock fluid-bolus row from the
   Module 9 pharmacology table (it belongs to Module 4) and replaced it with
   Ketamine (RSI induction), which fits an airway/pharm deck. Audit found the
   other M3/M4/M9 overlaps (epi dose, BVM, IO) are context-appropriate.
   (`slides/pals_module_09_airway_pharm.slides.html`)
3. **Registration hardened** — invite-gated as before, but the registrant now
   enters/confirms their full name (so admin-by-email-only invites still get a
   real profile name; first/last split stored). (`register.html`)
4. **Final exam is now invisible + admin-gated** — the exam tab/card is hidden
   from students entirely until an admin/instructor unlocks it (global flag or
   per-student `examUnlocked`). Removed the old "auto-unlock at 9 modules".
   Instructor unlock UI already existed in `hub_instructor.html`.
5. **Feedback gates the exam** — feedback moved into the student-facing portal
   (one record per student in `students/{uid}.feedback`). Must be submitted
   before the exam can be taken; editable until the exam is unlocked, then
   frozen. Edge case handled: if exam is unlocked before feedback exists, the
   student may still submit once (no deadlock).

**Supporting changes:**
- `firebase-sync.js`: added `FB.saveFeedback()`; `loadAndSync()` now returns
  `feedback` and `examUnlocked`.
- `hub_instructor.html`: roster shows a feedback-submitted chip; CSV export
  now includes pre-test %, final %, feedback, and exam-access columns.
- No `firestore.rules` change required (feedback uses existing students
  self-write). **No new `firebase deploy` needed for this PR.**

---

## Batch 2 (same June 18 session — second round of fixes)

1. **Feedback: all fields mandatory; date auto-applied.** Every rating (1–5),
   both text fields and the name are required to submit; the manual date input
   was removed and the date is stamped automatically at submission. Student
   name is locked to their session. (`pals_forms_portal.html`)
2. **Certificate hidden from students.** Removed the Certificate tab from the
   student forms-portal view and the cert quick-card from the student hub —
   instructors issue certificates. (`pals_forms_portal.html`, `hub_student.html`)
3. **More 3/4 ↔ 9 dedup.** Module 4's IO slide (duplicated Module 9's IO
   landmark image + text) is now a shock-context IV-vs-IO decision slide that
   defers landmark/technique to Module 9; Module 3's BVM card now points to
   Module 9 for OPA/C-E technique. (`slides/pals_module_04_shock…`, `…module_03…`)
4. **Cohort isolation ("can't be mixed") — UI + rules ("Both").**
   - Hub roster: a cohort selector scopes roster, stats and CSV export to one
     cohort at a time (persisted); roster merge now carries real student fields
     (exam-unlock, feedback, scores). (`hub_instructor.html`)
   - `firestore.rules`: admins & lead instructors see all cohorts; a plain
     `instructor` can only read/write users + students in their **own** cohort
     (student cohort resolved from the user profile — no duplication). Plain-
     instructor roster load was adapted to cohort-scoped queries so it stays
     rules-compatible. **Deploy needed:** `firebase deploy --only firestore:rules`.
   - Note: the instructor *dashboard* still does unconstrained collection reads —
     fine for admin/lead (Nitai); a plain instructor would see it empty and
     should use the hub roster instead.

---

## Repo state

**Repo:** `mavreg7/PALS_course` · `main` auto-deploys to Vercel on push.
Firestore rules deployed; first admin bootstrapped.

All 11 slide decks complete. Forms portal functional. Firebase sync in place.
All changed JS passes `node --check`.

---

## Outstanding items (must-do before course goes live)

1. ✅ **Firestore rules deployed** (confirmed by Nitai).
2. ✅ **Admin bootstrapped** (confirmed by Nitai).
3. **Merge the draft PR** from `claude/gifted-fermi-gfv6c1` into `main` to ship
   the exam/feedback flow rework above.

---

## Pending tasks (from the broad "audit everything" ask — NOT yet done)

These were requested but deferred to keep this PR focused and high-quality;
each is a sizeable content effort spanning multiple decks:

- [ ] Audit modules 01–02, 04–08 for completeness / content accuracy
- [ ] Add per-slide knowledge-check quizzes inside slide decks (all 9 decks)
- [ ] Add cross-module "see also" links between related decks
- [ ] Update content per any AHA 2025 errata
- [x] Hub UX — feedback quick-card added; progress bar + announcements already present
- [x] Instructor dashboard / hub — feedback chip + richer CSV export added
- [ ] Any further bugs Nitai finds in testing

---

## How to start a new session

1. Read `AGENT_PROMPT.md` from this repo fully — it is the authoritative system prompt.
2. Read this file (`HANDOFF.md`) for latest session state.
3. Ask Nitai: "What do you want to work on?"
4. Bias toward action. Terse responses. He reads diffs, not summaries.
5. Pushes go to the session's feature branch → draft PR into `main`.
6. Update this file at the end of every session.
