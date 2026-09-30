'use strict';
// Logica di dominio condivisa dalle route: permessi, viste delle gare, indici di ricerca.
const E = require('./engine');
const R = require('./ranking');
const Store = require('./store');
const { provinceOf } = require('./clubs');
const { HttpError, bad } = require('./http');

module.exports = function createContext(S) {
  const REGIONS = ['abruzzo', 'basilicata', 'calabria', 'campania', 'emilia-romagna', 'friuli-venezia-giulia', 'lazio', 'liguria', 'lombardia', 'marche', 'molise', 'piemonte', 'puglia', 'sardegna', 'sicilia', 'toscana', 'trentino-alto-adige', 'umbria', 'valle-d-aosta', 'veneto'];
  const ZONES = ['nazionale', 'master', ...REGIONS];
  const uid = Store.uid;

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
  const status = c => c.imported ? 'concluso' : c.de ? (c.de.rounds.at(-1)[0].winner ? 'concluso' : 'tabellone') : c.pools ? 'gironi' : 'iscrizioni';
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
    if (c.group) out.siblings = S.comps().filter(x => x.group?.id === c.group.id).map(variantOf).sort(variantSort);
    if (c.imported) { out.final = c.imported.final; out.source = { name: 'Federscherma', url: c.imported.url, provisional: c.imported.state === 'provvisoria' }; delete out.imported; }
    if (c.pools) {
      // gare importate: in classifica gironi solo chi ha tirato; "passa" chi compare nel tabellone
      const inPools = new Set(c.pools.flatMap(p => p.athletes)), act = c.imported ? active(c).filter(a => inPools.has(a.id)) : active(c);
      const deSet = c.imported && c.de ? new Set(c.de.rounds[0].flatMap(m => [m.a, m.b]).filter(Boolean)) : null;
      if (deSet) { const n = act.length, q = act.filter(a => deSet.has(a.id)).length; out.cut = { pct: n ? Math.round(100 * (n - q) / n) : 0, total: n, qualify: q, eliminated: n - q }; }
      out.ranking = E.ranking(c.pools, act, c.lots).map((r, i) => ({ ...r, qualified: deSet ? deSet.has(r.id) : i < out.cut.qualify }));
      if (deSet) out.ranking.sort((a, b) => b.qualified - a.qualified || a.rank - b.rank);
      if (c.de && !c.imported) { const ids = out.ranking.map(r => r.id); out.final = E.finalRanking(c.de, ids, ids.slice(out.cut.qualify)); }
    }
    return out;
  }
  const score = (v, max) => { const n = Number(v); if (!Number.isInteger(n) || n < 0 || n > max) bad('Punteggio non valido'); return n; };
  const pubUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, zone: u.zone });

  // ---- Competizioni ----
  const brief = c => ({ id: c.id, name: c.name, date: c.date, place: c.place, weapon: c.weapon, category: c.category, gender: c.gender || 'M',
    athletes: c.athletes.length, cutPct: c.cutPct || 0, status: status(c), ownerId: c.ownerId, owner: nameOf(c.ownerId), zone: c.zone || 'nazionale', progress: progress(c) });
  // Le gare importate con lo stesso titolo (categorie/armi/sessi diversi) formano un'unica gara con più "varianti".
  const WEAPON_ORDER = ['spada', 'fioretto', 'sciabola'], CAT_ORDER = c => { const i = CATEGORIES.findIndex(x => Store.slug(x) === Store.slug(c)); return i < 0 ? 99 : i; };
  const variantSort = (a, b) => CAT_ORDER(a.category) - CAT_ORDER(b.category) || a.category.localeCompare(b.category, 'it', { numeric: true }) || WEAPON_ORDER.indexOf(a.weapon) - WEAPON_ORDER.indexOf(b.weapon) || (a.gender === b.gender ? 0 : a.gender === 'M' ? -1 : 1);
  const variantOf = c => ({ id: c.id, weapon: c.weapon, gender: c.gender || 'M', category: c.category, athletes: c.athletes.length });
  function groupBriefs(comps) {
    const out = [], groups = new Map();
    for (const c of comps) {
      if (!c.group) { out.push(brief(c)); continue; }
      let g = groups.get(c.group.id);
      if (!g) { g = { ...brief(c), athletes: 0, variants: [], dateFrom: c.date, dateTo: c.date }; groups.set(c.group.id, g); out.push(g); }
      g.variants.push(variantOf(c)); g.athletes += c.athletes.length;
      if (c.date < g.dateFrom) g.dateFrom = c.date; if (c.date > g.dateTo) g.dateTo = c.date;
    }
    for (const g of groups.values()) { g.variants.sort(variantSort); g.id = g.variants[0].id; g.weapon = ''; g.category = ''; g.gender = ''; g.date = g.dateFrom; }
    return out;
  }
  function purgeReferee(c, rid) {
    c.referees = (c.referees || []).filter(r => r.id !== rid);
    (c.pools || []).forEach(p => { if (p.refereeId === rid) delete p.refereeId; });
    (c.de?.rounds || []).flat().forEach(m => { if (m.refereeId === rid) delete m.refereeId; });
  }
  // ---- Ricerca pubblica: gare, schermidori e società ----
  // Un atleta è identificato dal nome (indipendente dall'ordine di cognome e nome), una società dal nome normalizzato.
  // Le anagrafiche arrivano sia dalle gare sia dai ranking importati.
  const inProgress = c => { const s = status(c); return s === 'gironi' || s === 'tabellone'; };
  const compBrief = (c, a) => ({ id: c.id, name: c.name, date: c.date, place: c.place, weapon: c.weapon, category: c.category, gender: c.gender || 'M',
    zone: c.zone || 'nazionale', status: status(c), live: inProgress(c), progress: progress(c), athlete: a ? { rank: a.rank } : undefined });
  // Indice di atleti e società dalle gare: ricalcolato solo quando i dati cambiano.
  let peopleCache = null;
  function people() {
    if (!peopleCache || peopleCache.v !== S.version()) peopleCache = { v: S.version(), data: computePeople() };
    return peopleCache.data;
  }
  function computePeople() {
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

  return { S, E, R, Store, HttpError, bad, CATEGORIES, CAT_ORDER, REGIONS, WEAPONS, WEAPON_ORDER, ZONES, active, applyRanking, athleteRankings, brief, byDate, canManage, canScore, clubInfo, clubKeyOf, comp, compBrief, cutInfo, cutPctOf, groupBriefs, inProgress, isAssigned, manage, nameOf, need, parseCookie, people, progress, pubUser, purgeReferee, rankKey, rk, score, setCookie, status, termsOf, throttle, uid, userOf, variantOf, variantSort, view };
};
