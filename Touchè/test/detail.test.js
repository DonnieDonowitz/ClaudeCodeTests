const test = require('node:test'), assert = require('node:assert');
const { poolBouts, assembleBracket, parseTree } = require('../lib/resultsDetail');
const E = require('../lib/engine');

test('girone: V, vittoria a tempo (v4), priorità a pari stoccate (v3) e assenti', () => {
  const pool = { rows: [
    { pos: 1, cells: { 2: 'V', 3: 'v3', 4: '0' }, ts: 8 },
    { pos: 2, cells: { 1: '2', 3: 'v4', 4: '1' }, ts: 7 },
    { pos: 3, cells: { 1: '3', 2: '1', 4: 'A' }, ts: 4 },
    { pos: 4, cells: { 1: 'V', 2: 'V', 3: 'A' }, ts: 10 },
  ] };
  const b = poolBouts(pool);
  const f = (i, j) => b.find(x => x.ai === i && x.bi === j);
  assert.deepEqual(f(1, 2), { ai: 1, bi: 2, sa: 5, sb: 2 });
  assert.deepEqual(f(1, 3), { ai: 1, bi: 3, sa: 3, sb: 3, w: 'a' });
  assert.equal(f(2, 3).sa, 4);
  assert.equal(f(3, 4), undefined); // assalto con assente: non conta
  // la classifica del motore tiene conto della priorità
  const ids = ['a', 'b', 'c', 'd'], pools = [{ bouts: b.map(x => ({ a: ids[x.ai - 1], b: ids[x.bi - 1], sa: x.sa, sb: x.sb, w: x.w })) }];
  const st = E.poolStats(pools, ids.map(id => ({ id })));
  assert.equal(st.a.v, 2); assert.equal(st.c.v, 0);
});

test('tabellone ricostruito dai risultati (albero)', () => {
  const byName = { A: 'a', B: 'b', C: 'c', D: 'd' }, resolve = n => byName[n] || null;
  const m = (a, sa, b, sb) => ({ a: { name: a, score: sa }, b: b ? { name: b, score: sb } : null });
  const br = assembleBracket({ 4: [m('A', 15, 'D', 3), m('C', 10, 'B', 15)], 2: [m('A', 15, 'B', 12)] }, resolve);
  assert.equal(br.size, 4);
  assert.deepEqual(br.rounds[0].map(x => x.winner), ['a', 'b']);
  assert.equal(br.rounds[1][0].winner, 'a');
});

test('albero disegnato: colonne e punteggi dalle coordinate', () => {
  const it = (x, y, s, w = 100) => ({ x, y, s, w });
  const page = { items: [
    it(39, 548, 'ROSSI MARIO - RMFFO (Roma)'), it(157, 548, '15', 7), it(23, 546, '1', 4),
    it(39, 536, 'BIANCHI LUCA - MIPIT (Milano)'), it(157, 536, '10', 7), it(23, 534, '4', 4),
    it(39, 515, 'VERDI ANNA - TOPIN (Torino)'), it(157, 515, '8', 7),
    it(39, 503, 'NERI GINO - PDCOM (Padova)'), it(157, 503, '15', 7),
    it(171, 542, 'ROSSI MARIO - RMFFO (Roma)'), it(292, 542, '15', 7),
    it(171, 509, 'NERI GINO - PDCOM (Padova)'), it(292, 509, '9', 7),
    it(306, 527, 'ROSSI MARIO - RMFFO (Roma)'),
  ] };
  const cols = parseTree(page);
  assert.deepEqual(cols.map(c => c.length), [4, 2, 1]);
  assert.deepEqual(cols[0].map(e => [e.name, e.score, e.seed]), [['ROSSI MARIO', 15, 1], ['BIANCHI LUCA', 10, 4], ['VERDI ANNA', 8, null], ['NERI GINO', 15, null]]);
  assert.equal(cols[1][1].score, 9);
});
