'use strict';
/*
 * Epsilon Academy pilot server.
 * One Node process, no external database, no npm dependencies.
 * Data is a single JSON file (data/store.json). Back it up by copying that file
 * (scripts/backup.js does this on a schedule). Good enough for a small pilot;
 * move to Postgres before large numbers of students.
 *
 * SECURITY MODEL (why it is safe for children's data):
 *  - Every request that changes or reads data is checked on the SERVER against the
 *    logged-in user's role. The browser is never trusted to send the whole state.
 *  - Passwords are hashed (scrypt) and never stored or logged in plain text.
 *  - A student account cannot be used until a parent CONSENT record exists.
 *  - Safeguarding flags are stored and shown to staff; the AI/logic never diagnoses.
 * Read docs/DEPLOY.md before going live. Real children also need a privacy notice,
 * parental consent and a data protection (DPIA) review; this is engineering, not legal advice.
 */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const STORE = path.join(DATA_DIR, 'store.json');
const PUBLIC = path.join(ROOT, 'public');
const CONFIG = readConfig();
const PORT = CONFIG.PORT || process.env.PORT || 8080;

// ---------- tiny JSON store with atomic writes ----------
let db = loadDB();
let saveTimer = null;
function loadDB() {
  try { return JSON.parse(fs.readFileSync(STORE, 'utf8')); }
  catch (e) { return freshDB(); }
}
function freshDB() {
  return {
    version: 1,
    flags: { registration_open: true, ai_marking: false }, // the "switchboard"
    users: [],        // {id, role, name, email, salt, hash, mustReset, resetCode, status}
    requests: [],
    members: [],      // domain records keyed to a user id
    consents: [],     // {studentId, byUserId, at, text}
    items: [],        // question bank (approved content), seeded from admin import
    audit: [],        // {at, who, action, target} — access + changes to child data
    safeguard: [],    // {at, studentId, type, message, handled}
    settings: { dsl_name: 'the Designated Safeguarding Lead', dsl_note: '' }
  };
}
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const tmp = STORE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, STORE); // atomic on same filesystem
  }, 120);
}
function saveNow() { const tmp = STORE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, STORE); }

// ---------- helpers ----------
function uid(p) { return (p || '') + crypto.randomBytes(6).toString('hex'); }
function now() { return Date.now(); }
function hashPw(pw, salt) { return crypto.scryptSync(String(pw), salt, 64).toString('hex'); }
function makePw(pw) { const salt = crypto.randomBytes(16).toString('hex'); return { salt, hash: hashPw(pw, salt) }; }
function checkPw(pw, salt, hash) {
  const h = Buffer.from(hashPw(pw, salt), 'hex'); const k = Buffer.from(hash, 'hex');
  return h.length === k.length && crypto.timingSafeEqual(h, k);
}
function audit(who, action, target) {
  db.audit.push({ at: now(), who: who || 'system', action, target: target || '' });
  if (db.audit.length > 5000) db.audit = db.audit.slice(-4000);
  save();
}
function readConfig() {
  const p = path.join(__dirname, 'config.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return {}; }
}

// ---------- sessions (in-memory; cleared on restart, which is fine) ----------
const loginHits = new Map(); // ip -> {n, first}
function clientIp(req){return String(req.headers['x-real-ip']||'').trim() || req.socket.remoteAddress || 'ip';}
function rateLimited(ip){
  const now2=Date.now(); const rec=loginHits.get(ip);
  if(!rec||now2-rec.first>15*60*1000){loginHits.set(ip,{n:1,first:now2});return false;}
  rec.n++; return rec.n>10; // >10 attempts in 15 min
}
function rateReset(ip){loginHits.delete(ip);}
const sessions = new Map(); // token -> {userId, at}
const DAY = 24 * 3600 * 1000;
function newSession(userId) { const t = crypto.randomBytes(24).toString('hex'); sessions.set(t, { userId, at: now() }); return t; }
function sessionUser(req) {
  const c = parseCookies(req).eps;
  if (!c) return null;
  const s = sessions.get(c);
  if (!s) return null;
  if (now() - s.at > 3 * DAY) { sessions.delete(c); return null; }
  return db.users.find(u => u.id === s.userId) || null;
}
function parseCookies(req) {
  const out = {}; const h = req.headers.cookie || '';
  h.split(';').forEach(p => { const i = p.indexOf('='); if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}

// ---------- first-run: create the super user from config or a printed code ----------
function ensureSuperUser() {
  if (db.users.some(u => u.role === 'super')) return;
  const email = (CONFIG.SUPER_EMAIL || 'owner@example.com').toLowerCase();
  const tempCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  const { salt, hash } = makePw(tempCode);
  db.users.push({ id: uid('u'), role: 'super', name: CONFIG.SUPER_NAME || 'Super user', email, salt, hash, mustReset: true, status: 'active' });
  saveNow();
  console.log('\n=============================================');
  console.log(' FIRST RUN: super user created');
  console.log('   Email:            ' + email);
  console.log('   One-time password: ' + tempCode);
  console.log('   Log in, then set your own password immediately.');
  console.log('=============================================\n');
}

// ---------- API ----------
function send(res, code, obj, headers) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json', 'Content-Length': body.length,
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }, headers || {}));
  res.end(body);
}
function body(req) {
  return new Promise((resolve) => {
    let d = ''; let size = 0;
    req.on('data', c => { size += c.length; if (size > 2e6) { req.destroy(); return; } d += c; });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { resolve({}); } });
  });
}
function requireRole(user, roles) { return user && roles.indexOf(user.role) > -1; }

