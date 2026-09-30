'use strict';
// Scarica dal sito della Federscherma l'ultima versione di ogni ranking (assoluto, under 23, giovani, cadetti, master,
// Gran Premio Giovanissimi, paralimpico, non vedenti) e la salva nella cartella dei ranking.
const fs = require('fs'), path = require('path');
const { listDocuments, get, SITE } = require('./resultsImport');

const FAMILIES = [['paralimpico', /paralimpic/], ['non-vedenti', /non-?veden/], ['gpg', /gpg/], ['master', /master/], ['u23', /u23|under-23/],
  ['giovani', /giovani/], ['cadetti', /cadetti/], ['assoluto', /assolut/]];
const familyOf = slug => (/solo|storica/.test(slug) ? null : FAMILIES.find(([, re]) => re.test(slug))?.[0] || null);

async function fetchRankings(dir, { since = '2025-08-01', log = () => {} } = {}) {
  const docs = await listDocuments(since, slug => /^ranking-/.test(slug));
  const latest = new Map();
  for (const d of docs) { const f = familyOf(d.slug); if (f) latest.set(f, d); } // i documenti sono in ordine di data: resta il più recente
  const stateFile = path.join(dir, '.scaricati.json');
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
  const out = [];
  for (const [family, d] of latest) {
    try {
      if (state[family]?.url === d.url && state[family]?.modified === d.modified && fs.existsSync(path.join(dir, state[family].file))) { out.push({ family, file: state[family].file, status: 'invariato' }); continue; }
      const html = await (await get(d.url)).text(), id = /postid-(\d+)/.exec(html)?.[1];
      if (!id) throw new Error('ID del documento non trovato');
      const r = await get(`${SITE}/wp-content/plugins/if_document_manager/forceDownload.php?ID_file=${id}`);
      const buf = Buffer.from(await r.arrayBuffer());
      const sig = buf.subarray(0, 4).toString('hex');
      if (sig !== '504b0304' && sig !== 'd0cf11e0') throw new Error('il documento non è un file Excel/zip');
      const file = decodeURIComponent(path.basename(new URL(r.url).pathname)).replace(/[^\w.\-() ]/g, '_');
      if (state[family]?.file && state[family].file !== file) fs.rmSync(path.join(dir, state[family].file), { force: true }); // versione precedente
      fs.writeFileSync(path.join(dir, file), buf);
      state[family] = { url: d.url, modified: d.modified, file };
      out.push({ family, file, status: 'scaricato' }); log(`↓ ${family}: ${file}`);
    } catch (e) { out.push({ family, status: 'errore', reason: e.message }); }
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 1));
  return out;
}

module.exports = { fetchRankings, familyOf };
