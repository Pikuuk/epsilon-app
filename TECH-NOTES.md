# Technical notes (for a developer or Claude Code)

Stack: Node.js built-in `http`, zero npm dependencies. Data in `data/store.json` (atomic writes). Sessions in memory. Passwords: scrypt. See `server.js` header for the security model.

## What is done
- Auth (login, one-time codes, force password reset, scrypt hashing, session cookies HttpOnly/SameSite=Strict).
- Roles: super, teacher, student, parent. Server-side authorization on every read (`viewFor`) and write (`adminAction`, `/api/student/save`).
- Public `/api/request-access`. Approval creates the account + member and returns a one-time login code.
- Consent gate: `/api/student/save` refuses with `consent_required` until a consent record exists.
- Safeguarding: student saves can attach `newFlags`; stored in `db.safeguard` for staff; never diagnosed.
- Switchboard: `db.flags` (e.g. `registration_open`) toggled by super via `set_flag`.
- Audit log of logins and changes to child data.
- Static serving with a strict same-origin CSP. Nightly backup script. systemd + cron via `scripts/install.sh`.
- Tested with a local end-to-end script (18 checks): auth, role isolation, consent gate, safeguarding, switchboard, static/CSP.

## What still needs wiring (the learning screens)
The prototype (`epsilon-access-prototype.html`) contains the full, tested logic for: Discovery assessment (Nova/Orion/Vega/Lyra), Knowledge Baseline (Rigel) + Match Engine, Study Plan Engine, Practice Runner + marking, Practice Levels, Attendance Watch, Progress Analyst, Question bank with gates. To bring these to the live server:

1. **Extract the pure logic** from the prototype's IIFE (functions like `instantiate`, `verifyItem`, `markAnswer`, `markLadder`, `analyse`, `suggest`, `progress`, `makeSet`, the `LADDERS`/items data) into a shared `logic.js` used by both client and server.
2. **Content**: import the approved question bank via `import_items` (super only). Source data: `docs/year7-maths-bank.json` (41 questions) and the levelled templates from the prototype.
3. **Student data**: the student app should GET `/api/state` (returns the student's own `member`), render the prototype's student experience against `member.ans/done/attempts/lad/base`, and POST changes to `/api/student/save` (already validates role + consent + records safeguarding flags). Do the same reads server-side for anything that must be trusted (final marking, gating).
4. **New endpoints to add** (mirror the prototype, all role-checked): plan publish/read, marking-queue confirm, attendance check (server clock/cron), progress read with the super-controlled teacher sharing flags.
5. **Teachers**: add a super-only `add_user` action to create teacher accounts (role `teacher`, one-time code), same pattern as approval. Left out of the pilot to keep the surface small; add when needed.
6. **Independent components (the owner's goal)**: `adminAction` is already a switch by action type and `db` is sectioned per concern. To split into separate containers later, lift each section (identity, content, learning, attendance, safeguarding, notifications) behind its own module/service with the same authorization checks and a shared auth token; keep `db.flags` as per-component kill switches.

## Security must-dos before real children
- Complete `public/privacy.html`, run a DPIA, record parental consent (gate is enforced).
- Put behind https (DEPLOY.md step 5). Consider Cyber Essentials, a pen test, and rate-limiting on `/api/login` (add a simple per-IP counter).
- Confirm UK/EU data residency of the VPS.
- Do not add any third-party script/analytics to the pages (the CSP blocks them by design).
