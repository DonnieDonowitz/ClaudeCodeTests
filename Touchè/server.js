'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const E = require('./lib/engine');
const R = require('./lib/ranking');

const PORT = process.env.PORT || 3000;
const INVITE = process.env.TOUCHE_INVITE || 'touche';
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const PUBLIC = path.join(__dirname, 'public');

let db = { users: [], sessions: {}, competitions: [], rankings: {} };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch {}
db.rankings = db.rankings || {};
function save() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db));
  fs.renameSync(DB_FILE + '.tmp', DB_FILE);
}
const REGIONS = ['abruzzo', 'basilicata', 'calabria', 'campania', 'emilia-romagna', 'friuli-venezia-giulia', 'lazio', 'liguria', 'lombardia', 'marche', 'molise', 'piemonte', 'puglia', 'sardegna', 'sicilia', 'toscana', 'trentino-alto-adige', 'umbria', 'valle-d-aosta', 'veneto'];
const ZONES = ['nazionale', 'master', ...REGIONS];
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
function refOf(req) {
  const v = db.sessions[parseCookie(req)];
  if (typeof v !== 'string' || !v.startsWith('ref:')) return null;
  const [, cid, rid] = v.split(':');
  const c = db.competitions.find(x => x.id === cid);
  const r = c?.referees?.find(x => x.id === rid);
  return r ? { c, r } : null;
}
// Può inserire risultati il direttore della gara o l'arbitro assegnato a quel girone/assalto.
function canScore(req, c, refereeId) {
  const u = userOf(req);
  if (u && u.id === c.ownerId) return true;
  const rf = refOf(req);
  return !!(rf && rf.c.id === c.id && refereeId && rf.r.id === refereeId);
}
function need(req) { return userOf(req) || bad('Accesso richiesto', 401); }
function comp(id) { return db.competitions.find(c => c.id === id) || bad('Competizione non trovata', 404); }
function owned(req, id) {
  const u = need(req), c = comp(id);
  if (c.ownerId !== u.id) bad('Non sei il direttore di questa gara', 403);
  return c;
}
const CATEGORIES = ['Giovani', 'Assoluti', 'Under-23', 'Cadetti', 'Juniores', 'Under-14', 'Master'];
const rankKey = c => [c.category, c.weapon, c.gender || 'M'].map(x => String(x).toLowerCase().trim()).join('|');
const rk = a => a.rank ?? R.UNRANKED;
// Atleti presenti ordinati per ranking (i senza ranking, 9999, in ordine di sorteggio).
const active = c => c.athletes.filter(a => !a.absent).sort((x, y) => rk(x) - rk(y) || (c.lots?.[x.id] ?? 0) - (c.lots?.[y.id] ?? 0));
function applyRanking(c) {
  const map = db.rankings[rankKey(c)]?.map;
  for (const a of c.athletes) if (!a.manual) a.rank = map ? R.rankOf(map, a.name) : null;
  c.athletes.sort((x, y) => rk(x) - rk(y));
}
function progress(c) {
  const bouts = (c.pools || []).flatMap(p => p.bouts);
  const de = (c.de?.rounds || []).flat().filter(m => m.a && m.b);
  const all = [...bouts, ...de];
  return { done: all.filter(m => m.forfeit || m.sa != null).length, total: all.length };
}
const status = c => c.de ? (c.de.rounds.at(-1)[0].winner ? 'concluso' : 'tabellone') : c.pools ? 'gironi' : 'iscrizioni';

