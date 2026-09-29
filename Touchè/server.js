'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const E = require('./lib/engine');

const PORT = process.env.PORT || 3000;
const INVITE = process.env.TOUCHE_INVITE || 'touche';
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const PUBLIC = path.join(__dirname, 'public');

let db = { users: [], sessions: {}, competitions: [] };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch {}
function save() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db));
  fs.renameSync(DB_FILE + '.tmp', DB_FILE);
}
const uid = () => crypto.randomBytes(6).toString('hex');
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const bad = (msg, code = 400) => { throw new HttpError(code, msg); };

function parseCookie(req) {
  const m = /(?:^|; )sid=([^;]+)/.exec(req.headers.cookie || '');
  return m && m[1];
}
function userOf(req) {
  const uidv = db.sessions[parseCookie(req)];
  return db.users.find(u => u.id === uidv) || null;
}
function need(req) { return userOf(req) || bad('Accesso richiesto', 401); }
function comp(id) { return db.competitions.find(c => c.id === id) || bad('Competizione non trovata', 404); }
function owned(req, id) {
  const u = need(req), c = comp(id);
  if (c.ownerId !== u.id) bad('Non sei il direttore di questa gara', 403);
  return c;
}
const status = c => c.de ? (c.de.rounds.at(-1)[0].winner ? 'concluso' : 'tabellone') : c.pools ? 'gironi' : 'iscrizioni';

function view(c, req) {
  const u = userOf(req);
  const out = { ...c, status: status(c), owner: db.users.find(x => x.id === c.ownerId)?.name, canEdit: !!u && u.id === c.ownerId };
  if (c.pools) out.ranking = E.ranking(c.pools, c.athletes);
  return out;
}

const score = (v, max) => { const n = Number(v); if (!Number.isInteger(n) || n < 0 || n > max) bad('Punteggio non valido'); return n; };

const routes = [];
const route = (method, re, fn) => routes.push([method, new RegExp('^' + re + '$'), fn]);

route('POST', '/api/register', (req, b, res) => {
  if (b.invite !== INVITE) bad('Codice invito errato', 403);
  const name = String(b.name || '').trim(), email = String(b.email || '').trim().toLowerCase();
  if (!name || !email || String(b.password || '').length < 6) bad('Compila nome, email e password (min. 6 caratteri)');
  if (db.users.some(u => u.email === email)) bad('Email già registrata', 409);
  const salt = crypto.randomBytes(8).toString('hex');
  const user = { id: uid(), name, email, salt, pw: hash(b.password, salt) };
  db.users.push(user); return login(res, user);
});
route('POST', '/api/login', (req, b, res) => {
  const user = db.users.find(u => u.email === String(b.email || '').trim().toLowerCase());
  if (!user || user.pw !== hash(String(b.password || ''), user.salt)) bad('Credenziali errate', 401);
  return login(res, user);
});
function login(res, user) {
  const sid = crypto.randomBytes(24).toString('hex');
  db.sessions[sid] = user.id; save();
  res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
  return { id: user.id, name: user.name };
}
route('POST', '/api/logout', (req, b, res) => {
  delete db.sessions[parseCookie(req)]; save();
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0'); return {};
});
route('GET', '/api/me', req => { const u = userOf(req); return u ? { id: u.id, name: u.name } : null; });

route('GET', '/api/competitions', req => db.competitions.map(c => ({
  id: c.id, name: c.name, date: c.date, place: c.place, weapon: c.weapon, category: c.category,
  athletes: c.athletes.length, status: status(c), ownerId: c.ownerId,
})).sort((a, b) => b.date.localeCompare(a.date)));
route('POST', '/api/competitions', (req, b) => {
  const u = need(req), name = String(b.name || '').trim();
  if (!name) bad('Inserisci il nome della gara');
  const c = { id: uid(), ownerId: u.id, name, date: b.date || '', place: String(b.place || ''), weapon: b.weapon || 'spada',
    category: String(b.category || ''), athletes: [], pools: null, de: null };
  db.competitions.push(c); save(); return { id: c.id };
});
route('GET', '/api/competitions/(\\w+)', (req, b, res, [id]) => view(comp(id), req));
route('DELETE', '/api/competitions/(\\w+)', (req, b, res, [id]) => {
  const c = owned(req, id); db.competitions = db.competitions.filter(x => x !== c); save(); return {};
});

