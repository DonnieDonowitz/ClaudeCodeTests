'use strict';
// Importa/aggiorna i ranking Federscherma dalla cartella rankings/ nel database SQLite.
//   npm run rankings                     importa i file nuovi o modificati
//   npm run rankings -- --dry-run        mostra cosa farebbe, senza scrivere
//   npm run rankings -- --force          reimporta anche i file invariati
//   npm run rankings -- --dir altra/cartella --season 2025/26
// Per aggiornare i ranking: sostituisci i file xlsx nella cartella e rilancia il comando.
const path = require('path');
const { open } = require('../lib/store');
const { importDir, importClubs } = require('../lib/rankingImport');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const flag = n => process.argv.includes('--' + n);
const dir = path.resolve(arg('dir', path.join(__dirname, '..', 'rankings')));
const dbFile = process.env.TOUCHE_DB || path.join(__dirname, '..', 'data', 'touche.db');

let rep;
try {
  const store = open(dbFile);
  rep = importDir(store, dir, { dryRun: flag('dry-run'), force: flag('force'), season: arg('season', '') });
  if (!flag('dry-run')) { const n = importClubs(store, dir); if (n != null) console.log(`Società: ${n} codici importati da societa.csv\n`); }
  store.close();
} catch (e) { console.error(e.code === 'ENOENT' ? `Cartella non trovata: ${dir}` : e.message); process.exit(1); }

if (!rep.length) console.log(`Nessun file .xlsx/.csv in ${dir}`);
for (const r of rep) {
  const name = r.file + (r.sheet ? ` [${r.sheet}]` : '');
  if (r.status === 'importato') console.log(`✔ ${name} → ${r.key}: ${r.count} atleti${r.first ? ' (nuova lista)' : ` (+${r.added} nuovi, ${r.changed} posizioni cambiate, ${r.removed} usciti)`}`);
  else if (r.status === 'invariato') console.log(`= ${name} → ${r.key}: invariato`);
  else if (r.status === 'da importare') console.log(`… ${name} → ${r.key}: ${r.count} atleti (dry-run)`);
  else console.log(`${r.status === 'ignorato' ? '·' : '✖'} ${name}: ${r.reason}`);
}
const bad = rep.filter(r => r.status === 'errore' || r.status === 'saltato').length;
console.log(`\n${rep.filter(r => r.status === 'importato').length} importati, ${rep.filter(r => r.status === 'invariato').length} invariati, ${bad} con problemi.`);
process.exit(bad ? 2 : 0);
