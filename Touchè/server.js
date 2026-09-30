
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const E = require('./lib/engine');
const R = require('./lib/ranking');
const Store = require('./lib/store');
const { provinceOf } = require('./lib/clubs');

const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.TOUCHE_DB || path.join(__dirname, 'data', 'touche.db');
const PUBLIC = path.join(__dirname, 'public');

const S = Store.open(DB_FILE);
if (process.env.TOUCHE_DB === undefined && S.migrateJson(path.join(__dirname, 'data', 'db.json'))) console.log('Dati importati dal vecchio data/db.json (gli arbitri vanno ricreati come account).');
if (!S.countRole('admin')) {
  if (process.env.TOUCHE_ADMIN_EMAIL && process.env.TOUCHE_ADMIN_PASSWORD) {
    S.createUser({ name: 'Amministratore', email: process.env.TOUCHE_ADMIN_EMAIL, password: process.env.TOUCHE_ADMIN_PASSWORD, role: 'admin' });
    console.log('Creato amministratore ' + process.env.TOUCHE_ADMIN_EMAIL);
  } else console.log('ATTENZIONE: nessun amministratore. Crealo con: npm run create-user -- --role admin --email ... --name ... --password ...');
}

const REGIONS = ['abruzzo', 'basilicata', 'calabria', 'campania', 'emilia-romagna', 'friuli-venezia-giulia', 'lazio', 'liguria', 'lombardia', 'marche', 'molise', 'piemonte', 'puglia', 'sardegna', 'sicilia', 'toscana', 'trentino-alto-adige', 'umbria', 'valle-d-aosta', 'veneto'];
const ZONES = ['nazionale', 'master', ...REGIONS];
const uid = Store.uid;
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const bad = (msg, code = 400) => { throw new HttpError(code, msg); };

// ---- Autenticazione e permessi ----
// admin: tutto · regional: gare e account della propria zona · director: le proprie gare · referee: inserisce i risultati assegnati.
const parseCookie = req => /(?:^|; )sid=([^;]+)/.exec(req.headers.cookie || '')?.[1];
const userOf = req => S.userBySid(parseCookie(req));
function need(req, ...roles) {
  const u = userOf(req) || bad('Accesso richiesto', 401);
  if (roles.length && !roles.includes(u.role)) bad('Non hai i permessi per questa operazione', 403);
  return u;
}
const canManage = (u, c) => !!u && (u.role === 'admin' || (u.role === 'regional' && u.zone === c.zone) || (u.role === 'director' && c.ownerId === u.id));
const isAssigned = (u, c) => !!u && u.role === 'referee' && (c.referees || []).some(r => r.id === u.id);
function canScore(req, c, refereeId) {
  const u = userOf(req) || bad('Accesso richiesto', 401);
  return canManage(u, c) || (isAssigned(u, c) && !!refereeId && refereeId === u.id);
}
function comp(id) { return S.comp(id) || bad('Competizione non trovata', 404); }
function manage(req, id) {
  const u = need(req), c = comp(id);
  if (!canManage(u, c)) bad('Non gestisci questa gara', 403);
  return c;
}
const setCookie = (req, res, sid, maxAge) => res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${process.env.TOUCHE_SECURE === '1' || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);
// Limite ai tentativi di accesso: 10 errori ogni 15 minuti per indirizzo+email.
const fails = new Map();
function throttle(req, email, ok) {
  const k = (req.socket.remoteAddress || '') + '|' + email, now = Date.now(), f = fails.get(k);
  if (f && now - f.t > 9e5) fails.delete(k);
  if (ok === undefined) { if ((fails.get(k)?.n || 0) >= 10) bad('Troppi tentativi, riprova tra qualche minuto', 429); return; }
  if (ok) fails.delete(k); else fails.set(k, { n: (fails.get(k)?.n || 0) + 1, t: fails.get(k)?.t || now });
}