// public view of a user (no secrets)
function pubUser(u) { return u && { id: u.id, role: u.role, name: u.name, email: u.email, mustReset: !!u.mustReset }; }

// what a given user is allowed to read of the domain data
function viewFor(user) {
  const base = { me: pubUser(user), flags: db.flags };
  if (user.role === 'super') {
    return Object.assign(base, {
      requests: db.requests, members: db.members, items: db.items.filter(i => i.status === 'approved'),
      allItems: db.items, safeguard: db.safeguard, audit: db.audit.slice(-200), settings: db.settings,
      users: db.users.map(pubUser), consents: db.consents
    });
  }
  if (user.role === 'teacher') {
    const mine = db.members.filter(m => m.teacherId === user.id);
    const myIds = mine.map(m => m.id);
    return Object.assign(base, {
      requests: db.requests.filter(r => r.assignedTeacherId === user.id),
      members: mine, items: db.items.filter(i => i.status === 'approved'),
      safeguard: db.safeguard.filter(s => myIds.indexOf(s.studentId) > -1)
    });
  }
  if (user.role === 'student') {
    const me = db.members.find(m => m.userId === user.id);
    return Object.assign(base, {
      member: me || null, items: db.items.filter(i => i.status === 'approved'),
      consented: !!(me && db.consents.some(c => c.studentId === me.id))
    });
  }
  if (user.role === 'parent') {
    const me = db.members.find(m => m.userId === user.id);
    const child = me && me.childId ? db.members.find(m => m.id === me.childId) : null;
    return Object.assign(base, { member: me || null, child: child || null });
  }
  return base;
}

