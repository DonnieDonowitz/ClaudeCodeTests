'use strict';
// Accesso: login, logout, profilo, cambio password.
module.exports = (route, ctx) => {
  const { S, E, R, Store, HttpError, bad, CATEGORIES, CAT_ORDER, REGIONS, WEAPONS, WEAPON_ORDER, ZONES, active, applyRanking, athleteRankings, brief, byDate, canManage, canScore, clubInfo, clubKeyOf, comp, compBrief, cutInfo, cutPctOf, groupBriefs, inProgress, isAssigned, manage, nameOf, need, parseCookie, people, progress, pubUser, purgeReferee, rankKey, rk, score, setCookie, status, termsOf, throttle, uid, userOf, variantOf, variantSort, view } = ctx;

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

};
