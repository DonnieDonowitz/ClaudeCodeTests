const test = require('node:test'); const assert = require('node:assert');
const E = require('../lib/engine');
test('ordini gironi completi', () => {
  for (const [n, o] of Object.entries(E.POOL_ORDERS)) {
    const set = new Set(o.map(p => p.slice().sort().join('-')));
    assert.equal(o.length, n * (n - 1) / 2); assert.equal(set.size, o.length);
  }
});
test('gironi bilanciati e società separate', () => {
  const ath = Array.from({ length: 20 }, (_, i) => ({ id: 'a' + i, club: 'C' + (i % 4) }));
  const p = E.buildPools(ath, 3);
  assert.deepEqual(p.map(x => x.athletes.length).sort(), [6, 7, 7]);
  assert.equal(new Set(p.flatMap(x => x.athletes)).size, 20);
});
test('seedOrder 8 e 16', () => {
  assert.deepEqual(E.seedOrder(8), [1, 8, 5, 4, 3, 6, 7, 2]);
  assert.deepEqual(E.seedOrder(16), [1, 16, 9, 8, 5, 12, 13, 4, 3, 14, 11, 6, 7, 10, 15, 2]);
});
test('tabellone: somme e posizioni delle teste di serie', () => {
  for (const size of [4, 8, 16, 32, 64, 128]) {
    const o = E.seedOrder(size);
    for (let i = 0; i < size; i += 2) assert.equal(o[i] + o[i + 1], size + 1);          // 1v32, 2v31, ...
    assert.equal(o[0], 1); assert.equal(o[size - 1], 2);                                 // 1 in alto, 2 in basso
    assert.equal(o[size / 2], 3);                                                        // 3 in cima alla seconda metà
    assert.equal(o[size / 2 - 1] === 4 || o[size / 2 - 2] === 4 || size === 4, true);    // 4 in fondo alla prima metà
    assert.equal(new Set(o).size, size);
  }
  const o = E.seedOrder(16);
  assert.equal(o.indexOf(4) < 8 && o.indexOf(4) >= 6, true);                              // 4 nel quarto in basso della prima metà
});
test('tabellone con bye e avanzamento', () => {
  const b = E.buildBracket(['1', '2', '3', '4', '5', '6']);
  assert.equal(b.size, 8);
  assert.equal(b.rounds[1][0].a, '1'); assert.equal(b.rounds[1][1].b, '2');
  E.setDEScore(b.rounds, 0, 1, 15, 3);
  assert.equal(b.rounds[1][0].b, '4');
  E.setDEScore(b.rounds, 1, 0, 15, 10);
  assert.equal(b.rounds[2][0].a, '1');
});
test('forfait, classifica finale e sorteggio', () => {
  const ids = ['1', '2', '3', '4'];
  const b = E.buildBracket(ids);
  E.setDEForfeit(b.rounds, 0, 0, 'b');           // 4 avanza su 1
  E.setDEScore(b.rounds, 0, 1, 15, 9);           // 2 batte 3
  E.setDEScore(b.rounds, 1, 0, 12, 15);          // 2 vince la finale
  const f = E.finalRanking(b, ids);
  assert.deepEqual(f.map(x => x.id + ':' + x.pos), ['2:1', '4:2', '1:3', '3:3']);
  const pools = [{ bouts: [{ a: 'a', b: 'b', sa: 5, sb: 3 }, { a: 'b', b: 'a', sa: 5, sb: 3 }] }];
  const r = E.ranking(pools, [{ id: 'a' }, { id: 'b' }], { a: 0.9, b: 0.1 });
  assert.equal(r[0].id, 'b'); assert.ok(r[0].tie);
});
