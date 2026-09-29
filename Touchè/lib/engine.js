'use strict';
// Logica pura: gironi, classifiche, tabellone a eliminazione diretta.

// Ordini ufficiali degli assalti nei gironi (posizioni 1-based).
const POOL_ORDERS = {
  3: [[1,2],[1,3],[2,3]],
  4: [[1,4],[2,3],[1,3],[2,4],[3,4],[1,2]],
  5: [[1,2],[3,4],[5,1],[2,3],[5,4],[1,3],[2,5],[4,1],[3,5],[4,2]],
  6: [[1,2],[4,5],[2,3],[5,6],[3,1],[6,4],[2,5],[1,4],[5,3],[1,6],[4,2],[3,6],[5,1],[3,4],[6,2]],
  7: [[1,4],[2,5],[3,6],[7,1],[5,4],[2,3],[6,7],[5,1],[4,3],[6,2],[5,7],[3,1],[4,6],[7,2],[3,5],[1,6],[2,4],[7,3],[1,2],[4,7],[6,5]],
};

function poolOrder(n) {
  if (POOL_ORDERS[n]) return POOL_ORDERS[n];
  const out = [];
  for (let i = 1; i <= n; i++) for (let j = i + 1; j <= n; j++) out.push([i, j]);
  return out;
}

function defaultPoolCount(n) {
  if (n < 6) return 1;
  return Math.ceil(n / 7);
}

// Distribuzione a serpentina per ranking + separazione delle società
// tramite scambi all'interno della stessa "fascia" (mantiene l'equilibrio).
function buildPools(athletes, poolCount) {
  const n = athletes.length;
  const k = Math.max(1, Math.min(poolCount || defaultPoolCount(n), Math.floor(n / 2) || 1));
  const pools = Array.from({ length: k }, () => []);
  const tiers = [];
  athletes.forEach((a, i) => {
    const row = Math.floor(i / k);
    const col = row % 2 === 0 ? i % k : k - 1 - (i % k);
    pools[col].push(a);
    (tiers[row] = tiers[row] || []).push({ col, a });
  });
  const cost = () => pools.reduce((s, p) => {
    const c = {};
    p.forEach(a => { if (a.club) c[a.club] = (c[a.club] || 0) + 1; });
    return s + Object.values(c).reduce((x, v) => x + v * (v - 1) / 2, 0);
  }, 0);
  let cur = cost();
  for (let pass = 0; pass < 6 && cur > 0; pass++) {
    let improved = false;
    for (const tier of tiers) {
      for (let x = 0; x < tier.length; x++) for (let y = x + 1; y < tier.length; y++) {
        const A = tier[x], B = tier[y];
        if (A.col === B.col) continue;
        const ia = pools[A.col].indexOf(A.a), ib = pools[B.col].indexOf(B.a);
        pools[A.col][ia] = B.a; pools[B.col][ib] = A.a;
        const c = cost();
        if (c < cur) { cur = c; improved = true; [A.a, B.a] = [B.a, A.a]; }
        else { pools[A.col][ia] = A.a; pools[B.col][ib] = B.a; }
      }
    }
    if (!improved) break;
  }
  return pools.map((p, i) => ({
    index: i + 1,
    athletes: p.map(a => a.id),
    bouts: poolOrder(p.length).map(([x, y]) => ({ a: p[x - 1].id, b: p[y - 1].id, sa: null, sb: null })),
  }));
}

function poolStats(pools, athletes) {
  const st = {};
  athletes.forEach(a => { st[a.id] = { id: a.id, v: 0, m: 0, ts: 0, tr: 0 }; });
  for (const p of pools) for (const b of p.bouts) {
    if (b.sa == null || b.sb == null) continue;
    const A = st[b.a], B = st[b.b];
    A.m++; B.m++; A.ts += b.sa; A.tr += b.sb; B.ts += b.sb; B.tr += b.sa;
    if (b.sa > b.sb) A.v++; else B.v++;
  }
  return st;
}

// Classifica dopo i gironi: V/M, indice (TS-TR), TS, poi ranking iniziale.
function ranking(pools, athletes, lots = {}) {
  const st = poolStats(pools, athletes);
  const seed = new Map(athletes.map((a, i) => [a.id, i]));
  return Object.values(st).map(s => ({
    ...s, ratio: s.m ? s.v / s.m : 0, ind: s.ts - s.tr,
  })).sort((x, y) => y.ratio - x.ratio || y.ind - x.ind || y.ts - x.ts || (lots[x.id] ?? 0) - (lots[y.id] ?? 0) || seed.get(x.id) - seed.get(y.id))
    .map((s, i, arr) => ({ ...s, rank: i + 1, tie: [arr[i - 1], arr[i + 1]].some(o => o && o.ratio === s.ratio && o.ind === s.ind && o.ts === s.ts) }));
}