const CATEGORIES = ['Giovani', 'Assoluti', 'Under-23', 'Cadetti', 'Juniores', 'Under-14', 'Master', 'Bambini', 'Giovanissimi', 'Ragazzi', 'Allievi', 'Master Cat. 0', 'Master Cat. 1', 'Master Cat. 2', 'Master Cat. 3', 'Master Cat. 4'];
const WEAPONS = ['spada', 'fioretto', 'sciabola'];
const rankKey = c => Store.rankKey(c.category, c.weapon, c.gender);
const rk = a => a.rank ?? R.UNRANKED;
// Atleti presenti ordinati per ranking (i senza ranking, 9999, in ordine di sorteggio).
const active = c => c.athletes.filter(a => !a.absent).sort((x, y) => rk(x) - rk(y) || (c.lots?.[x.id] ?? 0) - (c.lots?.[y.id] ?? 0));
function applyRanking(c) {
  for (const a of c.athletes) if (!a.manual) a.rank = S.rankOf(rankKey(c), a.name);
  c.athletes.sort((x, y) => rk(x) - rk(y));
}
function progress(c) {
  const bouts = (c.pools || []).flatMap(p => p.bouts);
  const de = (c.de?.rounds || []).flat().filter(m => m.a && m.b);
  const all = [...bouts, ...de];
  return { done: all.filter(m => m.forfeit || m.sa != null).length, total: all.length };
}
const status = c => c.de ? (c.de.rounds.at(-1)[0].winner ? 'concluso' : 'tabellone') : c.pools ? 'gironi' : 'iscrizioni';
// Società: il testo libero delle gare si collega al codice Federscherma se il nome coincide con quello in societa.csv.
const clubKeyOf = text => S.clubKeyByName(R.norm(text)) || R.norm(text);
const clubInfo = code => { const r = S.clubRow(R.norm(code)), p = provinceOf(code); return { name: r ? r.name : code, code, city: r?.city || '', province: p ? p.name : '' }; };
const nameOf = id => S.user(id)?.name;

// Quota di eliminati subito dopo i gironi, decisa dal direttore alla creazione (percentuale dei presenti, arrotondata per difetto).
const cutPctOf = v => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(90, Math.max(0, n)) : 0; };
function cutInfo(c) {
  const n = active(c).length, pct = c.cutPct || 0;
  const elim = Math.min(Math.floor(n * pct / 100), Math.max(0, n - 2));
  return { pct, total: n, qualify: n - elim, eliminated: elim };
}
function view(c, req) {
  const u = userOf(req);
  const out = { ...c, zone: c.zone || 'nazionale', status: status(c), owner: nameOf(c.ownerId), canEdit: canManage(u, c) };
  const ri = S.rankingList(rankKey(c));
  out.rankingInfo = ri ? { updated: ri.updated, count: ri.count, file: ri.file } : null;
  out.referee = isAssigned(u, c) ? { id: u.id, name: u.name } : null;
  out.athletes = c.athletes.map(a => ({ ...a, clubKey: a.club ? clubKeyOf(a.club) : '' }));
  out.cut = cutInfo(c);
  if (c.pools) {
    out.ranking = E.ranking(c.pools, active(c), c.lots).map((r, i) => ({ ...r, qualified: i < out.cut.qualify }));
    if (c.de) { const ids = out.ranking.map(r => r.id); out.final = E.finalRanking(c.de, ids, ids.slice(out.cut.qualify)); }
  }
  return out;
}
const score = (v, max) => { const n = Number(v); if (!Number.isInteger(n) || n < 0 || n > max) bad('Punteggio non valido'); return n; };
const pubUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, zone: u.zone });

const routes = [];
const route = (method, re, fn) => routes.push([method, new RegExp('^' + re + '$'), fn]);

