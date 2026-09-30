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