// Posizioni delle teste di serie nel tabellone (dall'alto in basso). Ogni raddoppio sostituisce la
// testa di serie s con la coppia (s, 2m+1-s), alternando l'ordine: 1 in alto, 2 in basso, 3 in cima alla
// seconda metà, 4 in fondo alla prima, ecc. Ogni assalto del primo turno somma sempre size+1.
function seedOrder(size) {
  let s = [1, 2];
  while (s.length < size) {
    const total = s.length * 2 + 1;
    s = s.flatMap((x, i) => (i % 2 === 0 ? [x, total - x] : [total - x, x]));
  }
  return s;
}

// rankedIds: id ordinati per classifica. Restituisce i turni del tabellone.
function buildBracket(rankedIds) {
  const n = rankedIds.length;
  let size = 2; while (size < n) size *= 2;
  const order = seedOrder(size);
  const first = [];
  for (let i = 0; i < size; i += 2) {
    const [x, y] = [order[i], order[i + 1]].sort((p, q) => p - q); // la testa di serie migliore in alto
    const a = rankedIds[x - 1] ?? null, b = rankedIds[y - 1] ?? null;
    first.push({ a, b, sa: null, sb: null, winner: null });
  }
  const rounds = [first];
  for (let len = size / 4; len >= 1; len /= 2) {
    rounds.push(Array.from({ length: len }, () => ({ a: null, b: null, sa: null, sb: null, winner: null })));
  }
  rounds.forEach((_, r) => rounds[r].forEach((_, i) => settle(rounds, r, i)));
  return { size, rounds };
}

// Risolve bye e propaga i vincitori.
function settle(rounds, r, i) {
  const m = rounds[r][i];
  if (r === 0 && !m.winner) {
    if (m.a && !m.b) m.winner = m.a; else if (m.b && !m.a) m.winner = m.b;
  }
  if (m.winner && r + 1 < rounds.length) {
    const nxt = rounds[r + 1][i >> 1];
    const side = i % 2 === 0 ? 'a' : 'b';
    if (nxt[side] !== m.winner) {
      nxt[side] = m.winner;
      if (nxt.winner && ![nxt.a, nxt.b].includes(nxt.winner)) resetMatch(rounds, r + 1, i >> 1);
    }
  }
}

function resetMatch(rounds, r, i) {
  const m = rounds[r][i];
  m.sa = m.sb = m.winner = null;
  if (r + 1 < rounds.length) {
    const nxt = rounds[r + 1][i >> 1];
    const side = i % 2 === 0 ? 'a' : 'b';
    nxt[side] = null;
    if (nxt.winner) resetMatch(rounds, r + 1, i >> 1);
  }
}

function setWinner(rounds, r, i, w) {
  const m = rounds[r][i];
  const changed = m.winner && m.winner !== w;
  m.winner = w;
  if (r + 1 < rounds.length) {
    const nxt = rounds[r + 1][i >> 1];
    const side = i % 2 === 0 ? 'a' : 'b';
    if (changed && nxt.winner) resetMatch(rounds, r + 1, i >> 1);
    nxt[side] = w;
  }
}

function setDEScore(rounds, r, i, sa, sb) {
  const m = rounds[r]?.[i];
  if (!m || !m.a || !m.b) throw new Error('Assalto non disponibile');
  if (sa === sb) throw new Error('Il pareggio non è ammesso');
  m.sa = sa; m.sb = sb; m.forfeit = false;
  setWinner(rounds, r, i, sa > sb ? m.a : m.b);
}

// Vittoria a tavolino (ritiro/infortunio): side = lato che vince.
function setDEForfeit(rounds, r, i, side) {
  const m = rounds[r]?.[i];
  if (!m || !m.a || !m.b) throw new Error('Assalto non disponibile');
  m.sa = m.sb = null; m.forfeit = true;
  setWinner(rounds, r, i, side === 'a' ? m.a : m.b);
}

// Classifica finale: 1°, 2°, due 3° ex aequo (semifinali), poi per turno di uscita e classifica gironi.
function finalRanking(de, poolRank) {
  const out = []; const seen = new Set();
  const push = (id, pos, tie) => { if (id && !seen.has(id)) { seen.add(id); out.push({ id, pos, tie: !!tie }); } };
  const R = de.rounds, last = R.length - 1;
  const fin = R[last][0];
  if (!fin.winner) return [];
  push(fin.winner, 1); push(fin.a === fin.winner ? fin.b : fin.a, 2);
  let pos = 3;
  for (let r = last - 1; r >= 0; r--) {
    const losers = R[r].filter(m => m.winner && m.a && m.b).map(m => (m.a === m.winner ? m.b : m.a));
    losers.sort((x, y) => poolRank.indexOf(x) - poolRank.indexOf(y));
    const tie = r === last - 1 || losers.length > 1 && r === last - 1;
    losers.forEach(id => push(id, pos, r === last - 1));
    pos += losers.length;
  }
  return out;
}

module.exports = { POOL_ORDERS, poolOrder, defaultPoolCount, buildPools, poolStats, ranking, seedOrder, buildBracket, setDEScore, setDEForfeit, finalRanking };
