'use strict';
// Estrae il testo dai PDF dei risultati (pdfjs-dist), ricostruendo le righe dalle coordinate.
let pdfjs;
async function load() { return pdfjs ||= await import('pdfjs-dist/legacy/build/pdf.mjs'); }

// Restituisce un array di pagine; ogni pagina è un array di righe; ogni riga è un array di celle (testo) da sinistra a destra.
async function pdfPages(buf, { maxPages = Infinity } = {}) {
  const { getDocument } = await load();
  const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: true, verbosity: 0, isEvalSupported: false }).promise;
  const pages = [];
  for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const rows = [];
    for (const it of tc.items) {
      if (!it.str.trim()) continue;
      const y = it.transform[5];
      const row = rows.find(r => Math.abs(r.y - y) <= 2);
      (row || rows[rows.push({ y, cells: [] }) - 1]).cells.push([it.transform[4], it.str.trim()]);
    }
    pages.push(rows.sort((a, b) => b.y - a.y).map(r => r.cells.sort((a, b) => a[0] - b[0]).map(c => c[1])));
  }
  await doc.destroy();
  return pages;
}

module.exports = { pdfPages };
