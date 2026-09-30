'use strict';
// Dati pubblici (in cache): ranking, risultati in diretta, ricerca, schermidori, società, loghi.
const fs = require('fs'), path = require('path');
const { describeColumns } = require('../lib/rankingCodes');
const PUBLIC = path.join(__dirname, '..', 'public');
module.exports = (route, ctx) => {
  const { S, E, R, Store, HttpError, bad, CATEGORIES, CAT_ORDER, REGIONS, WEAPONS, WEAPON_ORDER, ZONES, active, applyRanking, athleteRankings, brief, byDate, canManage, canScore, clubInfo, clubKeyOf, comp, compBrief, cutInfo, cutPctOf, groupBriefs, inProgress, isAssigned, manage, nameOf, need, parseCookie, people, progress, pubUser, purgeReferee, rankKey, rk, score, setCookie, status, termsOf, throttle, uid, userOf, variantOf, variantSort, view } = ctx;

  route('GET', '/api/rankings', () => S.rankingLists());
  // Classifica completa di una lista con il dettaglio dei punteggi per gara (?q=cerca, ?offset=, ?a=chiave-atleta per aprire la pagina in cui compare).
  route('GET', '/api/rankings/([^/]+)', (req, b, res, [key], url) => {
    key = decodeURIComponent(key);
    const d = S.rankingDetail(key) || bad('Ranking non trovato', 404);
    const limit = 50, terms = termsOf(url.searchParams.get('q') || ''), a = url.searchParams.get('a');
    let offset = Math.max(0, parseInt(url.searchParams.get('offset'), 10) || 0);
    if (a && !terms.length) { const pos = S.rankingPos(key, a); if (pos) offset = Math.floor((pos - 1) / limit) * limit; }
    const { total, rows } = S.rankingRows(key, { q: terms, offset, limit });
    const { columns, legend, ...meta } = d;
    return { ...meta, file_hash: undefined, columns: describeColumns(columns, legend), legend, offset, limit, matches: total,
      rows: rows.map(r => ({ ...r, clubName: r.club ? clubInfo(r.club).name : '', clubKey: R.norm(r.club), born: r.born })) };
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
      competitions: groupBriefs(S.comps().filter(c => hit(`${c.name} ${c.place} ${c.weapon} ${c.category}`))).map(g => ({ ...g, live: g.status === 'gironi' || g.status === 'tabellone' })).sort(byDate).slice(0, 30),
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

};
