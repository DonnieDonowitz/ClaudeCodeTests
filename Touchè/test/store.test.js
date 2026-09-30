const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path');
const { open } = require('../lib/store');
const R = require('../lib/ranking');
const { inferMeta, importDir } = require('../lib/rankingImport');

test('utenti, sessioni e disattivazione', () => {
  const s = open(':memory:');
  const u = s.createUser({ name: 'A', email: 'A@x.it', password: 'password1', role: 'director' });
  assert.ok(s.verify('a@x.it', 'password1')); assert.equal(s.verify('a@x.it', 'sbagliata'), null);
  assert.throws(() => s.createUser({ name: 'B', email: 'a@x.it', password: 'password1', role: 'referee' }), /già registrata/);
  assert.throws(() => s.createUser({ name: 'B', email: 'b@x.it', password: 'corta', role: 'referee' }), /8 caratteri/);
  const sid = s.createSession(u.id); assert.equal(s.userBySid(sid).id, u.id);
  s.updateUser(u.id, { active: false }); assert.equal(s.userBySid(sid), null); assert.equal(s.verify('a@x.it', 'password1'), null);
});
test('competizioni persistono', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tq-')), 't.db'); let s = open(f);
  s.saveComp({ id: 'c1', name: 'Gara', zone: 'marche', athletes: [], referees: [] }); s.close();
  s = open(f); assert.equal(s.comp('c1').name, 'Gara'); s.removeComp('c1'); assert.equal(s.comp('c1'), undefined);
});
test('import ranking: riepilogo differenze e ricerca', () => {
  const s = open(':memory:');
  const e = (n, club, pos) => ({ key: R.nameKey(n), name: n, club, pos });
  const r1 = s.importList({ category: 'Assoluti', weapon: 'Spada', gender: 'M', entries: [e('Rossi Marco', 'Circolo A', 1), e('Bianchi Luca', 'Circolo B', 2)] });
  assert.equal(r1.first, true);
  const r2 = s.importList({ category: 'assoluti', weapon: 'spada', gender: 'M', entries: [e('Rossi Marco', 'Circolo A', 2), e('Verdi Anna', 'Circolo A', 1)] });
  assert.deepEqual([r2.added, r2.changed, r2.removed], [1, 1, 1]);
  assert.equal(s.rankOf('assoluti|spada|m', 'Marco Rossi'), 2);
  assert.equal(s.rankOf('assoluti|spada|m', 'Bianchi Luca'), null);
  assert.equal(s.rankedAthletes(['ross'])[0].club, 'Circolo A');
  assert.equal(s.rankedClubs(['circolo a'])[0].count, 2);
});
test('deduzione di arma, categoria e sesso', () => {
  assert.deepEqual(inferMeta('', 'Ranking_Spada_Maschile_Assoluti_2025.xlsx', ''), { weapon: 'spada', gender: 'M', category: 'assoluti' });
  assert.deepEqual(inferMeta('Fioretto F', 'cadetti.xlsx'), { weapon: 'fioretto', gender: 'F', category: 'cadetti' });
  assert.equal(inferMeta('Sciabola femminile Under 14').category, 'under-14');
});
test('importDir: importa, salta gli invariati, segnala i file non classificabili', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr-')), s = open(':memory:');
  fs.copyFileSync(path.join(__dirname, 'ranking.xlsx'), path.join(dir, 'Spada Maschile Assoluti.xlsx'));
  fs.copyFileSync(path.join(__dirname, 'ranking.xlsx'), path.join(dir, 'misterioso.xlsx'));
  let rep = importDir(s, dir);
  assert.deepEqual(rep.map(r => r.status).sort(), ['importato', 'saltato']);
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ 'misterioso.xlsx': { weapon: 'fioretto', category: 'master', gender: 'F' } }));
  rep = importDir(s, dir);
  assert.deepEqual(rep.map(r => r.status).sort(), ['importato', 'invariato']);
  assert.equal(s.rankOf('master|fioretto|f', 'Rossi Marco'), 1);
});

