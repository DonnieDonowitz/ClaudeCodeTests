'use strict';
// Elimina i dati dimostrativi creati dalle vecchie versioni di `npm run seed`: le 5 gare di esempio (nomi inventati)
// e i ranking "ranking-demo.xlsx". Le gare reali importate da federscherma.it e le gare create a mano non vengono toccate.
//   npm run remove-demo            esegue   ·   npm run remove-demo -- --dry-run   mostra soltanto
const path = require('path');
const { open } = require('../lib/store');

const DEMO = ['Trofeo Città di Esempio', 'Coppa Adriatica', 'Gran Premio Colle Verde', 'Trofeo Master Città di Esempio', 'Regionale Piemonte Giovanissimi'];
const dry = process.argv.includes('--dry-run');
const store = open(process.env.TOUCHE_DB || path.join(__dirname, '..', 'data', 'touche.db'));
let n = 0;
for (const c of store.comps()) {
  if (c.imported || !DEMO.includes(c.name)) continue;
  console.log(`${dry ? '· da eliminare' : '✔ eliminata'}: ${c.name}`);
  if (!dry) store.removeComp(c.id);
  n++;
}
const lists = store.rankingLists().filter(l => l.file === 'ranking-demo.xlsx');
if (lists.length) { console.log(`${dry ? '· da eliminare' : '✔ eliminati'}: ${lists.length} ranking demo`); if (!dry) store.removeRankingFile('ranking-demo.xlsx'); }
console.log(n || lists.length ? 'Fatto.' : 'Nessun dato dimostrativo trovato.');
store.close();
