'use strict';
// Legge la tabella completa di un ranking Federscherma: punteggio per ogni gara (colonne), totale, posizione precedente e legenda delle gare internazionali.
const { norm, nameKey } = require('./ranking');

const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const round = n => (n == null ? null : Math.round(n * 1000) / 1000);
const serialToIso = v => { const n = parseFloat(v); if (!(n > 30000 && n < 80000)) return ''; return new Date(Date.UTC(1899, 11, 30) + n * 864e5).toISOString().slice(0, 10); };
const MONTHS = { gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6, luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12 };
const birthYear = v => { const n = parseFloat(v); if (n > 10000) return serialToIso(n).slice(0, 4); if (n >= 1900 && n < 2100) return String(n); if (n >= 0 && n < 100 && /^\d{1,2}$/.test(String(v).trim())) return String(n <= (new Date().getFullYear() % 100) + 1 ? 2000 + n : 1900 + n); return ''; };
const pad = n => String(n).padStart(2, '0');

// Data dell'aggiornamento: dal titolo ("Aggiornamento n. 1 del 27/09/2026", "AGGIORNAMENTO 14 Maggio 2026"), altrimenti dal nome del file ("agg.-22-09-26").
function updateDate(titleText, fileNames) {
  const t = String(titleText);
  let m = /aggiornament\w*[^0-9]*(?:n\.?\s*\d+\s*)?del\s+(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/i.exec(t);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = /aggiornament\w*[\s-]+(\d{1,2})\s+([a-zà]+)\s+(\d{4})/i.exec(t);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(m[1])}`;
  for (const f of fileNames) {
    m = /(?:agg|aggiornat\w*)[._\s-]*(?:n[._\s-]*\d+[._\s-]*del[._\s-]*)?(\d{1,2})[._-](\d{1,2})[._-](\d{2,4})/i.exec(f);
    if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(m[2])}-${pad(m[1])}`;
  }
  return '';
}

