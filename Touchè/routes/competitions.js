'use strict';
// Gare: creazione e gestione, iscritti, gironi, tabellone, arbitri.
module.exports = (route, ctx) => {
  const { S, E, R, Store, HttpError, bad, CATEGORIES, CAT_ORDER, REGIONS, WEAPONS, WEAPON_ORDER, ZONES, active, applyRanking, athleteRankings, brief, byDate, canManage, canScore, clubInfo, clubKeyOf, comp, compBrief, cutInfo, cutPctOf, groupBriefs, inProgress, isAssigned, manage, nameOf, need, parseCookie, people, progress, pubUser, purgeReferee, rankKey, rk, score, setCookie, status, termsOf, throttle, uid, userOf, variantOf, variantSort, view } = ctx;

  route('GET', '/api/competitions', () => groupBriefs(S.comps()).sort((a, b) => (b.date || '').localeCompare(a.date || '')));
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
    if (c.imported) bad('Gara importata dalla Federscherma: i risultati non si modificano', 403);
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
    if (c.imported) bad('Gara importata dalla Federscherma: i risultati non si modificano', 403);
    if (!canScore(req, c, match.refereeId)) bad('Non sei l\'arbitro di questo assalto', 403);
    if (b.forfeit) manage(req, id);
    try { if (b.forfeit) E.setDEForfeit(c.de.rounds, +r, +i, b.forfeit === 'a' ? 'a' : 'b'); else E.setDEScore(c.de.rounds, +r, +i, score(b.sa, 15), score(b.sb, 15)); } catch (e) { if (e instanceof HttpError) throw e; bad(e.message); }
    match.t = Date.now(); S.saveComp(c); return view(c, req);
  });


  // ---- Arbitri della gara: account con ruolo "referee" assegnati dal direttore ----
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

};