// ---- Accesso ----
route('POST', '/api/login', (req, b, res) => {
  const email = String(b.email || '').trim().toLowerCase();
  throttle(req, email);
  const u = S.verify(email, b.password);
  throttle(req, email, !!u);
  if (!u) bad('Email o password errate, oppure account disattivato', 401);
  setCookie(req, res, S.createSession(u.id), 2592000);
  return pubUser(u);
});
route('POST', '/api/logout', (req, b, res) => { S.dropSession(parseCookie(req)); setCookie(req, res, '', 0); return {}; });
route('GET', '/api/me', req => { const u = userOf(req); return u ? pubUser(u) : null; });
route('POST', '/api/me/password', (req, b) => {
  const u = need(req);
  if (!S.verify(u.email, b.current)) bad('Password attuale errata', 403);
  try { S.setPassword(u.id, b.password); } catch (e) { bad(e.message); }
  return {};
});

// ---- Gestione account (admin: tutti; admin regionale: direttori e arbitri della propria zona) ----
const manageableUser = (actor, t) => actor.role === 'admin' || (actor.role === 'regional' && t && ['director', 'referee'].includes(t.role) && t.zone === actor.zone);
route('GET', '/api/users', req => {
  const u = need(req, 'admin', 'regional');
  return S.users().filter(t => u.role === 'admin' || manageableUser(u, t));
});
route('POST', '/api/users', (req, b) => {
  const a = need(req, 'admin', 'regional');
  const role = String(b.role), zone = a.role === 'regional' ? a.zone : (b.zone || null);
  if (a.role === 'regional' && !['director', 'referee'].includes(role)) bad('Puoi creare solo direttori di gara e arbitri', 403);
  if (['regional'].includes(role) && !ZONES.includes(zone)) bad('L\'admin regionale richiede una zona');
  if (zone && !ZONES.includes(zone)) bad('Zona non valida');
  try { return pubUser(S.createUser({ name: b.name, email: b.email, password: b.password, role, zone })); }
  catch (e) { if (e.code) throw new HttpError(e.code, e.message); bad(e.message); }
});
route('PATCH', '/api/users/(\\w+)', (req, b, res, [id]) => {
  const a = need(req, 'admin', 'regional'), t = S.user(id) || bad('Utente non trovato', 404);
  if (!manageableUser(a, t)) bad('Non puoi modificare questo account', 403);
  const f = {};
  if (b.name !== undefined) f.name = b.name;
  if (b.active !== undefined) { if (t.id === a.id) bad('Non puoi disattivare il tuo account'); f.active = !!b.active; }
  if (a.role === 'admin') {
    if (b.zone !== undefined) { if (b.zone && !ZONES.includes(b.zone)) bad('Zona non valida'); f.zone = b.zone || null; }
    if (b.role !== undefined && b.role !== t.role) {
      if (t.id === a.id) bad('Non puoi cambiare il tuo ruolo'); f.role = b.role;
    }
  }
  if ((f.active === false || (f.role && f.role !== 'admin')) && t.role === 'admin' && S.countRole('admin') <= 1) bad('Deve restare almeno un amministratore');
  try { return pubUser(S.updateUser(id, f)); } catch (e) { bad(e.message); }
});
route('POST', '/api/users/(\\w+)/password', (req, b, res, [id]) => {
  const a = need(req, 'admin', 'regional'), t = S.user(id) || bad('Utente non trovato', 404);
  if (!manageableUser(a, t)) bad('Non puoi modificare questo account', 403);
  try { S.setPassword(id, b.password); } catch (e) { bad(e.message); }
  return {};
});
route('DELETE', '/api/users/(\\w+)', (req, b, res, [id]) => {
  const a = need(req, 'admin', 'regional'), t = S.user(id) || bad('Utente non trovato', 404);
  if (!manageableUser(a, t)) bad('Non puoi eliminare questo account', 403);
  if (t.id === a.id) bad('Non puoi eliminare il tuo account');
  if (t.role === 'admin' && S.countRole('admin') <= 1) bad('Deve restare almeno un amministratore');
  for (const c of S.comps()) {
    let touched = false;
    if (t.role === 'referee' && (c.referees || []).some(r => r.id === id)) { purgeReferee(c, id); touched = true; }
    if (c.ownerId === id) { c.ownerId = null; touched = true; }
    if (touched) S.saveComp(c);
  }
  S.deleteUser(id); return {};
});
// Elenco arbitri assegnabili alle gare (visibile a chi gestisce gare).
route('GET', '/api/referees', req => { need(req, 'admin', 'regional', 'director'); return S.users('referee').filter(u => u.active).map(u => ({ id: u.id, name: u.name, zone: u.zone })); });

