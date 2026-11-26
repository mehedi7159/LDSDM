# LDSDM README (2026-11-25)

# LDSDM — Laskarcala Darus Sunnah Dakhil Madrasa Management System

A web app for running a dakhil madrasa: students, teachers, attendance,
exams and results, fees, notices, routines, and a public result portal.

- **Live site:** https://ldsdma.vercel.app
- **Code:** https://github.com/mehedi7159/LDSDM (branch `main` is the only ledger)
- **Firebase project:** `ldsdmms` (own project since 2026-11-20; the old
  AI Studio project stays as a frozen backup and is not used)

## What it does

- Students and teachers: add, edit, trash-first delete, ID cards
- Attendance: class-wise register and reports (Friday is not a working day)
- Exams and results: marks entry, merit lists, marksheets, public result
  search by student ID (no login needed, by design)
- Fees: monthly dues only after a month ends; exam fee is separate and
  never enters monthly dues; fees are collected in cash
- Guardians: login with student ID + 4-digit PIN (no email needed)
- Roles: principal, super admin, teacher, guardian
- Backup: cloud snapshots, local vault, JSON export / restore
- Design: Anek Bangla, one flat teal accent, Bangla-first UI

## Tech

- React 19 + Vite 6 + TypeScript
- Firebase: Authentication (email/password + Google) and Firestore
- Vercel hosting; PWA (offline cache, update prompt)
- Server API under `server/` and `api/` (`/api/admin` — needs a service
  account, see below)

## Setup (new machine)

```bash
git clone https://github.com/mehedi7159/LDSDM.git
cd LDSDM
npm install
npm run dev        # local site, usually http://localhost:5173
```

Other commands (from `package.json`):

```bash
npm run build      # production build (vite build)
npm run preview    # serve the production build locally
npm run lint       # tsc type-check (npx tsc --noEmit)
```

## Firebase setup

- Client config lives in `firebase-applet-config.json` (project `ldsdmms`).
  Never paste its keys into chat or screenshots.
- Firestore rules live in `firestore.rules`. Publishing rules needs the
  principal's separate approval — never publish casually.
- The server API (`/api/admin`) needs the service-account key as the
  `FIREBASE_SERVICE_ACCOUNT` environment variable in Vercel (project
  `ldsdma`). Without it, admin endpoints answer that the service account
  is missing. The key file itself is never committed and never shared
  in chat.

## How to check a change (before any push)

This project has no `npm test` suite. Verification is:

1. `npx tsc --noEmit` and `npm run build` — both must be clean.
2. The matching `scripts/verify-*.ts` check for the job (for example
   `scripts/verify-fee-totals.ts` for a fee change).
3. Live check on the deployed site after merge, then a phone check by
   the principal. A fix counts as done only when it works live, not
   just in code.

## Project rules (short version — full rules in `AGENTS.md`)

- GitHub `main` is the single ledger. Pull first, push last. On a
  conflict, keep GitHub.
- Data is never lost: deletes are trash-first, writes wait for cloud
  confirmation before showing success, and a sync must never shrink a list.
- The public portal and the result/marksheet files stay byte-for-byte
  unchanged, except for a filter-only change the principal has approved.
- Auth, login and permissions change only on the principal's explicit decision.
- Firestore rules are never published without the principal's separate approval.
- The principal's decisions register is the PRD for this system: it holds
  every rule above, the fee and exam decisions, and what is still pending.
  Read it before changing behaviour, not just code.
- Work is page by page, role by role, in small verified steps. One push
  is one job (small related fixes may be batched 3–5 per push, big ones
  stay single). Pushes go in the daily 06:00 window, or at once when the
  principal is watching.

## Still missing / known gaps (honest list)

- No payment gateway — fees are cash-only for now.
- No AI assistant inside the app yet (planned).
- `context/AppContext.tsx` is very large (8,766 lines as of 25 Nov 2026) and still to be split.
- No unit/E2E test suite — verification is the per-push verify scripts
  plus the daily morning live audit.
