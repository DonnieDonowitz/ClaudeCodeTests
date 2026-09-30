'use strict';
// Lettore minimale di file Excel 97-2003 (.xls, BIFF8 dentro un contenitore OLE2), senza dipendenze.
// Legge solo i valori delle celle di ogni foglio: basta per i ranking.

function readCfb(buf) {
  if (buf.readUInt32BE(0) !== 0xD0CF11E0) throw new Error('File .xls non valido');
  const ss = 1 << buf.readUInt16LE(30), mini = 1 << buf.readUInt16LE(32), cutoff = buf.readUInt32LE(56);
  const sect = i => buf.subarray(512 + i * ss, 512 + (i + 1) * ss);
  const difat = [];
  for (let i = 0; i < 109; i++) { const v = buf.readInt32LE(76 + i * 4); if (v >= 0) difat.push(v); }
  for (let s = buf.readInt32LE(68), n = buf.readUInt32LE(72); n-- > 0 && s >= 0;) {
    const b = sect(s); for (let i = 0; i < ss / 4 - 1; i++) { const v = b.readInt32LE(i * 4); if (v >= 0) difat.push(v); }
    s = b.readInt32LE(ss - 4);
  }
  const fat = []; for (const s of difat) { const b = sect(s); for (let i = 0; i < ss / 4; i++) fat.push(b.readInt32LE(i * 4)); }
  const chain = (s, sz) => { const out = []; while (s >= 0 && s < 0xFFFFFFF0 && out.length < 1e6) { out.push(sect(s)); s = fat[s]; } const b = Buffer.concat(out); return sz == null ? b : b.subarray(0, sz); };
  const dir = chain(buf.readInt32LE(48));
  const entries = [];
  for (let o = 0; o + 128 <= dir.length; o += 128) {
    const len = dir.readUInt16LE(o + 64);
    if (len) entries.push({ name: dir.toString('utf16le', o, o + len - 2), type: dir[o + 66], start: dir.readInt32LE(o + 116), size: dir.readUInt32LE(o + 120) });
  }
  const stream = e => {
    if (e.size >= cutoff) return chain(e.start, e.size);
    const root = entries.find(x => x.type === 5), big = chain(root.start, root.size), mf = chain(buf.readInt32LE(60));
    const out = []; for (let s = e.start; s >= 0 && s < 0xFFFFFFF0; s = mf.readInt32LE(s * 4)) out.push(big.subarray(s * mini, (s + 1) * mini));
    return Buffer.concat(out).subarray(0, e.size);
  };
  const wb = entries.find(e => e.type === 2 && (e.name === 'Workbook' || e.name === 'Book'));
  if (!wb) throw new Error('Il file non contiene un foglio di lavoro Excel');
  return stream(wb);
}

function records(b, from = 0) {
  const out = [];
  for (let p = from; p + 4 <= b.length;) { const t = b.readUInt16LE(p), l = b.readUInt16LE(p + 2); out.push({ t, d: b.subarray(p + 4, p + 4 + l), p }); p += 4 + l; }
  return out;
}

// Stringhe della SST: possono continuare nei record CONTINUE (ogni continuazione ricomincia con un byte di flag).
function readSst(chunks) {
  const strs = []; let ci = 0, pos = 8;
  const total = chunks[0].readUInt32LE(4);
  const left = () => chunks[ci].length - pos;
  const next = () => { ci++; pos = 0; };
  const skip = n => { while (n > 0) { if (left() === 0) { if (ci + 1 >= chunks.length) return; next(); } const k = Math.min(n, left()); pos += k; n -= k; } };
  while (strs.length < total && ci < chunks.length) {
    if (left() < 3) { if (ci + 1 >= chunks.length) break; next(); }
    let cch = chunks[ci].readUInt16LE(pos), flags = chunks[ci][pos + 2]; pos += 3;
    let runs = 0, ext = 0;
    if (flags & 8) { runs = chunks[ci].readUInt16LE(pos); pos += 2; }
    if (flags & 4) { ext = chunks[ci].readUInt32LE(pos); pos += 4; }
    let s = '', wide = flags & 1;
    while (cch > 0) {
      if (left() === 0) { if (ci + 1 >= chunks.length) break; next(); wide = chunks[ci][0] & 1; pos = 1; }
      const avail = left(), n = Math.min(cch, wide ? avail >> 1 : avail);
      if (n === 0) { if (ci + 1 >= chunks.length) break; next(); wide = chunks[ci][0] & 1; pos = 1; continue; }
      s += wide ? chunks[ci].toString('utf16le', pos, pos + n * 2) : chunks[ci].toString('latin1', pos, pos + n);
      pos += wide ? n * 2 : n; cch -= n;
    }
    skip(runs * 4 + ext); strs.push(s);
  }
  return strs;
}

