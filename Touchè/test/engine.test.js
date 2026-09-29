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
test('seedOrder 8', () => assert.deepEqual(E.seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]));
test('tabellone con bye e avanzamento', () => {
  const b = E.buildBracket(['1', '2', '3', '4', '5', '6']);
  assert.equal(b.size, 8);
  assert.equal(b.rounds[1][0].a, '1'); assert.equal(b.rounds[1][1].a, '2');
  E.setDEScore(b.rounds, 0, 1, 15, 3);
  assert.equal(b.rounds[1][0].b, '4');
  E.setDEScore(b.rounds, 1, 0, 15, 10);
  assert.equal(b.rounds[2][0].a, '1');
});
