'use strict';
// Lettura "grafica" dei PDF dei risultati: gironi (tabelle con la griglia degli assalti) e tabelloni a eliminazione diretta
// (elenchi di assalti o alberi disegnati). Si usano le coordinate del testo per capire righe, colonne e accoppiamenti.
const { norm } = require('./ranking');

const SIG = '[A-Z][A-Z0-9]{2,5}';
const TIGHT = new RegExp(`^(.+?)-(${SIG}) \\((.+)\\)$`);        // elenco: "ARMALEO FILIPPO-RMFAZ (Roma)"
const SPACED = new RegExp(`^(.+?) - (${SIG}) \\((.+)\\)$`);     // albero: "MENCARELLI SI - RMFFO (Roma)" (nome troncato a 13 caratteri)
const isNum = s => /^\d+$/.test(s);
const near = (a, b, t = 3) => Math.abs(a - b) <= t;

function classify(page) {
  const text = page.items.map(i => i.s).join(' ');
  if (page.items.some(i => /^Girone N/i.test(i.s))) return 'pool';
  if (/TABELLONE DI ELIMINAZIONE DIRETTA/i.test(text)) return 'list';
  if (/TABELLONE/i.test(text)) return 'tree';
  return null;
}
const byY = (a, b) => b.y - a.y || a.x - b.x;

/* ---------- Gironi ---------- */
function parsePools(page) {
  const items = [...page.items].sort(byY), out = [];
  const marks = items.filter(i => /^Girone N/i.test(i.s)).map(m => {
    const n = items.find(i => near(i.y, m.y) && i.x > m.x && isNum(i.s));
    return { y: m.y, index: n ? +n.s : out.length + 1 };
  });
  marks.forEach((m, k) => {
    const lo = marks[k + 1]?.y ?? -1e9, region = items.filter(i => i.y < m.y - 1 && i.y > lo + 1);
    // L'intestazione "Sf.1 … Sf.n" sta sopra "Girone N.": si usa la più vicina sopra il girone (o, in mancanza, la prima della pagina).
    const heads = items.filter(i => /^Sf\.\s*(\d+)$/.test(i.s));
    const above = heads.filter(h => h.y >= m.y - 1), ref = above.length ? Math.min(...above.map(h => h.y)) : (heads[0]?.y ?? null);
    const hdr = heads.filter(h => ref != null && near(h.y, ref, 2));
    if (!hdr.length) return;
    const hc = hdr.map(h => ({ k: +/(\d+)/.exec(h.s)[1], c: h.x + h.w / 2 })).sort((a, b) => a.k - b.k);
    const pitch = hc.length > 1 ? (hc.at(-1).c - hc[0].c) / (hc.at(-1).k - hc[0].k) : 23, c1 = hc[0].c - pitch * (hc[0].k - 1);
    const rows = new Map();
    for (const it of region) { const key = [...rows.keys()].find(y => near(y, it.y, 2)) ?? it.y; (rows.get(key) || rows.set(key, []).get(key)).push(it); }
    const nRows = [...rows.values()].filter(r => r.some(i => /^\d{4,7}$/.test(i.s))).length;
    const cols = Array.from({ length: Math.max(nRows, hc.at(-1).k) }, (_, i) => ({ k: i + 1, c: c1 + pitch * i })); // le colonne hanno passo costante (l'intestazione può essere più corta del girone)
    const pool = { index: m.index, rows: [] };
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      const r = rows.get(y).sort((a, b) => a.x - b.x);
      const ci = r.findIndex(i => /^\d{4,7}$/.test(i.s));
      if (ci < 1 || !isNum(r[ci - 1].s)) continue;
      const pos = +r[ci - 1].s, surname = r[ci + 1]?.s || '', given = r[ci + 2]?.s || '', sigla = /^[A-Z][A-Z0-9]{2,5}$/.test(r[ci + 3]?.s || '') ? r[ci + 3].s : '';
      const rest = r.slice(ci + (sigla ? 4 : 3));
      const pi = rest.findIndex(i => /^\d+,\d+$/.test(i.s));
      const stats = pi >= 0 ? rest.slice(pi) : [];
      const cells = {};
      for (const c of pi >= 0 ? rest.slice(0, pi) : rest) {
        const col = cols.reduce((b, x) => (Math.abs(x.c - (c.x + c.w / 2)) < Math.abs(b.c - (c.x + c.w / 2)) ? x : b), cols[0]);
        cells[col.k] = c.s;
      }
      pool.rows.push({ pos, code: r[ci].s, surname, given, sigla, cells, pts: stats[0] ? parseFloat(stats[0].s.replace(',', '.')) : null, diff: stats[1] ? parseInt(stats[1].s, 10) : null, ts: stats[2] ? parseInt(stats[2].s, 10) : null });
    }
    if (pool.rows.length) out.push(pool);
  });
  return out;
}