const rk = v => { let n; if (v & 2) n = v >> 2; else { const b = Buffer.alloc(8); b.writeUInt32LE((v & 0xFFFFFFFC) >>> 0, 4); n = b.readDoubleLE(0); } return v & 1 ? n / 100 : n; };
const num = n => (Number.isInteger(n) ? String(n) : String(+n.toPrecision(15)));

// Restituisce [{ name, rows }] con le righe come array di stringhe.
function xlsSheets(buf) {
  const wb = readCfb(buf), recs = records(wb);
  const sheets = [], sstChunks = [];
  let inSst = false;
  for (const r of recs) {
    if (r.t === 0x0085) {
      const off = r.d.readUInt32LE(0), cch = r.d[6], wide = r.d[7] & 1;
      sheets.push({ off, type: r.d[5], name: wide ? r.d.toString('utf16le', 8, 8 + cch * 2) : r.d.toString('latin1', 8, 8 + cch) });
    }
    if (r.t === 0x00FC) { sstChunks.push(r.d); inSst = true; } else if (r.t === 0x003C && inSst) sstChunks.push(r.d); else inSst = false;
  }
  const sst = sstChunks.length ? readSst(sstChunks) : [];
  return sheets.filter(s => s.type === 0).map(s => {
    const rows = []; let pendingStr = null;
    const put = (r, c, v) => { (rows[r] ||= [])[c] = v; };
    for (const r of records(wb, s.off).slice(1)) {
      const d = r.d;
      if (r.t === 0x000A) break;
      else if (r.t === 0x00FD) put(d.readUInt16LE(0), d.readUInt16LE(2), sst[d.readUInt32LE(6)] ?? '');
      else if (r.t === 0x0203) put(d.readUInt16LE(0), d.readUInt16LE(2), num(d.readDoubleLE(6)));
      else if (r.t === 0x027E) put(d.readUInt16LE(0), d.readUInt16LE(2), num(rk(d.readUInt32LE(6))));
      else if (r.t === 0x00BD) { const row = d.readUInt16LE(0), c0 = d.readUInt16LE(2), n = (d.length - 6) / 6; for (let i = 0; i < n; i++) put(row, c0 + i, num(rk(d.readUInt32LE(4 + i * 6 + 2)))); }
      else if (r.t === 0x0204) { const cch = d.readUInt16LE(6), wide = d[8] & 1; put(d.readUInt16LE(0), d.readUInt16LE(2), wide ? d.toString('utf16le', 9, 9 + cch * 2) : d.toString('latin1', 9, 9 + cch)); }
      else if (r.t === 0x0006) {
        if (d[6] === 0 && d[12] === 0xFF && d[13] === 0xFF) pendingStr = [d.readUInt16LE(0), d.readUInt16LE(2)];
        else if (!(d[12] === 0xFF && d[13] === 0xFF)) put(d.readUInt16LE(0), d.readUInt16LE(2), num(d.readDoubleLE(6)));
      } else if (r.t === 0x0207 && pendingStr) {
        const cch = d.readUInt16LE(0), wide = d[2] & 1;
        put(pendingStr[0], pendingStr[1], wide ? d.toString('utf16le', 3, 3 + cch * 2) : d.toString('latin1', 3, 3 + cch)); pendingStr = null;
      }
    }
    return { name: s.name, rows: Array.from(rows, r => r || []) };
  });
}

module.exports = { xlsSheets };
