# Epsilon Academy — pilot server

A small, self-contained server that runs Epsilon Academy for a live pilot on your Hostinger VPS.
No external services, no npm install, data in one file. Read the guides in this order:

1. **WEBSITE-CLOUDFLARE.md** Part 1 — create app.epsilonacademy.co.uk in Cloudflare (do first).
1. **DEPLOY.md** — put it online on your VPS (non-technical steps).
1. **WEBSITE-CLOUDFLARE.md** Part 2 — add Login/Join buttons to your website.
2. **PILOT-RUNBOOK.md** — run the first live test safely.
3. **TECH-NOTES.md** — for a developer: what's built, what to wire next, security must-dos.

Quick local try-out (on your own computer, for a look):
```
cp config.example.json config.json     # edit the email
node server.js                          # prints a one-time owner password
```
then open http://localhost:8080/login.html

Load the Year 7 Maths questions once the server runs:
```
node scripts/import-content.js content/year7-maths-approved.json
```

## What it does
- Real logins for four roles: super user (you), teacher, student, parent.
- Public access requests, owner approval, one-time login codes, self-set passwords.
- Parental-consent gate: a student cannot save work until you record consent.
- Safeguarding flags routed to staff (never auto-diagnosed).
- Practice levels for students (Year 7 Maths), with instant feedback, help and a glossary.
- Switchboard to turn features on/off, an audit log, and nightly backups.

## Safety
Do not put real children on it before: a completed privacy notice, parental consent, a DPIA,
and https. See PILOT-RUNBOOK.md. This is engineering guidance, not legal advice.
