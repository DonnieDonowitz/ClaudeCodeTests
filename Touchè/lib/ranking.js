'use strict';
// Lettura del ranking Federscherma (.xlsx o .csv) senza dipendenze esterne.
const zlib = require('zlib');

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
    files[name] = () => (method === 0 ? raw : zlib.inflateRawSync(raw)).toString('utf8');
    p += 46 + nlen + elen + clen;
  }
  return files;
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

// Cerca la riga di intestazione (posizione + cognome/nome) e legge atleti e posizioni.
function extractRanking(rows) {
  const has = (cell, re) => re.test(norm(cell));
  for (let h = 0; h < Math.min(rows.length, 40); h++) {
    const row = rows[h] || [];
    const rankCol = row.findIndex(c => c !== undefined && has(c, /^(pos|posizione|rank|ranking|classifica|class|pl|n)$/));
    const nameCols = [];
    row.forEach((c, i) => { if (c !== undefined && has(c, /^(cognome|nome|atleta|nominativo|cognome nome|nome cognome)$/)) nameCols.push(i); });
    if (rankCol < 0 || !nameCols.length) continue;
    nameCols.sort((a, b) => a - b);
    const out = {};
    for (const r of rows.slice(h + 1)) {
      const pos = parseInt(String(r?.[rankCol] ?? '').trim(), 10);
      const name = nameCols.map(i => String(r?.[i] ?? '').trim()).filter(Boolean).join(' ');
      if (Number.isFinite(pos) && pos > 0 && name) { const k = nameKey(name); if (!(k in out) || pos < out[k]) out[k] = pos; }
    }
    if (Object.keys(out).length) return out;
  }
  // Nessuna intestazione: primo numero intero = posizione, primo testo = atleta.
  const out = {};
  for (const r of rows) {
    const cells = (r || []).map(c => String(c ?? '').trim());
    const pos = parseInt(cells.find(c => /^\d+$/.test(c)), 10), name = cells.find(c => /[A-Za-zÀ-ÿ]{2}/.test(c));
    if (pos > 0 && name) { const k = nameKey(name); if (!(k in out)) out[k] = pos; }
  }
  return out;
}

function parseRankingFile(buf, filename = '') {
  const rankings = /\.csv$/i.test(filename) ? [extractRanking(csvRows(buf.toString('utf8')))] : xlsxSheets(buf).map(extractRanking);
  const best = rankings.sort((a, b) => Object.keys(b).length - Object.keys(a).length)[0] || {};
  if (!Object.keys(best).length) throw new Error('Formato non riconosciuto: servono una colonna con la posizione e una con cognome/nome');
  return best;
}

const rankOf = (map, name) => map?.[nameKey(name)] ?? null;

module.exports = { UNRANKED, xlsxSheets, csvRows, extractRanking, parseRankingFile, nameKey, rankOf };
