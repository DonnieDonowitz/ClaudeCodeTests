const test = require('node:test'), assert = require('node:assert');
const { parseResults, toCompetition, buildClubs, pretty } = require('../lib/results');
const { open } = require('../lib/store');

const indiv = [
  ['FEDERAZIONE ITALIANA SCHERMA'], ['Campionati Italiani Assoluti Frecciarossa'], ["FEDERATION INTERNATIONALE D'ESCRIME"],
  ['Classifica definitiva', 'Spada maschile', 'Italia - Campionati Italiani Assoluti Frecciarossa'], ['1', 'Stampa:', '03/06/2026', '22:01'],
  ['Classifica', 'NumFis', 'Cognome', 'Nome', 'Del', 'Denominazione'],
  ['1', '636924 CUOMO', 'VALERIO', '18/04/98', 'FIAMME ORO ROMA'], ['2', '672374 PEREIRA DE CAMARGO', 'ALEXANDRE', '25/04/99', 'ROMA FENCING'],
  ['Pagina 1 di 1', 'Mod.F.02'],
];
test('classifica individuale', () => {
  const r = parseResults([indiv]);
  assert.deepEqual([r.kind, r.state, r.weapon, r.gender, r.category, r.printed, r.place], ['individual', 'definitiva', 'spada', 'M', 'Assoluti', '2026-06-03', '']);
  assert.equal(r.rows.length, 2); assert.equal(r.rows[1].surname, 'PEREIRA DE CAMARGO'); assert.equal(r.rows[1].club, 'ROMA FENCING');
  const c = toCompetition(r, { id: 'fis1', source: {} });
  assert.equal(c.athletes[0].name, 'Cuomo Valerio'); assert.equal(c.athletes[0].club, 'Fiamme Oro Roma'); assert.deepEqual(c.imported.final[1], { id: 'fis1a1', pos: 2 });
});
test('master: categoria dalla riga sotto la testata', () => {
  const p = [['FEDERAZIONE ITALIANA SCHERMA'], ['1^ Prova Circuito Nazionale Master 2025-26'], ['x'], ['Classifica definitiva', 'Fioretto femminile', 'Zevio (VR) - 2^ Prova'], ['2', 'Cat.4 (70+)', 'Stampa:', '29/11/2025', '16:56'], ['1', '111111 ROSSI', 'ANNA', '01/01/50', 'CLUB']];
  const r = parseResults([p]);
  assert.deepEqual([r.category, r.place, r.province, r.gender], ['Master Cat. 4', 'Zevio', 'VR', 'F']);
  const c = toCompetition(r, { id: 'x', source: {}, group: { id: 'g1', title: r.event } });
  assert.equal(c.zone, 'master'); assert.equal(c.name, '1^ Prova Circuito Nazionale Master 2025-26'); assert.equal(c.group.id, 'g1');
});
test('gare a squadre e società', () => {
  const t = [['Stampa:', '10/01/2026', '19:39'], ['Classifica definitiva', 'Spada maschile a squadre', 'Bolzano (BZ) - Serie C2'], ['1', '8', '1', '20275 PNSQU', 'SAN QUIRINO SCHERMA', 'San Quirino'], ['LOVISA EDOARDO', 'PAVAN LEONARDO'], ['2', '1', '2', '1109', 'RMCSA', 'SS LAZIO SCHERMA ARICCIA', 'Frascati']];
  const r = parseResults([[['FEDERAZIONE'], ['Serie C2'], ['x'], ...t]]);
  assert.equal(r.kind, 'team'); assert.deepEqual(r.clubs.map(c => c.code), ['PNSQU', 'RMCSA']);
  const s = open(':memory:'); s.importList({ category: 'assoluti', weapon: 'spada', gender: 'M', entries: [{ key: 'valerio cuomo', name: 'CUOMO VALERIO', club: 'RMFFO', pos: 1, code: '636924' }] });
  const clubs = buildClubs(s, [r, parseResults([indiv])]);
  assert.equal(clubs.find(c => c.code === 'RMFFO').name, 'Fiamme Oro Roma'); assert.equal(clubs.find(c => c.code === 'RMCSA').name, 'SS Lazio Scherma Ariccia');
});
test('maiuscole', () => assert.equal(pretty('SALA DI SCHERMA SOCIETA DEL GIARDINO'), 'Sala di Scherma Societa del Giardino'));