// ---- Competizioni ----
const brief = c => ({ id: c.id, name: c.name, date: c.date, place: c.place, weapon: c.weapon, category: c.category, gender: c.gender || 'M',
  athletes: c.athletes.length, cutPct: c.cutPct || 0, status: status(c), ownerId: c.ownerId, owner: nameOf(c.ownerId), zone: c.zone || 'nazionale', progress: progress(c) });
route('GET', '/api/competitions', () => S.comps().map(brief).sort((a, b) => (b.date || '').localeCompare(a.date || '')));
// Pannello di gestione: admin = tutte (filtro zona), regionale = la propria zona, direttore = le proprie.
route('GET', '/api/manage/competitions', (req, b, res, [], url) => {
  const u = need(req), z = url.searchParams.get('zone');
  return S.comps().filter(c => u.role === 'admin' ? !z || c.zone === z : u.role === 'referee' ? isAssigned(u, c) : canManage(u, c)).map(brief).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
});
route('POST', '/api/competitions', (req, b) => {
  const u = need(req, 'admin', 'regional', 'director'), name = String(b.name || '').trim();
  if (!name) bad('Inserisci il nome della gara');
  let zone = ZONES.includes(b.zone) ? b.zone : 'nazionale';
  if (u.role === 'regional') zone = u.zone;
  if (u.role === 'director' && u.zone) zone = u.zone;
  let ownerId = u.id;
  if (b.ownerId && b.ownerId !== u.id) {
    if (u.role === 'director') bad('Non puoi assegnare la gara ad altri', 403);
    const o = S.user(b.ownerId); if (!o || o.role !== 'director') bad('Direttore non valido');
    if (u.role === 'regional' && o.zone && o.zone !== u.zone) bad('Il direttore non appartiene alla tua zona', 403);
    ownerId = o.id;
  } else if (u.role !== 'director' && b.ownerId === '') ownerId = null;
  const c = { id: uid(), ownerId, name, date: b.date || '', place: String(b.place || ''), weapon: WEAPONS.includes(b.weapon) ? b.weapon : 'spada',
    category: String(b.category || ''), gender: b.gender === 'F' ? 'F' : 'M', zone, cutPct: cutPctOf(b.cutPct), referees: [], athletes: [], pools: null, de: null };
  S.saveComp(c); return { id: c.id };
});
route('PATCH', '/api/competitions/(\\w+)', (req, b, res, [id]) => {
  const c = manage(req, id), u = userOf(req);
  for (const k of ['name', 'place', 'date']) if (b[k] !== undefined) c[k] = String(b[k]).trim();
  if (!c.name) bad('Inserisci il nome della gara');
  if (b.cutPct !== undefined && cutPctOf(b.cutPct) !== (c.cutPct || 0)) { if (c.de) bad('Il tabellone è già stato generato: la quota di eliminati non si cambia'); c.cutPct = cutPctOf(b.cutPct); }
  if (['weapon', 'category', 'gender'].some(k => b[k] !== undefined && b[k] !== c[k])) {
    if (c.pools) bad('Arma, categoria e sesso non si cambiano dopo la generazione dei gironi');
    if (b.weapon !== undefined) c.weapon = WEAPONS.includes(b.weapon) ? b.weapon : c.weapon;
    if (b.category !== undefined) c.category = String(b.category);
    if (b.gender !== undefined) c.gender = b.gender === 'F' ? 'F' : 'M';
    applyRanking(c);
  }
  if (b.zone !== undefined && b.zone !== c.zone) { if (u.role !== 'admin') bad('Solo l\'amministratore sposta una gara in un\'altra zona', 403); if (!ZONES.includes(b.zone)) bad('Zona non valida'); c.zone = b.zone; }
  if (b.ownerId !== undefined && b.ownerId !== c.ownerId) {
    if (u.role === 'director') bad('Solo l\'admin regionale o l\'amministratore riassegnano la gara', 403);
    const o = b.ownerId ? S.user(b.ownerId) : null;
    if (b.ownerId && (!o || o.role !== 'director')) bad('Direttore non valido');
    if (o && u.role === 'regional' && o.zone && o.zone !== u.zone) bad('Il direttore non appartiene alla tua zona', 403);
    c.ownerId = o ? o.id : null;
  }
  S.saveComp(c); return view(c, req);
});
route('GET', '/api/competitions/(\\w+)', (req, b, res, [id]) => view(comp(id), req));
route('DELETE', '/api/competitions/(\\w+)', (req, b, res, [id]) => { manage(req, id); S.removeComp(id); return {}; });

