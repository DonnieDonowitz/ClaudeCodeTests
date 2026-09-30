process.env.TOUCHE_DB = ':memory:';
const test = require('node:test'), assert = require('node:assert');
const { server, S } = require('../server');

let base, cookies = {};
test.before(() => new Promise(r => server.listen(0, () => { base = 'http://127.0.0.1:' + server.address().port; r(); })));
test.after(() => server.close());
async function call(as, method, url, body) {
  const r = await fetch(base + '/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(cookies[as] ? { Cookie: cookies[as] } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookies[as] = sc.split(';')[0];
  return { status: r.status, body: await r.json().catch(() => null) };
}
const login = async (as, email) => assert.equal((await call(as, 'POST', '/login', { email, password: 'password1' })).status, 200);

test('permessi per ruolo', async () => {
  const mk = (name, role, zone) => S.createUser({ name, email: name.toLowerCase() + '@x.it', password: 'password1', role, zone });
  mk('Admin', 'admin'); mk('RegMarche', 'regional', 'marche'); mk('RegLazio', 'regional', 'lazio'); const dir = mk('Dir', 'director'); const ref = mk('Arb', 'referee');
  for (const n of ['admin', 'regmarche', 'reglazio', 'dir', 'arb']) await login(n, n + '@x.it');
  assert.equal((await call('x', 'GET', '/users')).status, 401);
  assert.equal((await call('dir', 'GET', '/users')).status, 403);
  assert.equal((await call('x', 'POST', '/login', { email: 'dir@x.it', password: 'errata' })).status, 401);

  // l'admin regionale crea direttori e arbitri solo nella propria zona, mai admin
  assert.equal((await call('regmarche', 'POST', '/users', { name: 'X', email: 'x@x.it', password: 'password1', role: 'admin' })).status, 403);
  const d2 = await call('regmarche', 'POST', '/users', { name: 'D2', email: 'd2@x.it', password: 'password1', role: 'director', zone: 'lazio' });
  assert.equal(d2.body.zone, 'marche');
  assert.equal((await call('reglazio', 'DELETE', '/users/' + d2.body.id)).status, 403);

  // gara del direttore: la gestisce lui e l'admin della sua zona, non un'altra regione
  const c = await call('dir', 'POST', '/competitions', { name: 'Gara', zone: 'marche', weapon: 'spada', category: 'Assoluti' });
  const id = c.body.id;
  assert.equal((await call('reglazio', 'DELETE', '/competitions/' + id)).status, 403);
  assert.equal((await call('arb', 'POST', `/competitions/${id}/athletes`, { text: 'Rossi Mario' })).status, 403);
  assert.equal((await call('regmarche', 'PATCH', '/competitions/' + id, { ownerId: d2.body.id })).status, 200);
  assert.equal((await call('dir', 'POST', `/competitions/${id}/athletes`, { text: 'Rossi Mario' })).status, 403); // non è più sua
  assert.equal((await call('regmarche', 'PATCH', '/competitions/' + id, { ownerId: dir.id })).status, 200);

  // arbitro: inserisce solo i risultati dei propri gironi
  await call('dir', 'POST', `/competitions/${id}/athletes`, { text: 'A One, C1\nB Two, C2\nC Three, C1\nD Four, C2\nE Five, C3' });
  assert.equal((await call('dir', 'POST', `/competitions/${id}/pools`, { poolCount: 1 })).status, 200);
  assert.equal((await call('arb', 'PUT', `/competitions/${id}/pools/1/bouts/0`, { sa: 5, sb: 1 })).status, 403);
  assert.equal((await call('dir', 'POST', `/competitions/${id}/referees`, { userId: ref.id })).status, 200);
  assert.equal((await call('dir', 'PUT', `/competitions/${id}/pools/1/referee`, { refereeId: ref.id })).status, 200);
  assert.equal((await call('arb', 'PUT', `/competitions/${id}/pools/1/bouts/0`, { sa: 5, sb: 1 })).status, 200);
  assert.equal((await call('x', 'PUT', `/competitions/${id}/pools/1/bouts/1`, { sa: 5, sb: 1 })).status, 401);
  assert.equal((await call('x', 'GET', '/competitions/' + id)).body.referee, null); // lettura pubblica

  // disattivare un account chiude le sessioni; l'ultimo admin non si elimina
  assert.equal((await call('admin', 'PATCH', '/users/' + ref.id, { active: false })).status, 200);
  assert.equal((await call('arb', 'GET', '/me')).body, null);
  const me = (await call('admin', 'GET', '/me')).body;
  assert.equal((await call('admin', 'DELETE', '/users/' + me.id)).status, 400);
});

test('quota di eliminati dopo i gironi', async () => {
  S.createUser({ name: 'Dir2', email: 'dir2@x.it', password: 'password1', role: 'director' }); await login('dir2', 'dir2@x.it');
  const id = (await call('dir2', 'POST', '/competitions', { name: 'Con taglio', weapon: 'spada', category: 'Assoluti', cutPct: 25 })).body.id;
  await call('dir2', 'POST', `/competitions/${id}/athletes`, { text: Array.from({ length: 8 }, (_, i) => `Atleta${'ABCDEFGH'[i]} Nome, Club`).join('\n') });
  let v = (await call('dir2', 'GET', '/competitions/' + id)).body;
  assert.deepEqual([v.cut.pct, v.cut.qualify, v.cut.eliminated], [25, 6, 2]);
  v = (await call('dir2', 'POST', `/competitions/${id}/pools`, { poolCount: 2 })).body;
  v.pools.forEach((p, pi) => p.bouts.forEach((b, i) => { b._p = pi + 1; b._i = i; }));
  for (const [pi, p] of v.pools.entries()) for (const [i] of p.bouts.entries()) await call('dir2', 'PUT', `/competitions/${id}/pools/${pi + 1}/bouts/${i}`, { sa: 5, sb: 1 });
  v = (await call('dir2', 'GET', '/competitions/' + id)).body;
  assert.equal(v.ranking.filter(r => r.qualified).length, 6);
  v = (await call('dir2', 'POST', `/competitions/${id}/de`)).body;
  const inBracket = new Set(v.de.rounds[0].flatMap(m => [m.a, m.b]).filter(Boolean));
  assert.equal(inBracket.size, 6);
  assert.equal((await call('dir2', 'PATCH', '/competitions/' + id, { cutPct: 50 })).status, 400);
  for (let r = 0; r < v.de.rounds.length; r++) for (let i = 0; i < v.de.rounds[r].length; i++) {
    const m = (await call('dir2', 'GET', '/competitions/' + id)).body.de.rounds[r][i];
    if (m.a && m.b && !m.winner) await call('dir2', 'PUT', `/competitions/${id}/de/${r}/${i}`, { sa: 15, sb: 3 });
  }
  v = (await call('dir2', 'GET', '/competitions/' + id)).body;
  assert.equal(v.final.length, 8);
  const tail = v.final.slice(-2).map(f => f.id), elim = v.ranking.filter(r => !r.qualified).map(r => r.id);
  assert.deepEqual(tail, elim);
  assert.equal(v.final.at(-1).pos, 7);
});
