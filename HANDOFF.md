# PALS 2025 — AI Handoff Note
_Last updated: 2026-06-18 23:10 IDT_

---

## What was done last session (June 18, 2026)

- Session was exploratory / review only. No feature commits were made.
- Files read in full: `slides/pals_module_03_respiratory.slides.html`, `slides/pals_module_09_airway_pharm.slides.html`, `pals_forms_portal.html`.
- `AGENT_PROMPT.md` committed to repo root for persistent handoff continuity.

---

## Repo state

**Repo:** `mavreg7/PALS_course` · branch: `main` · auto-deploys to Vercel on push.

All 11 slide decks exist and appear complete. Forms portal is fully functional. Firebase sync layer is in place.

---

## Outstanding items (must-do before course goes live)

1. **Firestore rules NOT deployed** — `firestore.rules` is correct in the repo but has NOT been pushed to Firebase. Nitai must run:
   ```
   firebase deploy --only firestore:rules
   ```
   Until this is done: bulk enroll writes, self-registration, pretest/exam score saves, and cohort stats will fail with permission errors.

2. **Admin bootstrap** — First admin user requires manual Firestore Console set:
   `users/{uid}.role = 'admin'`

---

## Pending tasks (awaiting Nitai's direction)

- [ ] Audit modules 01–02, 04–08 for completeness / content accuracy
- [ ] Add per-slide knowledge-check quizzes inside slide decks
- [ ] Add cross-module "see also" links between related decks
- [ ] Update content per any AHA 2025 errata
- [ ] Hub UX improvements (progress bar, announcement display)
- [ ] Instructor dashboard enhancements (export, cohort filter)
- [ ] Any bugs Nitai has found in testing

---

## How to start a new session

1. Read `AGENT_PROMPT.md` from this repo fully — it is the authoritative system prompt.
2. Read this file (`HANDOFF.md`) for latest session state.
3. Ask Nitai: "What do you want to work on?"
4. Bias toward action. Terse responses. He reads diffs, not summaries.
5. All pushes go to `main`. Always include `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` in commits.
6. Update this file at the end of every session.
