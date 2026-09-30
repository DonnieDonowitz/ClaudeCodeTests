'use strict';
// Rigenera i tabelloni di tutte le gare che ne hanno uno, con il posizionamento corrente delle teste di serie.
// Uso: npm run regen-brackets   (copia di backup del database; i punteggi del tabellone vengono azzerati)
const fs = require('fs'), path = require('path');
const E = require('../lib/engine');
const { open } = require('../lib/store');

const file = path.resolve(process.env.TOUCHE_DB || path.join(__dirname, '..', 'data', 'touche.db'));
if (!fs.existsSync(file)) { console.error('Database non trovato:', file); process.exit(1); }
const s = open(file);
s.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
const backup = `${file}.bak-${Date.now()}`;
fs.copyFileSync(file, backup);

let n = 0;
for (const c of s.comps()) {
  if (!c.de || !c.pools) continue;
  const act = c.athletes.filter(a => !a.absent).sort((x, y) => (x.rank ?? 9999) - (y.rank ?? 9999) || (c.lots?.[x.id] ?? 0) - (c.lots?.[y.id] ?? 0));
  const old = c.de.rounds[0].filter(m => m.winner).length;
  c.de = E.buildBracket(E.ranking(c.pools, act, c.lots).map(r => r.id));
  s.saveComp(c);
  n++; console.log(`✔ ${c.name}: tabellone da ${c.de.size} rigenerato (${old} risultati del primo turno azzerati)`);
}
s.close();
console.log(`${n} tabelloni rigenerati. Backup: ${backup}`);