test('lettura .xls (BIFF8) e .zip, nomi in maiuscolo resi leggibili', () => {
  const xls = path.join(__dirname, '..', 'rankings', 'Ranking-Master-2026-27-INIZIALE-v1.xls');
  if (!fs.existsSync(xls)) return;
  const lists = R.parseRankingLists(fs.readFileSync(xls), 'm.xls');
  const spm = lists.find(l => l.name === 'SPM cat. 2');
  assert.equal(spm.entries[0].name, 'PIRANI CLAUDIO'); assert.equal(spm.entries[0].pos, 1); assert.equal(spm.entries[0].club, 'GEPOM');
  const s = open(':memory:'); s.importList({ category: 'Master Cat. 2', weapon: 'spada', gender: 'M', entries: spm.entries });
  assert.equal(s.rankedAthletes(['pirani'])[0].name, 'Pirani Claudio');
  assert.equal(s.rankOf('master-cat-2|spada|m', 'Claudio Pirani'), 1);
});
test('deduzione dai nomi dei fogli Federscherma', () => {
  assert.deepEqual(inferMeta('SPF cat. 3', '', 'RANKING MASTER 2026-27 SPADA FEMMINILE'), { weapon: 'spada', gender: 'F', category: 'master-cat-3' });
  assert.equal(inferMeta('FM C', 'RC-2026.xlsx', 'RANKING CADETTI FIORETTO MASCHILE').category, 'cadetti');
  assert.equal(inferMeta('ff', 'RGPG_ALLIEVE-I.xls', 'RANKING G.P.G. ALLIEVE FIORETTO FEMMINILE').category, 'allievi');
  assert.equal(inferMeta('FF G', 'RG.xlsx', 'RANKING GIOVANI 2026 FIORETTO FEMMINILE').category, 'giovani');
});
test('società: codice → nome, provincia dal prefisso', () => {
  const s = open(':memory:'); const { provinceOf, readClubsCsv } = require('../lib/clubs');
  assert.equal(provinceOf('PUFAN').name, 'Pesaro e Urbino');
  s.importClubs([{ code: 'PUFAN', name: 'Fanum Fortunae Scherma', city: 'Fano' }]);
  assert.equal(s.clubRow('pufan').name, 'Fanum Fortunae Scherma');
  assert.equal(s.clubKeyByName(R.norm('Fanum Fortunae Scherma')), 'pufan');
  assert.equal(s.clubsByName(['fanum'])[0].code, 'PUFAN');
  const csv = readClubsCsv(path.join(__dirname, '..', 'rankings', 'societa.csv'));
  assert.ok(csv.find(c => c.code === 'PUFAN'));
});
test('ranking paralimpico: gare sopra l\'intestazione, piazzamento + punti, categoria A/B/C', () => {
  const { extractTable } = require('../lib/rankingTable');
  const rows = [['FEDERAZIONE ITALIANA SCHERMA'], [], ['RANKING PARALIMPICO 2025 - 2026 - SPADA MASCHILE'], ['AGGIORNAMENTO - 06 Giugno 2026'], [],
    [null, null, null, null, null, null, null, '1^ Prova NAZIONALE 2025-26', null, 'CdM'], [null, null, null, null, null, null, null, 'S.LAZZARO NOV. 2025', null, 'PISA (ITA) FEB. 2026'], [null, null, null, null, null, null, null, '1.5', null, '2.5'],
    ['Rank', 'NOME', 'Codice', 'Società', 'Anno', null, null, null, null, null, null, 'TOTALE', 'Rank prec.', '+/-'],
    ...Array.from({ length: 6 }, (_, i) => [String(i + 1), `ATLETA ${'ABCDEF'[i]}`, '72975' + i, 'LIACC', '01', 'SpM', 'ABCABC'[i], '2', '46.8', '12', '90.12', '136.92', String(i + 1), '0'])];
  const t = extractTable(rows, {});
  assert.equal(t.asOf, '2026-06-06');
  assert.deepEqual(t.columns.map(c => c.key), ['1^ Prova NAZIONALE 2025-26', 'CdM']);
  assert.deepEqual([t.rows[0].scores, t.rows[0].places, t.rows[0].note, t.rows[0].total, t.rows[0].born], [[46.8, 90.12], [2, 12], 'Cat. A', 136.92, '2001']);
  assert.equal(inferMeta('SpF_NV', '', 'RANKING NON VEDENTI 2025 - 2026 - SPADA FEMMINILE').category, 'non-vedenti');
  assert.deepEqual(inferMeta('ScM', '', 'RANKING PARALIMPICO 2025 - 2026 - SCIABOLA MASCHILE'), { weapon: 'sciabola', gender: 'M', category: 'paralimpico' });
});