// Iscritti: una riga per atleta "Cognome Nome, Società", in ordine di ranking.
route('POST', '/api/competitions/(\\w+)/athletes', (req, b, res, [id]) => {
  const c = owned(req, id);
  if (c.pools) bad('I gironi sono già stati generati');
  const lines = String(b.text || '').split('\n').map(s => s.trim()).filter(Boolean);
  for (const l of lines) { const [name, club] = l.split(/[,;\t]/).map(s => s.trim()); c.athletes.push({ id: uid(), name, club: club || '' }); }
  save(); return view(c, req);
});
route('DELETE', '/api/competitions/(\\w+)/athletes/(\\w+)', (req, b, res, [id, aid]) => {
  const c = owned(req, id);
  if (c.pools) bad('I gironi sono già stati generati');
  c.athletes = c.athletes.filter(a => a.id !== aid); save(); return view(c, req);
});
route('POST', '/api/competitions/(\\w+)/athletes/(\\w+)/move', (req, b, res, [id, aid]) => {
  const c = owned(req, id);
  if (c.pools) bad('I gironi sono già stati generati');
  const i = c.athletes.findIndex(a => a.id === aid), j = i + (b.dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= c.athletes.length) return view(c, req);
  [c.athletes[i], c.athletes[j]] = [c.athletes[j], c.athletes[i]]; save(); return view(c, req);
});

route('POST', '/api/competitions/(\\w+)/pools', (req, b, res, [id]) => {
  const c = owned(req, id);
  if (c.athletes.length < 4) bad('Servono almeno 4 atleti');
  c.pools = E.buildPools(c.athletes, Number(b.poolCount) || 0); c.de = null; save(); return view(c, req);
});
route('DELETE', '/api/competitions/(\\w+)/pools', (req, b, res, [id]) => {
  const c = owned(req, id); c.pools = null; c.de = null; save(); return view(c, req);
});
route('PUT', '/api/competitions/(\\w+)/pools/(\\d+)/bouts/(\\d+)', (req, b, res, [id, p, i]) => {
  const c = owned(req, id);
  if (c.de) bad('Il tabellone è già stato generato');
  const bout = c.pools?.[p - 1]?.bouts[i] || bad('Assalto non trovato', 404);
  if (b.sa === null || b.sa === '' ) { bout.sa = bout.sb = null; }
  else {
    const sa = score(b.sa, 5), sb = score(b.sb, 5);
    if (sa === sb) bad('Il pareggio non è ammesso');
    bout.sa = sa; bout.sb = sb;
  }
  save(); return view(c, req);
});

route('POST', '/api/competitions/(\\w+)/de', (req, b, res, [id]) => {
  const c = owned(req, id);
  if (!c.pools) bad('Genera prima i gironi');
  if (c.pools.some(p => p.bouts.some(x => x.sa == null))) bad('Completa tutti gli assalti dei gironi');
  c.de = E.buildBracket(E.ranking(c.pools, c.athletes).map(r => r.id)); save(); return view(c, req);
});
route('DELETE', '/api/competitions/(\\w+)/de', (req, b, res, [id]) => {
  const c = owned(req, id); c.de = null; save(); return view(c, req);
});
route('PUT', '/api/competitions/(\\w+)/de/(\\d+)/(\\d+)', (req, b, res, [id, r, i]) => {
  const c = owned(req, id);
  if (!c.de) bad('Tabellone non generato');
  try { E.setDEScore(c.de.rounds, +r, +i, score(b.sa, 15), score(b.sb, 15)); } catch (e) { if (e instanceof HttpError) throw e; bad(e.message); }
  save(); return view(c, req);
});

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const f = path.join(PUBLIC, path.normalize(p));
  if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res);
  let raw = '';
  req.on('data', d => { raw += d; if (raw.length > 1e6) req.destroy(); });
  req.on('end', () => {
    try {
      for (const [m, re, fn] of routes) {
        const match = re.exec(url.pathname);
        if (m === req.method && match) {
          const body = raw ? JSON.parse(raw) : {};
          const out = fn(req, body, res, match.slice(1));
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          return res.end(JSON.stringify(out));
        }
      }
      throw new HttpError(404, 'Non trovato');
    } catch (e) {
      const code = e instanceof HttpError ? e.code : e instanceof SyntaxError ? 400 : 500;
      if (code === 500) console.error(e);
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: code === 500 ? 'Errore interno' : e.message }));
    }
  });
}).listen(PORT, () => console.log(`Touchè su http://localhost:${PORT} (codice invito: ${INVITE})`));
