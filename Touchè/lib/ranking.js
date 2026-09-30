'use strict';
// Lettura del ranking Federscherma (.xlsx o .csv) senza dipendenze esterne.
const zlib = require('zlib');
const { xlsSheets } = require('./xls');

const UNRANKED = 9999;

function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('File Excel non valido');
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const raw = buf.subarray(start, start + csize);
    files[name] = asBuf => { const d = method === 0 ? raw : zlib.inflateRawSync(raw); return asBuf === true ? d : d.toString('utf8'); };
    p += 46 + nlen + elen + clen;
  }
  return files;
}

// Fogli con nome (workbook.xml + relazioni), nell'ordine del file.
function xlsxNamedSheets(buf) {
  const z = unzip(buf), rows = xlsxSheets(buf);
  const wb = z['xl/workbook.xml']?.() || '', rels = z['xl/_rels/workbook.xml.rels']?.() || '';
  const target = Object.fromEntries([...rels.matchAll(/<Relationship\b[^>]*>/g)].map(m => [/Id="([^"]+)"/.exec(m[0])?.[1], /Target="([^"]+)"/.exec(m[0])?.[1]]));
  const order = Object.keys(z).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((a, b) => parseInt(a.match(/(\d+)\.xml/)[1]) - parseInt(b.match(/(\d+)\.xml/)[1]));
  const named = [...wb.matchAll(/<sheet\b[^>]*>/g)].map(m => {
    const t = target[/r:id="([^"]+)"/.exec(m[0])?.[1]] || '', f = 'xl/' + t.replace(/^\/?(xl\/)?/, '');
    return { name: unesc(/name="([^"]*)"/.exec(m[0])?.[1] || ''), idx: order.indexOf(f) };
  });
  return rows.map((r, i) => ({ name: named.find(n => n.idx === i)?.name || named[i]?.name || `Foglio ${i + 1}`, rows: r }));
}

const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');
const colIndex = ref => [...ref.replace(/\d+/g, '')].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;

// Restituisce l'elenco dei fogli, ognuno come matrice di righe.
function xlsxSheets(buf) {
  const z = unzip(buf);
  const shared = z['xl/sharedStrings.xml'] ? [...z['xl/sharedStrings.xml']().matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m => unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(''))) : [];
  return Object.keys(z).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((a, b) => parseInt(a.match(/(\d+)\.xml/)[1]) - parseInt(b.match(/(\d+)\.xml/)[1])).map(k => {
    const rows = [];
    for (const r of z[k]().matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const row = [];
      for (const c of r[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = /r="([A-Z]+)\d+"/.exec(c[1]), t = /t="(\w+)"/.exec(c[1]);
        if (!ref || !c[2]) continue;
        const v = /<v>([\s\S]*?)<\/v>/.exec(c[2]);
        let val = '';
        if (t && t[1] === 's') val = shared[+v?.[1]] ?? '';
        else if (t && t[1] === 'inlineStr') val = unesc([...c[2].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''));
        else if (v) val = unesc(v[1]);
        row[colIndex(ref[1])] = val;
      }
      rows.push(row);
    }
    return rows;
  });
}

function csvRows(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const d = [';', ',', '\t'].map(x => [x, (lines[0] || '').split(x).length]).sort((a, b) => b[1] - a[1])[0][0];
  return lines.map(l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === d && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; });
}

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
// Chiave indipendente dall'ordine di cognome e nome.
const nameKey = s => norm(s).split(' ').filter(Boolean).sort().join(' ');