// Iscritti: una riga per atleta "Cognome Nome, Società", in ordine di ranking.
route('POST', '/api/competitions/(\\w+)/athletes', (req, b, res, [id]) => {
  const c = manage(req, id);
  if (c.pools) bad('I gironi sono già stati generati');
  const lines = String(b.text || '').split('\n').map(s => s.trim()).filter(Boolean);
  for (const l of lines) {
    const [name, club, r] = l.split(/[,;\t]/).map(s => s.trim());
    const a = { id: uid(), name, club: club || '', rank: null };
    if (/^\d+$/.test(r || '')) { a.rank = +r; a.manual = true; }
    c.athletes.push(a);
  }
  applyRanking(c); S.saveComp(c); return view(c, req);
});
route('DELETE', '/api/competitions/(\\w+)/athletes/(\\w+)', (req, b, res, [id, aid]) => {
  const c = manage(req, id);
  if (c.pools) bad('I gironi sono già stati generati');
  c.athletes = c.athletes.filter(a => a.id !== aid); S.saveComp(c); return view(c, req);
});
route('POST', '/api/competitions/(\\w+)/athletes/(\\w+)/absent', (req, b, res, [id, aid]) => {
  const c = manage(req, id);
  if (c.pools) bad('I gironi sono già stati generati');
  const a = c.athletes.find(x => x.id === aid) || bad('Atleta non trovato', 404);
  a.absent = !a.absent; S.saveComp(c); return view(c, req);
});
// Carica un file ranking per la categoria/arma/sesso della gara (per gli aggiornamenti in blocco: npm run rankings).
route('POST', '/api/competitions/(\\w+)/ranking', (req, b, res, [id]) => {
  const c = manage(req, id);
  if (c.pools) bad('I gironi sono già stati generati');
  let lists;
  try { lists = R.parseRankingLists(Buffer.from(String(b.file || ''), 'base64'), String(b.filename || '')); } catch (e) { bad(e.message); }
  const best = lists.sort((x, y) => y.entries.length - x.entries.length)[0];
  if (!best) bad('Formato non riconosciuto: servono una colonna con la posizione e una con cognome/nome');
  S.importList({ category: c.category, weapon: c.weapon, gender: c.gender || 'M', entries: best.entries, file: String(b.filename || '') });
  S.comps().filter(x => !x.pools && rankKey(x) === rankKey(c)).forEach(x => { applyRanking(x); S.saveComp(x); });
  return view(c, req);
});
route('GET', '/api/rankings', () => S.rankingLists());

route('POST', '/api/competitions/(\\w+)/pools', (req, b, res, [id]) => {
  const c = manage(req, id);
  c.lots = Object.fromEntries(c.athletes.map(a => [a.id, Math.random()]));
  const act = active(c);
  if (act.length < 4) bad('Servono almeno 4 atleti presenti');
  c.pools = E.buildPools(act, Number(b.poolCount) || 0); c.de = null; S.saveComp(c); return view(c, req);
});
route('DELETE', '/api/competitions/(\\w+)/pools', (req, b, res, [id]) => {
  const c = manage(req, id); c.pools = null; c.de = null; S.saveComp(c); return view(c, req);
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
  S.saveComp(c); return view(c, req);
});