// Assalti di un girone dalla griglia: V = vittoria, numero = stoccate date dall'atleta (sconfitta). Il vincitore ha di norma 5 stoccate;
// se le stoccate totali (Stocc.) indicano altro, si ricalcola.
function poolBouts(pool) {
  const n = Math.max(0, ...pool.rows.map(r => r.pos)), byPos = new Map(pool.rows.map(r => [r.pos, r]));
  const isWin = c => /^[Vv]/.test(c || ''), explicit = c => (/^[Vv](\d)$/.exec(c || '') ? +/^[Vv](\d)$/.exec(c)[1] : null);
  const winTouches = new Map();
  for (const r of pool.rows) {
    const cells = Object.values(r.cells), lost = cells.filter(c => isNum(c)).reduce((s, c) => s + +c, 0);
    const plain = cells.filter(c => isWin(c) && explicit(c) == null).length, fixed = cells.reduce((s, c) => s + (isWin(c) && explicit(c) != null ? explicit(c) : 0), 0);
    let t = 5; // "V" = 5 stoccate; "v4" = vittoria per 4; le stoccate totali (Stocc.) permettono di verificare
    if (plain && r.ts != null) { const x = (r.ts - lost - fixed) / plain; if (Number.isInteger(x) && x >= 1 && x <= 5) t = x; }
    winTouches.set(r.pos, t);
  }
  const bouts = [];
  for (let i = 1; i <= n; i++) for (let j = i + 1; j <= n; j++) {
    const A = byPos.get(i), B = byPos.get(j); if (!A || !B) continue;
    const ca = A.cells[j], cb = B.cells[i];
    const val = (c, t) => (isWin(c) ? (explicit(c) ?? t) : isNum(c || '') ? +c : null);
    const odd = c => c != null && c !== '' && !isWin(c) && !isNum(c); // A = assente, D = squalificato, … : l'assalto non conta
    if (odd(ca) || odd(cb)) continue;
    let sa = val(ca, winTouches.get(i)), sb = val(cb, winTouches.get(j));
    if (sa == null && sb == null) continue;
    if (sa == null) sa = isWin(cb) ? 0 : 5;
    if (sb == null) sb = isWin(ca) ? 0 : 5;
    if (sa === sb) { // pari a tempo scaduto: vince chi ha la "V" (priorità)
      if (isWin(ca) === isWin(cb)) continue;
      bouts.push({ ai: i, bi: j, sa, sb, w: isWin(ca) ? 'a' : 'b' }); continue;
    }
    bouts.push({ ai: i, bi: j, sa, sb });
  }
  return bouts;
}

/* ---------- Tabelloni ---------- */
// Elenco di assalti (tabelloni grandi): "seed | NOME-SIGLA (città) | punti" per i due atleti, poi vincitore e "P. pedana arbitro ora".
function parseList(page) {
  const items = [...page.items].sort(byY);
  const t = items.find(i => /ELIMINAZIONE DIRETTA DI/i.test(i.s));
  const size = t ? +(items.find(i => near(i.y, t.y) && i.x > t.x && isNum(i.s))?.s) || 0 : 0;
  const names = items.filter(i => TIGHT.test(i.s));
  if (!names.length) return { size, matches: [] };
  const nameX = Math.min(...names.map(i => i.x)), firstCol = i => near(i.x, nameX, 4);
  const winX = Math.min(...names.filter(i => i.x > nameX + 60).map(i => i.x), nameX + 225);
  const ath = items.filter(i => firstCol(i) && (TIGHT.test(i.s) || i.s === '-')).sort(byY);
  const rows = ath.map(i => {
    const m = TIGHT.exec(i.s), seed = items.find(s => near(s.y, i.y, 3) && s.x < nameX - 2 && isNum(s.s)), sc = items.find(s => near(s.y, i.y, 3) && isNum(s.s) && s.x >= winX - 45 && s.x < winX);
    return { y: i.y, name: m ? m[1] : null, sigla: m ? m[2] : null, seed: seed ? +seed.s : null, score: sc ? +sc.s : null };
  });
  const matches = [];
  for (let k = 0; k + 1 < rows.length; k += 2) {
    const a = rows[k], b = rows[k + 1], top = a.y + 2, bottom = rows[k + 2]?.y ?? -1e9;
    const p = items.find(i => i.s === 'P.' && i.y < top && i.y > bottom + 1 && near(i.x, winX, 6));
    const info = p ? items.filter(i => near(i.y, p.y, 2) && i.x > p.x) : [];
    const no = items.find(i => i.y < top && i.y > b.y - 6 && i.x > nameX - 60 && i.x < nameX - 2 && isNum(i.s) && !near(i.y, a.y, 1.5) && !near(i.y, b.y, 1.5));
    matches.push({ a, b, no: no ? +no.s : null, piste: info[0]?.s || '', ref: (info.find(i => /\(FIS\)|^[A-Z]/.test(i.s) && i !== info[0] && !/^\d\d:\d\d$/.test(i.s))?.s || '').replace(/\s*\(FIS\)/, ''), time: info.find(i => /^\d\d:\d\d$/.test(i.s))?.s || '' });
  }
  return { size, matches };
}

