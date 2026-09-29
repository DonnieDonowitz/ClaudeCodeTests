const test = require('node:test'); const assert = require('node:assert'); const fs = require('fs'); const path = require('path');
const R = require('../lib/ranking');
test('legge un .xlsx con intestazione', () => {
  const m = R.parseRankingFile(fs.readFileSync(path.join(__dirname, 'ranking.xlsx')), 'ranking.xlsx');
  assert.equal(R.rankOf(m, 'Rossi Marco'), 1);
  assert.equal(R.rankOf(m, 'Marco ROSSI'), 1);       // ordine e maiuscole indifferenti
  assert.equal(R.rankOf(m, 'Bianchi Giulia'), 2);
  assert.equal(R.rankOf(m, 'De Luca Sofia & C'), 15);
  assert.equal(R.rankOf(m, 'Sconosciuto Atleta'), null);
});
test('legge un CSV, anche senza intestazione', () => {
  const a = R.parseRankingFile(Buffer.from('Posizione;Cognome;Nome\n3;Èsposito;Luca\n7;Verdi;Anna\n'), 'r.csv');
  assert.equal(R.rankOf(a, 'Esposito Luca'), 3);
  const b = R.parseRankingFile(Buffer.from('5;Neri Paolo;Club\n9;Gialli Sara;Club\n'), 'r.csv');
  assert.equal(R.rankOf(b, 'Gialli Sara'), 9);
});
test('file non riconosciuto', () => assert.throws(() => R.parseRankingFile(Buffer.from('a;b\nc;d'), 'x.csv'), /Formato/));