const routes = {
  'POST /api/login': async (req, res) => {
    const ip = clientIp(req);
    if (rateLimited(ip)) { audit(ip, 'login_rate_limited'); return send(res, 429, { error: 'Too many attempts. Please wait 15 minutes and try again.' }); }
    const b = await body(req);
    const u = db.users.find(x => x.email === String(b.email || '').toLowerCase());
    if (!u || u.status === 'revoked' || !checkPw(b.password || '', u.salt, u.hash)) {
      audit(b.email || '?', 'login_failed'); return send(res, 401, { error: 'Wrong email or password.' });
    }
    const token = newSession(u.id);
    rateReset(ip); audit(u.id, 'login');
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    send(res, 200, { ok: true, user: pubUser(u) }, { 'Set-Cookie': `eps=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${3 * 86400}${secure}` });
  },
  'POST /api/logout': async (req, res) => {
    const c = parseCookies(req).eps; if (c) sessions.delete(c);
    send(res, 200, { ok: true }, { 'Set-Cookie': 'eps=; HttpOnly; Path=/; Max-Age=0' });
  },
  'POST /api/set-password': async (req, res, user) => {
    if (!user) return send(res, 401, { error: 'Please log in.' });
    const b = await body(req);
    if (String(b.password || '').length < 8) return send(res, 400, { error: 'Use at least 8 characters.' });
    const pw = makePw(b.password); user.salt = pw.salt; user.hash = pw.hash; user.mustReset = false;
    audit(user.id, 'password_set'); saveNow();
    send(res, 200, { ok: true });
  },
  'GET /api/state': async (req, res, user) => {
    if (!user) return send(res, 401, { error: 'Please log in.' });
    send(res, 200, viewFor(user));
  },
  // public: a visitor asks for access (no login)
  'POST /api/request-access': async (req, res) => {
    if (!db.flags.registration_open) return send(res, 403, { error: 'Registration is closed at the moment.' });
    const b = await body(req);
    const name = String(b.name || '').trim().slice(0, 80);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 120);
    const role = b.role === 'parent' ? 'parent' : 'student';
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { error: 'Enter a name and a valid email.' });
    db.requests.unshift({ id: uid('r'), role, name, year: role === 'student' ? String(b.year || '') : '', email, status: 'pending', at: now() });
    save(); send(res, 200, { ok: true });
  },
  // student/parent actions on their own data go through narrow, checked endpoints
  'POST /api/student/save': async (req, res, user) => {
    if (!requireRole(user, ['student'])) return send(res, 403, { error: 'Not allowed.' });
    const me = db.members.find(m => m.userId === user.id);
    if (!me) return send(res, 400, { error: 'No student record.' });
    if (me.status === 'revoked') return send(res, 403, { error: 'Access paused.' });
    if (!db.consents.some(c => c.studentId === me.id)) return send(res, 403, { error: 'consent_required' });
    const b = await body(req);
    // students may only write their own learning data, never identity/roles/subjects
    const allow = ['ans', 'done', 'attempts', 'lad', 'base', 'plan_progress'];
    allow.forEach(k => { if (b[k] !== undefined) me[k] = b[k]; });
    // safeguarding: if the client flagged a wellbeing trigger, record it for a human
    if (Array.isArray(b.newFlags)) b.newFlags.forEach(f => {
      db.safeguard.push({ at: now(), studentId: me.id, type: String(f.type || 'note').slice(0, 20), message: String(f.message || '').slice(0, 300), handled: false });
    });
    audit(user.id, 'student_save', me.id); save(); send(res, 200, { ok: true });
  },
  // super user / teacher actions
  'POST /api/admin/action': async (req, res, user) => {
    if (!requireRole(user, ['super', 'teacher'])) return send(res, 403, { error: 'Not allowed.' });
    const b = await body(req);
    const r = adminAction(user, b);
    if (r.error) return send(res, r.code || 400, { error: r.error });
    save(); send(res, 200, Object.assign({ ok: true }, r));
  }
};