// Albero disegnato: una colonna per turno; in ogni colonna gli atleti sono in ordine dall'alto e a due a due si affrontano.
function parseTree(page) {
  const items = [...page.items];
  const names = items.filter(i => SPACED.test(i.s));
  if (!names.length) return [];
  const xs = [...new Set(names.map(i => Math.round(i.x)))].sort((a, b) => a - b);
  const cols = []; // cluster di x con tolleranza
  for (const x of xs) { const c = cols.find(c => near(c.x, x, 6)); if (c) c.n++; else cols.push({ x, n: 1 }); }
  const colOf = x => cols.findIndex(c => near(c.x, x, 6));
  const cand = items.filter(i => colOf(i.x) >= 0 && (SPACED.test(i.s) || (i.s === '-' && items.some(s => near(s.y, i.y, 3) && isNum(s.s) && s.x > i.x + 20))));
  const out = cols.map(() => []);
  for (const i of cand) {
    const m = SPACED.exec(i.s), c = colOf(i.x), lo = cols[c].x + 40, hi = (cols[c + 1]?.x ?? cols[c].x + 190) - 2;
    // il punteggio sta in una colonna fissa a destra del nome (anche se il nome è lungo e la supera)
    const score = items.filter(s => near(s.y, i.y, 4) && isNum(s.s) && s.x >= lo && s.x <= hi).sort((a, b) => Math.abs(a.y - i.y) - Math.abs(b.y - i.y) || a.x - b.x)[0];
    const seed = c === 0 ? items.find(s => near(s.y, i.y, 4) && s.x < i.x - 2 && isNum(s.s)) : null;
    out[c].push({ y: i.y, name: m ? m[1] : null, sigla: m ? m[2] : null, score: score ? +score.s : null, seed: seed ? +seed.s : null });
  }
  return out.map(c => c.sort((a, b) => b.y - a.y)).filter(c => c.length);
}

/* ---------- Composizione ---------- */
// Trova l'atleta dal nome (completo o troncato) e dalla sigla della società.
function makeResolver(athletes, siglaOf) {
  const list = athletes.map(a => ({ id: a.id, full: norm(a.name), sigla: siglaOf(a) || '' }));
  return (name, sigla) => {
    if (!name) return null;
    const n = norm(name);
    const pick = arr => arr.find(x => x.full === n) || arr.find(x => x.full.startsWith(n)) || arr.find(x => n.startsWith(x.full));
    // gli ordini "COGNOME NOME" del PDF coincidono con la lista finale; se l'ordine è invertito si prova anche il contrario
    return (pick(list.filter(x => !sigla || !x.sigla || x.sigla === sigla)) || pick(list))?.id || null;
  };
}