route('POST', '/api/competitions/(\\w+)/de', (req, b, res, [id]) => {
  const c = manage(req, id);
  if (!c.pools) bad('Genera prima i gironi');
  if (c.pools.some(p => p.bouts.some(x => x.sa == null))) bad('Completa tutti gli assalti dei gironi');
  c.de = E.buildBracket(E.ranking(c.pools, active(c), c.lots).map(r => r.id).slice(0, cutInfo(c).qualify)); S.saveComp(c); return view(c, req);
});
route('DELETE', '/api/competitions/(\\w+)/de', (req, b, res, [id]) => {
  const c = manage(req, id); c.de = null; S.saveComp(c); return view(c, req);
});
route('PUT', '/api/competitions/(\\w+)/de/(\\d+)/(\\d+)', (req, b, res, [id, r, i]) => {
  const c = comp(id);
  if (!c.de) bad('Tabellone non generato');
  const match = c.de.rounds[r]?.[i] || bad('Assalto non trovato', 404);
  if (!canScore(req, c, match.refereeId)) bad('Non sei l\'arbitro di questo assalto', 403);
  if (b.forfeit) manage(req, id);
  try { if (b.forfeit) E.setDEForfeit(c.de.rounds, +r, +i, b.forfeit === 'a' ? 'a' : 'b'); else E.setDEScore(c.de.rounds, +r, +i, score(b.sa, 15), score(b.sb, 15)); } catch (e) { if (e instanceof HttpError) throw e; bad(e.message); }
  match.t = Date.now(); S.saveComp(c); return view(c, req);
});


// ---- Arbitri della gara: account con ruolo "referee" assegnati dal direttore ----
function purgeReferee(c, rid) {
  c.referees = (c.referees || []).filter(r => r.id !== rid);
  (c.pools || []).forEach(p => { if (p.refereeId === rid) delete p.refereeId; });
  (c.de?.rounds || []).flat().forEach(m => { if (m.refereeId === rid) delete m.refereeId; });
}
route('POST', '/api/competitions/(\\w+)/referees', (req, b, res, [id]) => {
  const c = manage(req, id), r = S.user(b.userId);
  if (!r || r.role !== 'referee' || !r.active) bad('Arbitro non valido');
  if ((c.referees || []).some(x => x.id === r.id)) bad('Arbitro già assegnato alla gara', 409);
  (c.referees = c.referees || []).push({ id: r.id, name: r.name }); S.saveComp(c); return view(c, req);
});
route('DELETE', '/api/competitions/(\\w+)/referees/(\\w+)', (req, b, res, [id, rid]) => {
  const c = manage(req, id); purgeReferee(c, rid); S.saveComp(c); return view(c, req);
});
const setRef = (c, target, rid) => {
  if (rid && !(c.referees || []).some(r => r.id === rid)) bad('Arbitro non trovato', 404);
  if (rid) target.refereeId = rid; else delete target.refereeId;
};
route('PUT', '/api/competitions/(\\w+)/pools/(\\d+)/referee', (req, b, res, [id, p]) => {
  const c = manage(req, id); setRef(c, c.pools?.[p - 1] || bad('Girone non trovato', 404), b.refereeId); S.saveComp(c); return view(c, req);
});
route('PUT', '/api/competitions/(\\w+)/de/(\\d+)/(\\d+)/referee', (req, b, res, [id, r, i]) => {
  const c = manage(req, id); setRef(c, c.de?.rounds[r]?.[i] || bad('Assalto non trovato', 404), b.refereeId); S.saveComp(c); return view(c, req);
});
// Assegnazione automatica: gironi a rotazione, poi gli assalti del tabellone non ancora giocati.
route('POST', '/api/competitions/(\\w+)/referees/auto', (req, b, res, [id]) => {
  const c = manage(req, id), refs = c.referees || [];
  if (!refs.length) bad('Aggiungi prima almeno un arbitro');
  let k = 0;
  (c.pools || []).forEach(p => { p.refereeId = refs[k++ % refs.length].id; });
  (c.de?.rounds || []).forEach(rd => rd.forEach(m => { if (m.a && m.b && !m.winner) m.refereeId = refs[k++ % refs.length].id; }));
  S.saveComp(c); return view(c, req);
});