// Cerca la riga di intestazione (posizione + cognome/nome + società) e legge gli atleti.
// Restituisce [{ key, name, club, pos }] (per ogni atleta tiene la posizione migliore).
function extractEntries(rows) {
  const has = (cell, re) => re.test(norm(cell));
  const add = (out, name, club, pos, code = '') => { const k = nameKey(name); if (!out.has(k) || pos < out.get(k).pos) out.set(k, { key: k, name, club, pos, code }); };
  for (let h = 0; h < Math.min(rows.length, 40); h++) {
    const row = rows[h] || [];
    const rankCol = row.findIndex(c => c !== undefined && has(c, /^(pos|posizione|rank|ranking|classifica|class|pl|n|n pos|posiz)$/));
    const nameCols = [];
    row.forEach((c, i) => { if (c !== undefined && has(c, /^(cognome|nome|atleta|atleti|nominativo|tesserato|cognome e nome|nome e cognome|cognome nome|nome cognome|atleta nominativo)$/)) nameCols.push(i); });
    const clubCol = row.findIndex(c => c !== undefined && has(c, /^(societa|societa sportiva|club|sodalizio|sigla societa|denominazione societa|ass sportiva)$/));
    const codeCol = row.findIndex(c => c !== undefined && has(c, /^(codice|codice fis|numfis|num fis|cod)$/));
    if (rankCol < 0 || !nameCols.length) continue;
    nameCols.sort((a, b) => a - b);
    const out = new Map();
    for (const r of rows.slice(h + 1)) {
      const pos = parseInt(String(r?.[rankCol] ?? '').trim(), 10);
      const name = nameCols.map(i => String(r?.[i] ?? '').trim()).filter(Boolean).join(' ');
      if (Number.isFinite(pos) && pos > 0 && name) add(out, name, clubCol >= 0 ? String(r?.[clubCol] ?? '').trim() : '', pos, codeCol >= 0 ? String(r?.[codeCol] ?? '').trim() : '');
    }
    if (out.size) return [...out.values()];
  }
  // Nessuna intestazione: primo numero intero = posizione, primo testo = atleta.
  const out = new Map();
  for (const r of rows) {
    const cells = (r || []).map(c => String(c ?? '').trim());
    const pos = parseInt(cells.find(c => /^\d+$/.test(c)), 10), name = cells.find(c => /[A-Za-zÀ-ÿ]{2}/.test(c));
    if (pos > 0 && name && !out.has(nameKey(name))) add(out, name, '', pos);
  }
  return [...out.values()];
}
const extractRanking = rows => Object.fromEntries(extractEntries(rows).map(e => [e.key, e.pos]));

function parseRankingFile(buf, filename = '') {
  const rankings = /\.csv$/i.test(filename) ? [extractRanking(csvRows(buf.toString('utf8')))] : xlsxSheets(buf).map(extractRanking);
  const best = rankings.sort((a, b) => Object.keys(b).length - Object.keys(a).length)[0] || {};
  if (!Object.keys(best).length) throw new Error('Formato non riconosciuto: servono una colonna con la posizione e una con cognome/nome');
  return best;
}

// Da un file (.xlsx, .xls, .csv o uno .zip che ne contiene) a un elenco di fogli [{ source, name, rows }].
function loadSheets(buf, filename = '') {
  if (/\.csv$/i.test(filename)) return [{ source: '', name: '', rows: csvRows(buf.toString('utf8')) }];
  if (/\.xls$/i.test(filename)) return xlsSheets(buf).map(s => ({ source: '', ...s }));
  if (/\.zip$/i.test(filename)) {
    const z = unzip(buf), out = [];
    for (const name of Object.keys(z).sort()) {
      if (/\/$/.test(name) || /(^|\/)(__MACOSX|\._)/.test(name) || !/\.(xlsx|xls|csv)$/i.test(name)) continue;
      const base = name.split('/').pop();
      out.push(...loadSheets(z[name](true), base).map(sh => ({ ...sh, source: base })));
    }
    return out;
  }
  return xlsxNamedSheets(buf).map(s => ({ source: '', ...s }));
}
// Il titolo è il testo sopra l'intestazione della tabella (la riga che inizia con "Rank"/"Pos"/"Cat.").
const titleOf = rows => {
  const h = rows.findIndex(r => (r || []).some(c => /^(rank|pos\.?|posizione|cat\.?)$/i.test(String(c ?? '').trim())));
  return rows.slice(0, h > 0 ? h : 6).flat().filter(Boolean).join(' ');
};
// Elenchi di ranking: uno per foglio che contiene una tabella riconoscibile.
function parseRankingLists(buf, filename = '') {
  const { extractTable } = require('./rankingTable');
  return loadSheets(buf, filename).map(sh => {
    const entries = extractEntries(sh.rows), title = titleOf(sh.rows);
    let table = null; try { table = extractTable(sh.rows, { title, fileNames: [sh.source, filename].filter(Boolean) }); } catch {}
    if (table) { // punteggi per gara, totale e posizione precedente di ogni atleta
      const byKey = new Map(table.rows.map(r => [r.key + '|' + r.pos, r]));
      for (const e of entries) { const t = byKey.get(e.key + '|' + e.pos); if (t) Object.assign(e, { born: t.born, total: t.total, prev: t.prev, diff: t.diff, scores: t.scores, places: t.places, note: t.note }); }
    }
    return { source: sh.source, name: sh.name, entries, title, table: table && { columns: table.columns, legend: table.legend, asOf: table.asOf, edition: table.edition, season: table.season, title: table.title } };
  }).filter(l => l.entries.length);
}

const rankOf = (map, name) => map?.[nameKey(name)] ?? null;

module.exports = { UNRANKED, norm, xlsxSheets, xlsxNamedSheets, extractEntries, csvRows, extractRanking, parseRankingFile, parseRankingLists, nameKey, rankOf };