function adminAction(user, b) {
  const isSuper = user.role === 'super';
  switch (b.type) {
    case 'assign': {
      if (!isSuper) return { error: 'Only the super user can assign.' };
      const r = db.requests.find(x => x.id === b.id); if (!r) return { error: 'Not found.' };
      r.assignedTeacherId = b.teacherId; r.assignedSubs = b.subs || []; r.assignedChildId = b.childId || '';
      return {};
    }
    case 'approve': {
      const r = db.requests.find(x => x.id === b.id); if (!r) return { error: 'Not found.' };
      if (!isSuper && r.assignedTeacherId !== user.id) return { error: 'This request is not assigned to you.' };
      const teacherId = isSuper ? (b.teacherId || r.assignedTeacherId) : user.id;
      if (!teacherId) return { error: 'Choose a teacher first.' };
      // create the login account with a one-time code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const pw = makePw(code);
      const account = { id: uid('u'), role: r.role, name: r.name, email: r.email, salt: pw.salt, hash: pw.hash, mustReset: true, status: 'active' };
      db.users.push(account);
      const member = { id: uid('m'), userId: account.id, role: r.role, name: r.name, year: r.year, email: r.email,
        teacherId, subs: isSuper ? (b.subs || r.assignedSubs || []) : (r.assignedSubs || []), childId: b.childId || r.assignedChildId || '',
        status: 'active', ans: {}, done: {}, attempts: [], lad: {}, base: {} };
      db.members.push(member);
      r.status = 'approved'; r.decidedBy = user.name; r.decidedAt = now();
      audit(user.id, 'approve', member.id);
      return { loginCode: code, loginEmail: account.email }; // show once so the owner can pass it on
    }
    case 'reject': {
      const r = db.requests.find(x => x.id === b.id); if (!r) return { error: 'Not found.' };
      if (!isSuper && r.assignedTeacherId !== user.id) return { error: 'Not assigned to you.' };
      r.status = 'rejected'; r.decidedBy = user.name; r.decidedAt = now(); return {};
    }
    case 'record_consent': {
      if (!isSuper) return { error: 'Only the super user can record consent.' };
      const m = db.members.find(x => x.id === b.studentId); if (!m) return { error: 'Not found.' };
      db.consents.push({ studentId: m.id, byUserId: user.id, at: now(), text: String(b.text || 'Parental consent recorded').slice(0, 300) });
      audit(user.id, 'consent_recorded', m.id); return {};
    }
    case 'set_subjects': {
      const m = db.members.find(x => x.id === b.id); if (!m) return { error: 'Not found.' };
      if (!isSuper && m.teacherId !== user.id) return { error: 'Not your student.' };
      if (isSuper && b.teacherId) m.teacherId = b.teacherId;
      if (b.subs) m.subs = b.subs; if (b.childId !== undefined) m.childId = b.childId;
      return {};
    }
    case 'revoke': case 'restore': {
      if (!isSuper) return { error: 'Only the super user can change access.' };
      const m = db.members.find(x => x.id === b.id); if (!m) return { error: 'Not found.' };
      m.status = b.type === 'revoke' ? 'revoked' : 'active';
      const acct = db.users.find(u => u.id === m.userId); if (acct) acct.status = m.status;
      audit(user.id, b.type, m.id); return {};
    }
    case 'handle_flag': {
      const f = db.safeguard[b.index]; if (!f) return { error: 'Not found.' };
      if (!isSuper) { const m = db.members.find(x => x.id === f.studentId); if (!m || m.teacherId !== user.id) return { error: 'Not your student.' }; }
      f.handled = true; f.handledBy = user.name; f.handledAt = now(); audit(user.id, 'handle_flag', f.studentId); return {};
    }
    case 'set_flag': { // the switchboard
      if (!isSuper) return { error: 'Only the super user.' };
      db.flags[b.key] = !!b.value; audit(user.id, 'flag', b.key + '=' + b.value); return {};
    }
    case 'import_items': {
      if (!isSuper) return { error: 'Only the super user can import content.' };
      if (!Array.isArray(b.items)) return { error: 'No items.' };
      db.items = b.items; audit(user.id, 'import_items', String(b.items.length)); return { count: b.items.length };
    }
    case 'add_teacher': {
      if (!isSuper) return { error: 'Only the super user.' };
      const email = String(b.email||'').trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email.' };
      if (db.users.some(u=>u.email===email)) return { error: 'That email already has an account.' };
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const pw = makePw(code);
      db.users.push({ id: uid('u'), role:'teacher', name:String(b.name||'Teacher').slice(0,80), email, salt:pw.salt, hash:pw.hash, mustReset:true, status:'active' });
      audit(user.id,'add_teacher',email);
      return { loginCode: code, loginEmail: email };
    }
    case 'publish_plan': {
      const m = db.members.find(x=>x.id===b.id); if(!m) return { error:'Not found.' };
      if(!isSuper && m.teacherId!==user.id) return { error:'Not your student.' };
      m.plan = b.plan || null; // the client builds the plan; server stores it against the student
      if(m.plan) m.plan.status='published';
      audit(user.id,'publish_plan',m.id); return {};
    }
    default: return { error: 'Unknown action.' };
  }
}

// ---------- static files ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
function serveStatic(req, res) {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end('No'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      // conservative CSP: same-origin only, no third-party anything
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'" });
    res.end(data);
  });
}

// ---------- request handler ----------
const server = http.createServer(async (req, res) => {
  try {
    const url = req.url.split('?')[0];
    const key = req.method + ' ' + url;
    if (routes[key]) {
      const user = sessionUser(req);
      return routes[key](req, res, user);
    }
    if (req.method === 'GET') return serveStatic(req, res);
    send(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error(e); send(res, 500, { error: 'Server error' });
  }
});

ensureSuperUser();
server.listen(PORT, CONFIG.HOST || '127.0.0.1', () => console.log('Epsilon Academy server on http://localhost:' + PORT));