// Risultati recenti di tutte le gare, per la pagina principale in tempo reale.
const roundLabel = (size, r) => { const left = size / 2 ** r; return left === 2 ? 'Finale' : left === 4 ? 'Semifinale' : left === 8 ? 'Quarti' : `Tab. dei ${left}`; };
route('GET', '/api/live', () => {
  const out = [];
  for (const c of S.comps()) {
    const nm = Object.fromEntries(c.athletes.map(a => [a.id, a.name]));
    const rn = id => (c.referees || []).find(r => r.id === id)?.name || null;
    (c.pools || []).forEach(p => p.bouts.forEach(b => { if (b.t && b.sa != null) out.push({ t: b.t, c: c.name, cid: c.id, zone: c.zone || 'nazionale', phase: `Girone ${p.index}`, a: nm[b.a], b: nm[b.b], sa: b.sa, sb: b.sb, ref: rn(p.refereeId) }); }));
    (c.de?.rounds || []).forEach((rd, r) => rd.forEach(m => { if (m.t && m.winner && m.a && m.b) out.push({ t: m.t, c: c.name, cid: c.id, zone: c.zone || 'nazionale', phase: roundLabel(c.de.size, r), a: nm[m.a], b: nm[m.b], sa: m.sa, sb: m.sb, forfeit: !!m.forfeit, ref: rn(m.refereeId) }); }));
  }
  return out.sort((x, y) => y.t - x.t).slice(0, 15);
});


// ---- Ricerca pubblica: gare, schermidori e società ----
// Un atleta è identificato dal nome (indipendente dall'ordine di cognome e nome), una società dal nome normalizzato.
// Le anagrafiche arrivano sia dalle gare sia dai ranking importati.
const inProgress = c => { const s = status(c); return s === 'gironi' || s === 'tabellone'; };
const compBrief = (c, a) => ({ id: c.id, name: c.name, date: c.date, place: c.place, weapon: c.weapon, category: c.category, gender: c.gender || 'M',
  zone: c.zone || 'nazionale', status: status(c), live: inProgress(c), progress: progress(c), athlete: a ? { rank: a.rank } : undefined });
