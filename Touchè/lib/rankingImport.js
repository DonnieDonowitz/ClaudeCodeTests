'use strict';
// Importa i file dei ranking Federscherma (.xlsx/.csv) nel database.
// Arma, categoria e sesso si deducono dal nome del foglio, dal nome del file e dal titolo in testa al foglio;
// un eventuale rankings/manifest.json può forzarli: { "file.xlsx": { "weapon": "spada", "category": "assoluti", "gender": "M" } }
// (oppure "file.xlsx#NomeFoglio" per un singolo foglio).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const R = require('./ranking');

const RULES = {
  weapon: [['fioretto', /fiorett|foil/], ['spada', /\bspad|epee/], ['sciabola', /sciabol|sabre|saber/]],
  gender: [['F', /femmin|\bdonn|\bfem\b|(^|[^a-z])f($|[^a-z])/], ['M', /maschil|\buomin|\bmasc\b|(^|[^a-z])m($|[^a-z])/]],
  category: [['under-14', /under ?14|\bu ?14\b|giovanissim|ragazz|allievi|prime lame/], ['under-23', /under ?23|\bu ?23\b/], ['cadetti', /cadett|under ?17|\bu ?17\b/],
    ['juniores', /junior|under ?20|\bu ?20\b/], ['giovani', /giovan/], ['assoluti', /assolut|senior/], ['master', /master|amis|veteran/]],
};
const low = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_\-.]+/g, ' ');

// Ogni sorgente di testo ha precedenza sulle successive, per ogni campo.
function inferMeta(...texts) {
  const out = {};
  for (const [field, rules] of Object.entries(RULES))
    for (const t of texts.map(low)) { const hit = rules.find(([, re]) => re.test(t)); if (hit) { out[field] = hit[0]; break; } }
  return out;
}

function listFiles(dir) {
  return fs.readdirSync(dir).filter(f => /\.(xlsx|csv)$/i.test(f) && !f.startsWith('~$') && !f.startsWith('.')).sort();
}

// Restituisce un resoconto per ogni lista trovata: { file, sheet, status, ... }.
function importDir(store, dir, { dryRun = false, force = false, season = '', log = () => {} } = {}) {
  const manifest = fs.existsSync(path.join(dir, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')) : {};
  const report = [];
  for (const file of listFiles(dir)) {
    const buf = fs.readFileSync(path.join(dir, file)), fileHash = crypto.createHash('sha256').update(buf).digest('hex');
    let lists;
    try { lists = R.parseRankingLists(buf, file); } catch (e) { report.push({ file, status: 'errore', reason: e.message }); continue; }
    if (!lists.length) { report.push({ file, status: 'errore', reason: 'nessun elenco riconosciuto (servono colonne posizione e cognome/nome)' }); continue; }
    for (const l of lists) {
      const id = lists.length > 1 || l.name ? `${file}#${l.name}` : file;
      const m = { ...inferMeta(l.name, file, l.title), ...manifest[file], ...manifest[id] };
      const missing = ['weapon', 'category', 'gender'].filter(k => !m[k]);
      if (missing.length) { report.push({ file, sheet: l.name, status: 'saltato', reason: `non riesco a dedurre: ${missing.join(', ')} (usa rankings/manifest.json)` }); continue; }
      const key = `${m.category}|${m.weapon}|${m.gender}`.toLowerCase(), h = fileHash + '#' + l.name;
      if (!force && store.rankingList(key)?.file_hash === h) { report.push({ file, sheet: l.name, status: 'invariato', key, count: l.entries.length }); continue; }
      if (dryRun) { report.push({ file, sheet: l.name, status: 'da importare', key, count: l.entries.length }); continue; }
      const r = store.importList({ ...m, entries: l.entries, file, hash: h, season: m.season || season });
      report.push({ file, sheet: l.name, status: 'importato', ...r });
    }
  }
  return report;
}

module.exports = { inferMeta, importDir, listFiles };