function extractTable(rows, { title = '', fileNames = [] } = {}) {
  const h = rows.findIndex(r => (r || []).some(c => /^(rank|pos\.?|posizione)$/i.test(String(c ?? '').trim())) && (r || []).some(c => /^(societ|club)/i.test(norm(c))));
  if (h < 0) return null;
  const head = rows[h].map(c => (c == null ? '' : String(c).replace(/\s+/g, ' ').trim()));
  const find = re => head.findIndex(c => c && re.test(norm(c)));
  const posCol = find(/^(rank|pos|posizione)$/), clubCol = find(/^(societa|club)/), codeCol = find(/^(codice|codice fis)$/);
  const nameCols = head.map((c, i) => (/^(cognome|nome|atleta|nominativo|cognome nome|nome cognome)$/.test(norm(c)) ? i : -1)).filter(i => i >= 0);
  const yearCol = find(/^(anno|data di nascita)$/), totalCol = find(/^(totale|media|punti)$/), prevCol = find(/^rank (prec|iniz)/), diffCol = head.findIndex(c => /^(diff\.? ?)?\+ ?\/ ?-$/i.test(c));
  const kqCol = head.findIndex(c => /^kq$/i.test(c)), catCol = find(/^cat$/);
  const firstScore = Math.max(clubCol, yearCol, codeCol, ...nameCols) + 1;
  const stop = [prevCol, diffCol, kqCol].filter(i => i > firstScore).sort((a, b) => a - b)[0] ?? head.length;
  // colonne dei punteggi: dopo società/anno, prima di totale-posizione precedente; esclusi i totali
  const scoreCols = [];
  for (let i = firstScore; i < stop; i++) if (head[i] && i !== totalCol && i !== catCol) scoreCols.push(i);

  // Master: sotto l'intestazione ci sono luogo e data di ogni prova
  const subs = [];
  for (let r = h + 1; r <= h + 2; r++) {
    const row = rows[r] || [];
    if (String(row[posCol] ?? '').trim() === '' && scoreCols.some(i => String(row[i] ?? '').trim() !== '' && !/^\d+(\.\d+)?$/.test(String(row[i])) || /^\d{5}$/.test(String(row[scoreCols[0]] ?? '')))) subs.push(r);
    else break;
  }
  const dataStart = h + 1 + subs.length;
  let columns = scoreCols.map(i => {
    const extra = subs.map(r => String((rows[r] || [])[i] ?? '').trim()).filter(Boolean).map(x => (/^\d{5}$/.test(x) ? serialToIso(x) : x));
    return { key: head[i], sub: extra.join(' · ') };
  });
  // Ranking paralimpico / non vedenti: le gare sono scritte SOPRA l'intestazione (nome, luogo e data, coefficiente)
  // e ogni gara occupa due colonne: piazzamento e punti.
  const tidy = x => String(x ?? '').replace(/\s+/g, ' ').trim();
  let pairs = null, noteCol = -1;
  if (!scoreCols.length && h >= 3) {
    const evs = [];
    for (let i = firstScore; i < stop; i++) if (tidy((rows[h - 3] || [])[i]) && i !== totalCol) evs.push(i);
    if (evs.length) {
      pairs = evs;
      columns = evs.map(i => ({ key: tidy(rows[h - 3][i]), sub: [tidy((rows[h - 2] || [])[i]), tidy((rows[h - 1] || [])[i]) ? 'coeff. ' + tidy(rows[h - 1][i]) : ''].filter(Boolean).join(' · ') }));
      // categoria paralimpica (A, B, C) in una colonna senza intestazione prima delle gare
      for (let i = firstScore; i < evs[0]; i++) if (rows.slice(dataStart, dataStart + 30).filter(r => /^[ABC]$/.test(tidy((r || [])[i]))).length >= 5) noteCol = i;
    }
  }

  const out = [];
  const legend = [];
  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r] || [];
    if (kqCol >= 0) { // legenda delle gare internazionali: codice | nome | data | coefficiente
      const [code, name, date, kq] = [row[kqCol - 3], row[kqCol - 2], row[kqCol - 1], row[kqCol]].map(x => String(x ?? '').trim());
      if (code && name && name !== '-' && !/^kq$/i.test(kq) && !legend.some(l => l.code === code)) legend.push({ code, name, date: serialToIso(date), kq: num(kq) });
    }
    const pos = parseInt(String(row[posCol] ?? '').trim(), 10);
    const name = nameCols.map(i => String(row[i] ?? '').trim()).filter(Boolean).join(' ');
    if (!(pos > 0) || !name) continue;
    out.push({
      key: nameKey(name), name, pos, club: String(row[clubCol] ?? '').trim(), code: codeCol >= 0 ? String(row[codeCol] ?? '').trim() : '',
      born: yearCol >= 0 ? birthYear(row[yearCol]) : '', total: round(num(row[totalCol])), prev: prevCol >= 0 ? parseInt(row[prevCol], 10) || null : null,
      diff: diffCol >= 0 ? parseInt(row[diffCol], 10) || 0 : null,
      scores: pairs ? pairs.map(i => round(num(row[i + 1]))) : scoreCols.map(i => round(num(row[i]))),
      ...(pairs ? { places: pairs.map(i => parseInt(row[i], 10) || null) } : {}),
      ...(noteCol >= 0 && tidy(row[noteCol]) ? { note: 'Cat. ' + tidy(row[noteCol]) } : {}),
    });
  }
  const text = title + ' ' + rows.slice(0, h).flat().filter(Boolean).join(' ');
  return {
    rows: out, columns, legend, asOf: updateDate(text, fileNames),
    edition: /iniziale/i.test(text) ? 'Iniziale' : /aggiornament/i.test(text) ? (/aggiornament\w*\s+n\.?\s*(\d+)/i.exec(text) ? `Aggiornamento n. ${/aggiornament\w*\s+n\.?\s*(\d+)/i.exec(text)[1]}` : 'Aggiornamento') : '',
    season: /(20\d\d)\s*[-\/]\s*(20)?(\d\d)/.exec(text) ? `${/(20\d\d)\s*[-\/]\s*(20)?(\d\d)/.exec(text)[1]}/${/(20\d\d)\s*[-\/]\s*(20)?(\d\d)/.exec(text)[3]}` : '',
    title: rows.slice(0, h).flat().filter(Boolean).find(x => /^ranking/i.test(x)) || '',
  };
}

module.exports = { extractTable, updateDate, serialToIso };
