'use strict';
// Gestione account (admin: tutti; admin regionale: direttori e arbitri della propria zona).
module.exports = (route, ctx) => {
  const { S, E, R, Store, HttpError, bad, CATEGORIES, CAT_ORDER, REGIONS, WEAPONS, WEAPON_ORDER, ZONES, active, applyRanking, athleteRankings, brief, byDate, canManage, canScore, clubInfo, clubKeyOf, comp, compBrief, cutInfo, cutPctOf, groupBriefs, inProgress, isAssigned, manage, nameOf, need, parseCookie, people, progress, pubUser, purgeReferee, rankKey, rk, score, setCookie, status, termsOf, throttle, uid, userOf, variantOf, variantSort, view } = ctx;

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

};
