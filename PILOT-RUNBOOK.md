# Live pilot runbook (build 11)

A short, safe way to run the first live test once the server is deployed (see DEPLOY.md).

## Before the pilot — the non-negotiables
1. **Privacy notice** completed by a qualified person (draft: `public/privacy.html`) and linked on the site.
2. **DPIA** (data protection impact assessment) done for a children's platform.
3. **Parental consent** process agreed. The system already blocks a student from saving any work until you press "Record parental consent" for them.
4. **https** working (padlock), from DEPLOY.md step 5.
5. A named **Designated Safeguarding Lead** — the adult who acts on wellbeing flags. Set their name in `data/store.json` under `settings.dsl_name`, or leave the default and brief them.

Until these are done, test only with made-up accounts and no real child data.

## Pilot size
Start tiny: 3–5 students, 1 teacher (you can be the teacher), one subject (Year 7 Maths). Two weeks.

## One-time setup
1. Deploy (DEPLOY.md). Sign in as the owner and set your password.
2. Load the questions: on the VPS, in the `epsilon` folder, run
   `node scripts/import-content.js content/year7-maths-approved.json`
   and enter your owner email and password. This loads 104 approved Year 7 Maths items (41 questions + 63 levelled templates).
3. Add your teacher account in the Control Room (or act as teacher yourself).

## For each student
1. They (or their parent) go to `/request.html` and ask for access.
2. In the Control Room you approve them, choose Maths, and get a one-time login code to send them.
3. Record parental consent for them (button in the Control Room) once the parent has agreed.
4. The student signs in at `/login.html`, sets their password, then opens **Practice levels** from their home page.

## During the pilot — what to watch
- **Wellbeing flags**: check the Control Room daily. Any flag means follow your safeguarding process and involve the DSL. The system never judges — a human always does.
- **Progress**: students earn trophies and unlock levels as they pass. Their progress is saved on the server.
- **Backups**: run nightly automatically. Check `data/backups/` has recent files.
- **Feedback**: ask students and the teacher two questions each week — what helped, what was confusing.

## What to measure (simple, honest)
- Did students log in and complete levels? (engagement)
- Did the levels feel right — too easy, too hard? (from the teacher and students)
- Any wrong questions or unclear wording the teacher spots (feed back into the question bank review).
- Any technical problems (note them; see DEPLOY.md "If something goes wrong").

## After the pilot
- Review the feedback and fix the question bank via the teacher review pages.
- Decide whether to widen to more students or more subjects.
- If numbers will grow, move the data store from the single JSON file to Postgres (TECH-NOTES.md) and revisit security (rate limits, pen test, Cyber Essentials).

## What is and is not live in this build
- **Live now**: accounts, roles, approvals, parental-consent gate, safeguarding flags, the switchboard, backups, and **practice levels for students** (with instant feedback, help and glossary).
- **Not yet wired to the live server** (works in the prototype, to bring across next): the Discovery questionnaires, the Knowledge Baseline, weekly plans and the marking queue, attendance emails, and the full staff question-bank editor. For the first pilot, practice levels alone give students real, useful, safe activity.