function view(c, req) {
  const u = userOf(req);
  const rf = refOf(req);
  const out = { ...c, zone: c.zone || 'nazionale', status: status(c), owner: db.users.find(x => x.id === c.ownerId)?.name, canEdit: !!u && u.id === c.ownerId };
  const ri = db.rankings[rankKey(c)];
  out.rankingInfo = ri ? { updated: ri.updated, count: ri.count, file: ri.file } : null;
  out.referee = rf && rf.c.id === c.id ? { id: rf.r.id, name: rf.r.name } : null;
  if (!out.canEdit) out.referees = (c.referees || []).map(r => ({ id: r.id, name: r.name }));
  if (c.pools) out.ranking = E.ranking(c.pools, active(c), c.lots);
  if (c.de) out.final = E.finalRanking(c.de, out.ranking.map(r => r.id));
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
route('GET', '/api/me', req => {
  const u = userOf(req); if (u) return { role: 'director', id: u.id, name: u.name };
  const rf = refOf(req); return rf ? { role: 'referee', id: rf.r.id, name: rf.r.name, competitionId: rf.c.id, competition: rf.c.name } : null;
});
route('POST', '/api/referee/login', (req, b, res) => {
  const code = String(b.code || '').trim();
  for (const c of db.competitions) {
    const r = (c.referees || []).find(x => x.code === code);
    if (r) {
      const sid = crypto.randomBytes(24).toString('hex');
      db.sessions[sid] = `ref:${c.id}:${r.id}`; save();
      res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
      return { role: 'referee', id: r.id, name: r.name, competitionId: c.id };
    }
  }
  bad('Codice arbitro non valido', 401);
});

route('GET', '/api/competitions', req => db.competitions.map(c => ({
  id: c.id, name: c.name, date: c.date, place: c.place, weapon: c.weapon, category: c.category,
  athletes: c.athletes.length, status: status(c), ownerId: c.ownerId, zone: c.zone || 'nazionale', progress: progress(c),
})).sort((a, b) => b.date.localeCompare(a.date)));
route('POST', '/api/competitions', (req, b) => {
  const u = need(req), name = String(b.name || '').trim();
  if (!name) bad('Inserisci il nome della gara');
  const c = { id: uid(), ownerId: u.id, name, date: b.date || '', place: String(b.place || ''), weapon: b.weapon || 'spada',
    category: String(b.category || ''), gender: b.gender === 'F' ? 'F' : 'M', zone: ZONES.includes(b.zone) ? b.zone : 'nazionale', referees: [], athletes: [], pools: null, de: null };
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
  for (const l of lines) {
    const [name, club, r] = l.split(/[,;\t]/).map(s => s.trim());
    const a = { id: uid(), name, club: club || '', rank: null };
    if (/^\d+$/.test(r || '')) { a.rank = +r; a.manual = true; }
    c.athletes.push(a);
  }
  applyRanking(c); save(); return view(c, req);
});
route('DELETE', '/api/competitions/(\\w+)/athletes/(\\w+)', (req, b, res, [id, aid]) => {
  const c = owned(req, id);
  if (c.pools) bad('I gironi sono già stati generati');
  c.athletes = c.athletes.filter(a => a.id !== aid); save(); return view(c, req);
});
route('POST', '/api/competitions/(\\w+)/athletes/(\\w+)/absent', (req, b, res, [id, aid]) => {
  const c = owned(req, id);
  if (c.pools) bad('I gironi sono già stati generati');
  const a = c.athletes.find(x => x.id === aid) || bad('Atleta non trovato', 404);
  a.absent = !a.absent; save(); return view(c, req);
});
route('POST', '/api/competitions/(\\w+)/ranking', (req, b, res, [id]) => {
  const c = owned(req, id);
  if (c.pools) bad('I gironi sono già stati generati');
  let map;
  try { map = R.parseRankingFile(Buffer.from(String(b.file || ''), 'base64'), String(b.filename || '')); } catch (e) { bad(e.message); }
  db.rankings[rankKey(c)] = { updated: Date.now(), count: Object.keys(map).length, file: String(b.filename || ''), map };
  db.competitions.filter(x => !x.pools && rankKey(x) === rankKey(c)).forEach(applyRanking);
  save(); return view(c, req);
});

route('POST', '/api/competitions/(\\w+)/pools', (req, b, res, [id]) => {
  const c = owned(req, id);
  c.lots = Object.fromEntries(c.athletes.map(a => [a.id, Math.random()]));
  const act = active(c);
  if (act.length < 4) bad('Servono almeno 4 atleti presenti');
  c.pools = E.buildPools(act, Number(b.poolCount) || 0); c.de = null; save(); return view(c, req);
});
route('DELETE', '/api/competitions/(\\w+)/pools', (req, b, res, [id]) => {
  const c = owned(req, id); c.pools = null; c.de = null; save(); return view(c, req);
});
route('PUT', '/api/competitions/(\\w+)/pools/(\\d+)/bouts/(\\d+)', (req, b, res, [id, p, i]) => {
  const c = comp(id);
  const pool = c.pools?.[p - 1] || bad('Girone non trovato', 404);
  if (!canScore(req, c, pool.refereeId)) bad('Non sei l\'arbitro di questo girone', 403);
  if (c.de) bad('Il tabellone è già stato generato');
  const bout = pool.bouts[i] || bad('Assalto non trovato', 404);
  if (b.sa === null || b.sa === '' ) { bout.sa = bout.sb = null; }
  else {
    const sa = score(b.sa, 5), sb = score(b.sb, 5);
    if (sa === sb) bad('Il pareggio non è ammesso');
    bout.sa = sa; bout.sb = sb; bout.t = Date.now();
  }
  save(); return view(c, req);
});

route('POST', '/api/competitions/(\\w+)/de', (req, b, res, [id]) => {
  const c = owned(req, id);
  if (!c.pools) bad('Genera prima i gironi');
  if (c.pools.some(p => p.bouts.some(x => x.sa == null))) bad('Completa tutti gli assalti dei gironi');
  c.de = E.buildBracket(E.ranking(c.pools, active(c), c.lots).map(r => r.id)); save(); return view(c, req);
});
route('DELETE', '/api/competitions/(\\w+)/de', (req, b, res, [id]) => {
  const c = owned(req, id); c.de = null; save(); return view(c, req);
});
route('PUT', '/api/competitions/(\\w+)/de/(\\d+)/(\\d+)', (req, b, res, [id, r, i]) => {
  const c = comp(id);
  if (!c.de) bad('Tabellone non generato');
  const match = c.de.rounds[r]?.[i] || bad('Assalto non trovato', 404);
  if (!canScore(req, c, match.refereeId)) bad('Non sei l\'arbitro di questo assalto', 403);
  if (b.forfeit) owned(req, id);
  try { if (b.forfeit) E.setDEForfeit(c.de.rounds, +r, +i, b.forfeit === 'a' ? 'a' : 'b'); else E.setDEScore(c.de.rounds, +r, +i, score(b.sa, 15), score(b.sb, 15)); } catch (e) { if (e instanceof HttpError) throw e; bad(e.message); }
  match.t = Date.now(); save(); return view(c, req);
});

route('POST', '/api/competitions/(\\w+)/referees', (req, b, res, [id]) => {
  const c = owned(req, id);
  const name = String(b.name || '').trim() || bad('Inserisci il nome dell\'arbitro');
  let code; do { code = String(crypto.randomInt(100000, 1000000)); } while (db.competitions.some(x => (x.referees || []).some(r => r.code === code)));
  (c.referees = c.referees || []).push({ id: uid(), name, code }); save(); return view(c, req);
});
route('DELETE', '/api/competitions/(\\w+)/referees/(\\w+)', (req, b, res, [id, rid]) => {
  const c = owned(req, id);
  c.referees = (c.referees || []).filter(r => r.id !== rid);
  (c.pools || []).forEach(p => { if (p.refereeId === rid) delete p.refereeId; });
  (c.de?.rounds || []).flat().forEach(m => { if (m.refereeId === rid) delete m.refereeId; });
  for (const [k, v] of Object.entries(db.sessions)) if (v === `ref:${c.id}:${rid}`) delete db.sessions[k];
  save(); return view(c, req);
});
const setRef = (c, target, rid) => {
  if (rid && !(c.referees || []).some(r => r.id === rid)) bad('Arbitro non trovato', 404);
  if (rid) target.refereeId = rid; else delete target.refereeId;
};
route('PUT', '/api/competitions/(\\w+)/pools/(\\d+)/referee', (req, b, res, [id, p]) => {
  const c = owned(req, id); setRef(c, c.pools?.[p - 1] || bad('Girone non trovato', 404), b.refereeId); save(); return view(c, req);
});
route('PUT', '/api/competitions/(\\w+)/de/(\\d+)/(\\d+)/referee', (req, b, res, [id, r, i]) => {
  const c = owned(req, id); setRef(c, c.de?.rounds[r]?.[i] || bad('Assalto non trovato', 404), b.refereeId); save(); return view(c, req);
});
// Assegnazione automatica: gironi a rotazione, poi gli assalti del tabellone non ancora giocati.
route('POST', '/api/competitions/(\\w+)/referees/auto', (req, b, res, [id]) => {
  const c = owned(req, id), refs = c.referees || [];
  if (!refs.length) bad('Aggiungi prima almeno un arbitro');
  let k = 0;
  (c.pools || []).forEach(p => { p.refereeId = refs[k++ % refs.length].id; });
  (c.de?.rounds || []).forEach(rd => rd.forEach(m => { if (m.a && m.b && !m.winner) m.refereeId = refs[k++ % refs.length].id; }));
  save(); return view(c, req);
});

// Risultati recenti di tutte le gare, per la pagina principale in tempo reale.
const roundLabel = (size, r) => { const left = size / 2 ** r; return left === 2 ? 'Finale' : left === 4 ? 'Semifinale' : left === 8 ? 'Quarti' : `Tab. dei ${left}`; };
route('GET', '/api/live', () => {
  const out = [];
  for (const c of db.competitions) {
    const nm = Object.fromEntries(c.athletes.map(a => [a.id, a.name]));
    const rn = id => (c.referees || []).find(r => r.id === id)?.name || null;
    (c.pools || []).forEach(p => p.bouts.forEach(b => { if (b.t && b.sa != null) out.push({ t: b.t, c: c.name, cid: c.id, zone: c.zone || 'nazionale', phase: `Girone ${p.index}`, a: nm[b.a], b: nm[b.b], sa: b.sa, sb: b.sb, ref: rn(p.refereeId) }); }));
    (c.de?.rounds || []).forEach((rd, r) => rd.forEach(m => { if (m.t && m.winner && m.a && m.b) out.push({ t: m.t, c: c.name, cid: c.id, zone: c.zone || 'nazionale', phase: roundLabel(c.de.size, r), a: nm[m.a], b: nm[m.b], sa: m.sa, sb: m.sb, forfeit: !!m.forfeit, ref: rn(m.refereeId) }); }));
  }
  return out.sort((x, y) => y.t - x.t).slice(0, 15);
});

// ---- Ricerca pubblica: gare, schermidori e società ----
// Un atleta è identificato dal nome (indipendente dall'ordine di cognome e nome), una società dal nome normalizzato.
const inProgress = c => { const s = status(c); return s === 'gironi' || s === 'tabellone'; };
const compBrief = (c, a) => ({ id: c.id, name: c.name, date: c.date, place: c.place, weapon: c.weapon, category: c.category, gender: c.gender || 'M',
  zone: c.zone || 'nazionale', status: status(c), live: inProgress(c), progress: progress(c), athlete: a ? { rank: a.rank } : undefined });
function people() {
  const ppl = new Map(), clubs = new Map();
  for (const c of [...db.competitions].sort((x, y) => (x.date || '').localeCompare(y.date || ''))) {
    for (const a of c.athletes) {
      if (a.absent || !a.name) continue;
      const k = R.nameKey(a.name); if (!k) continue;
      const p = ppl.get(k) || { key: k, name: a.name, club: '', comps: [] };
      p.name = a.name; if (a.club) p.club = a.club; p.comps.push([c, a]); ppl.set(k, p);
      if (a.club) {
        const ck = R.norm(a.club), cl = clubs.get(ck) || { key: ck, name: a.club, athletes: new Set() };
        cl.athletes.add(k); clubs.set(ck, cl);
      }
    }
  }
  return { ppl, clubs };
}
const byDate = (x, y) => (y.live - x.live) || (y.date || '').localeCompare(x.date || '');
function athleteRankings(k) {
  const out = [];
  for (const [key, ri] of Object.entries(db.rankings)) {
    const pos = ri.map?.[k]; if (!pos) continue;
    const [category, weapon, gender] = key.split('|');
    out.push({ category, weapon, gender: gender.toUpperCase(), pos, file: ri.file, updated: ri.updated });
  }
  return out.sort((x, y) => x.weapon.localeCompare(y.weapon) || x.category.localeCompare(y.category) || x.pos - y.pos);
}
route('GET', '/api/search', (req, b, res, [], url) => {
  const q = R.norm(url.searchParams.get('q') || ''); if (q.length < 2) return { competitions: [], athletes: [], clubs: [] };
  const terms = q.split(' '), hit = s => { const n = R.norm(s); return terms.every(t => n.includes(t)); };
  const { ppl, clubs } = people();
  return {
    competitions: db.competitions.filter(c => hit(`${c.name} ${c.place} ${c.weapon} ${c.category}`)).map(c => compBrief(c)).sort(byDate).slice(0, 30),
    athletes: [...ppl.values()].filter(p => hit(p.name)).map(p => ({ key: p.key, name: p.name, club: p.club, count: p.comps.length, live: p.comps.some(([c]) => inProgress(c)) })).sort((x, y) => y.live - x.live || x.name.localeCompare(y.name)).slice(0, 30),
    clubs: [...clubs.values()].filter(cl => hit(cl.name)).map(cl => ({ key: cl.key, name: cl.name, count: cl.athletes.size })).sort((x, y) => x.name.localeCompare(y.name)).slice(0, 30),
  };
});
route('GET', '/api/athletes/([^/]+)', (req, b, res, [key]) => {
  key = decodeURIComponent(key);
  const p = people().ppl.get(key) || bad('Schermidore non trovato', 404);
  return { key, name: p.name, club: p.club, rankings: athleteRankings(key), competitions: p.comps.map(([c, a]) => compBrief(c, a)).sort(byDate) };
});
route('GET', '/api/clubs/([^/]+)', (req, b, res, [key]) => {
  key = decodeURIComponent(key);
  const { ppl, clubs } = people(), cl = clubs.get(key) || bad('Società non trovata', 404);
  return { key, name: cl.name, athletes: [...cl.athletes].map(k => { const p = ppl.get(k);
    return { key: k, name: p.name, count: p.comps.length, live: p.comps.some(([c]) => inProgress(c)), rankings: athleteRankings(k).map(r => ({ category: r.category, weapon: r.weapon, gender: r.gender, pos: r.pos })) }; })
    .sort((x, y) => x.name.localeCompare(y.name)) };
});
// Loghi opzionali in public/logos/<zona>.(svg|png|jpg|webp), zona = nazionale, master o id regione.
route('GET', '/api/logos', () => {
  const out = {};
  try { for (const f of fs.readdirSync(path.join(PUBLIC, 'logos'))) { const m = /^([a-z-]+)\.(svg|png|jpe?g|webp)$/.exec(f); if (m && ZONES.includes(m[1])) out[m[1]] = 'logos/' + f; } } catch {}
  return out;
});
route('GET', '/api/categories', () => CATEGORIES);
route('GET', '/api/zones', () => ZONES);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
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
  req.on('data', d => { raw += d; if (raw.length > 12e6) req.destroy(); });
  req.on('end', () => {
    try {
      for (const [m, re, fn] of routes) {
        const match = re.exec(url.pathname);
        if (m === req.method && match) {
          const body = raw ? JSON.parse(raw) : {};
          const out = fn(req, body, res, match.slice(1), url);
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