// Ricostruisce il tabellone nella forma dell'app (turni dal primo al finale, ogni assalto i alimenta l'assalto i>>1 del turno seguente).
function assembleBracket(roundsBySize, resolve) {
  const sizes = Object.keys(roundsBySize).map(Number).sort((a, b) => b - a);
  // solo turni contigui a partire dalla finale (2, 4, 8, …)
  const chain = []; for (let s = 2; roundsBySize[s]; s *= 2) chain.unshift(s);
  if (!chain.length) return null;
  const data = chain.map(s => roundsBySize[s].map(m => ({ a: resolve(m.a.name, m.a.sigla), b: m.b?.name ? resolve(m.b.name, m.b.sigla) : null, sa: m.a.score, sb: m.b?.name ? m.b.score : null, info: m.info || null })));
  const present = data.map(r => new Set(r.flatMap(m => [m.a, m.b]).filter(Boolean)));
  data.forEach((round, k) => round.forEach(m => {
    const next = present[k + 1];
    m.winner = next ? ([m.a, m.b].filter(x => x && next.has(x))[0] || null) : (m.sa != null && m.sb != null && m.sa !== m.sb ? (m.sa > m.sb ? m.a : m.b) : null);
    if (!m.winner && m.a && !m.b) m.winner = m.a;
    if (!m.winner && m.b && !m.a) m.winner = m.b;
  }));
  // ordine: dalla finale all'indietro, il vincitore di a è il feeder superiore
  const L = data.length, levels = Array(L);
  levels[L - 1] = data[L - 1].slice(0, 1);
  for (let k = L - 2; k >= 0; k--) {
    levels[k] = levels[k + 1].flatMap(parent => [parent.a, parent.b].map(id => data[k].find(m => m.winner === id && id) || { a: id, b: null, sa: null, sb: null, winner: id, bye: true }));
  }
  const rounds = levels.map(r => r.map(m => ({ a: m.a, b: m.b, sa: m.sa ?? null, sb: m.sb ?? null, winner: m.winner || null, ...(m.info && m.info.piste ? { piste: m.info.piste, ref: m.info.ref, time: m.info.time } : {}) })));
  return { size: rounds[0].length * 2, rounds };
}

function parseDetail(rawPages) {
  const pools = [], lists = [], trees = [];
  for (const p of rawPages) {
    const k = classify(p);
    if (k === 'pool') pools.push(...parsePools(p));
    else if (k === 'list') lists.push(parseList(p));
    else if (k === 'tree') trees.push(parseTree(p));
  }
  return { pools, lists, trees };
}

// Dati dettagliati nel formato dell'app. athletes: [{id, name, fis}], siglaOf(a) → sigla società.
function buildDetail(detail, athletes, siglaOf) {
  const out = { pools: null, de: null, unresolved: 0 };
  const byCode = new Map(athletes.filter(a => a.fis).map(a => [a.fis, a.id]));
  const pools = [];
  for (const p0 of [...detail.pools].sort((a, b) => a.index - b.index)) {
    const p = { ...p0, rows: p0.rows.filter(r => !(Object.values(r.cells).length && Object.values(r.cells).every(c => /^[AaDdEe]$/.test(c)))) };
    const ids = p.rows.map(r => byCode.get(r.code) || null);
    if (ids.some(x => !x)) { out.unresolved += ids.filter(x => !x).length; continue; }
    const pos = new Map(p.rows.map((r, i) => [r.pos, ids[i]]));
    pools.push({ index: p.index, athletes: ids, bouts: poolBouts(p).map(b => ({ a: pos.get(b.ai), b: pos.get(b.bi), sa: b.sa, sb: b.sb, ...(b.w ? { w: b.w } : {}) })), imported: true });
  }
  if (pools.length) out.pools = pools.map((p, i) => ({ ...p, index: i + 1 }));

  const resolve = makeResolver(athletes, siglaOf), bySize = {};
  for (const l of detail.lists) if (l.size && l.matches.length) (bySize[l.size] ||= []).push(...l.matches.map(m => ({ a: m.a, b: m.b.name ? m.b : null, info: { piste: m.piste, ref: m.ref, time: m.time } })));
  for (const t of detail.trees) t.forEach((col, c) => {
    if (col.length < 2) return;
    const size = col.length; // atleti presenti nel turno = dimensione del turno
    if (bySize[size]) return;
    const ms = []; for (let k = 0; k + 1 < col.length; k += 2) ms.push({ a: col[k], b: col[k + 1].name ? col[k + 1] : null });
    bySize[size] = ms;
  });
  // il turno da 2 (finale) è la colonna con 2 atleti; la colonna finale con 1 solo atleta (campione) è ignorata
  // se molti nomi del tabellone non corrispondono ai partecipanti (PDF con pagine di un'altra categoria) il tabellone si scarta
  const named = Object.values(bySize).flat().flatMap(m => [m.a, m.b]).filter(x => x && x.name);
  const ok = named.filter(x => resolve(x.name, x.sigla)).length;
  const br = named.length && ok / named.length >= 0.9 ? assembleBracket(bySize, resolve) : null;
  if (br) out.de = br;
  return out;
}

module.exports = { parseDetail, buildDetail, parsePools, poolBouts, parseList, parseTree, classify, assembleBracket };
