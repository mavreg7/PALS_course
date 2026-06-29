# PALS Course — Project Notes

## Stack

- Static HTML/JS/CSS — no build step
- Firebase Auth + Firestore (single project, dual namespace: `users`/`peds_users`)
- Deployed on Vercel and Netlify

## Namespacing

- PALS: `users` collection, session key `pals_sess_v2`
- Peds Sedation: `peds_users` collection, session key `peds_pals_sess_v2` (via `window.COURSE_NS = 'peds_'` shim)

## PR workflow

When CI (Vercel + Netlify previews) is green, merge the PR using squash merge.
