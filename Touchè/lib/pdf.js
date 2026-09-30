'use strict';
// Estrae il testo dai PDF dei risultati (pdfjs-dist). I PDF della Federscherma contengono tabelle (gironi) e tabelloni
// disegnati: per leggerli servono le coordinate di ogni frammento di testo, non solo le righe.
let pdfjs;
async function load() { return pdfjs ||= await import('pdfjs-dist/legacy/build/pdf.mjs'); }

// Pagine grezze: [{ width, height, items: [{ x, y, w, s }] }] con y crescente verso l'alto (come nel PDF).
async function pdfRaw(buf, { maxPages = Infinity } = {}) {
  const { getDocument } = await load();
  const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: true, verbosity: 0, isEvalSupported: false }).promise;
  const pages = [];
  for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
    const page = await doc.getPage(p), tc = await page.getTextContent(), [, , width, height] = page.view;
    const items = [];
    for (const it of tc.items) {
      const s = it.str.trim(); if (!s) continue;
      const [a, b, , , x, y] = it.transform;
      // testo ruotato di 90° (tabelloni stampati in verticale): si riportano le coordinate nel verso di lettura
      if (Math.abs(a) < 1e-3 && b > 0) items.push({ x: y, y: -x, w: it.width, s, rot: 90 });
      else if (Math.abs(a) < 1e-3 && b < 0) items.push({ x: -y, y: x, w: it.width, s, rot: -90 });
      else items.push({ x, y, w: it.width, s });
    }
    pages.push({ width, height, items });
  }
  await doc.destroy();
  return pages;
}

// Righe di celle (testo da sinistra a destra) di una pagina.
function pageLines(page) {
  const rows = [];
  for (const it of page.items) {
    const row = rows.find(r => Math.abs(r.y - it.y) <= 2);
    (row || rows[rows.push({ y: it.y, cells: [] }) - 1]).cells.push([it.x, it.s]);
  }
  return rows.sort((a, b) => b.y - a.y).map(r => r.cells.sort((a, b) => a[0] - b[0]).map(c => c[1]));
}

// Compatibilità: array di pagine, ognuna un array di righe di celle.
async function pdfPages(buf, opts) { return (await pdfRaw(buf, opts)).map(pageLines); }

module.exports = { pdfRaw, pageLines, pdfPages };
