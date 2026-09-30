'use strict';
// Importa le gare concluse dai PDF "RISULTATI" del sito della Federscherma (classifica finale e partecipanti) e
// ricava i nomi delle società. È rieseguibile in qualsiasi momento: importa le gare nuove, aggiorna quelle cambiate.
//   npm run results                          tutte le gare dal 1/8/2025 (stagione 2025/26 e 2026/27)
//   npm run results -- --since 2026-09-01    solo i documenti modificati da quella data
//   npm run results -- --dry-run             mostra cosa importerebbe
//   npm run results -- --force               reimporta anche le gare invariate
//   npm run results -- --local cartella      legge i PDF da una cartella invece di scaricarli
// Serve aver importato prima i ranking (npm run rankings): i codici FIS degli atleti danno la società di ciascuno.
const path = require('path');
const { open } = require('../lib/store');
const { importResults } = require('../lib/resultsImport');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const flag = n => process.argv.includes('--' + n);
const dbFile = process.env.TOUCHE_DB || path.join(__dirname, '..', 'data', 'touche.db');

(async () => {
  const store = open(dbFile);
  try {
    const rep = await importResults(store, {
      since: arg('since', '2025-08-01'), dryRun: flag('dry-run'), force: flag('force'), localDir: arg('local') && path.resolve(arg('local')),
      cacheDir: path.join(__dirname, '..', 'data', 'pdf-cache'), limit: arg('limit') ? +arg('limit') : Infinity, log: m => console.log(m),
    });
    console.log(`\nGare: ${rep.imported} ${flag('dry-run') ? 'da importare' : 'nuove'}, ${rep.updated} aggiornate, ${rep.unchanged} invariate · gare a squadre lette per le società: ${rep.teams}`);
    if (rep.clubs != null) console.log(`Società con nome: ${rep.clubs}`);
    for (const s of rep.skipped) console.log('· saltato', s);
    for (const e of rep.errors) console.log('✖', e);
    process.exitCode = rep.errors.length ? 2 : 0;
  } catch (e) { console.error('Errore:', e.message); process.exitCode = 1; }
  store.close();
})();