function people() {
  const ppl = new Map(), clubs = new Map();
  for (const c of [...S.comps()].sort((x, y) => (x.date || '').localeCompare(y.date || ''))) {
    for (const a of c.athletes) {
      if (a.absent || !a.name) continue;
      const k = R.nameKey(a.name); if (!k) continue;
      const p = ppl.get(k) || { key: k, name: a.name, club: '', comps: [] };
      p.name = a.name; if (a.club) p.club = a.club; p.comps.push([c, a]); ppl.set(k, p);
      if (a.club) { const ck = clubKeyOf(a.club), cl = clubs.get(ck) || { key: ck, name: a.club, athletes: new Set() }; cl.athletes.add(k); clubs.set(ck, cl); }
    }
  }
  return { ppl, clubs };
}
const byDate = (x, y) => (y.live - x.live) || (y.date || '').localeCompare(x.date || '');
const athleteRankings = k => S.athleteRankings(k).map(r => ({ category: r.category, weapon: r.weapon, gender: r.gender, pos: r.pos, season: r.season, file: r.file, updated: r.updated }));
const termsOf = q => R.norm(q).split(' ').filter(Boolean);
route('GET', '/api/search', (req, b, res, [], url) => {
  const q = R.norm(url.searchParams.get('q') || ''); if (q.length < 2) return { competitions: [], athletes: [], clubs: [] };
  const terms = termsOf(q), hit = s => { const n = R.norm(s); return terms.every(t => n.includes(t)); };
  const { ppl, clubs } = people(), ath = new Map();
  for (const p of ppl.values()) if (hit(p.name)) ath.set(p.key, { key: p.key, name: p.name, club: p.club, count: p.comps.length, live: p.comps.some(([c]) => inProgress(c)) });
  for (const r of S.rankedAthletes(terms)) if (!ath.has(r.key)) ath.set(r.key, { key: r.key, name: r.name, club: clubInfo(r.club).name, count: 0, live: false });
  const cl = new Map(), add = (key, name, extra) => { const o = cl.get(key); cl.set(key, { key, name: o?.name || name, sub: o?.sub || extra, count: S.clubAthleteCount(key) || clubs.get(key)?.athletes.size || 0 }); };
  for (const c of clubs.values()) if (hit(c.name)) add(c.key, c.name, '');
  for (const c of S.rankedClubs(terms)) { const i = clubInfo(c.name); add(c.key, i.name, [i.city, i.province].filter(Boolean).join(' · ')); }
  for (const c of S.clubsByName(terms)) { const i = clubInfo(c.code); add(c.key, c.name, [c.city, i.province].filter(Boolean).join(' · ')); }
  return {
    competitions: S.comps().filter(c => hit(`${c.name} ${c.place} ${c.weapon} ${c.category}`)).map(c => compBrief(c)).sort(byDate).slice(0, 30),
    athletes: [...ath.values()].sort((x, y) => y.live - x.live || y.count - x.count || x.name.localeCompare(y.name)).slice(0, 30),
    clubs: [...cl.values()].sort((x, y) => y.count - x.count || x.name.localeCompare(y.name)).slice(0, 30),
  };
});
route('GET', '/api/athletes/([^/]+)', (req, b, res, [key]) => {
  key = decodeURIComponent(key);
  const p = people().ppl.get(key), rankings = athleteRankings(key);
  if (!p && !rankings.length) bad('Schermidore non trovato', 404);
  const rp = S.rankedPerson(key), ci = !p?.club && rp?.club ? clubInfo(rp.club) : null;
  const club = p?.club || ci?.name || '', clubKey = p?.club ? clubKeyOf(p.club) : rp?.club ? R.norm(rp.club) : '';
  return { key, name: p?.name || rp.name, club, clubKey, clubSub: ci ? [ci.city, ci.province].filter(Boolean).join(' · ') : '', rankings, competitions: (p?.comps || []).map(([c, a]) => compBrief(c, a)).sort(byDate) };
});
route('GET', '/api/clubs/([^/]+)', (req, b, res, [key]) => {
  key = decodeURIComponent(key);
  const { ppl, clubs } = people(), cl = clubs.get(key), ranked = S.clubRanked(key), row = S.clubRow(key);
  if (!cl && !ranked.length && !row) bad('Società non trovata', 404);
  const all = new Map();
  for (const k of cl?.athletes || []) all.set(k, ppl.get(k).name);
  for (const r of ranked) if (!all.has(r.key)) all.set(r.key, r.name);
  const i = ranked[0]?.club || row?.code ? clubInfo(row?.code || ranked[0].club) : null;
  return { key, name: row?.name || cl?.name || i?.name, code: row?.code || (ranked[0] ? ranked[0].club : ''), sub: i ? [i.city, i.province].filter(Boolean).join(' · ') : '',
    athletes: [...all].map(([k, name]) => { const p = ppl.get(k);
    return { key: k, name, count: p?.comps.length || 0, live: !!p?.comps.some(([c]) => inProgress(c)), rankings: athleteRankings(k).map(r => ({ category: r.category, weapon: r.weapon, gender: r.gender, pos: r.pos })) }; })
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

const server = http.createServer((req, res) => {
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
});
if (require.main === module) server.listen(PORT, () => console.log(`Touchè su http://localhost:${PORT}`));
module.exports = { server, S };
