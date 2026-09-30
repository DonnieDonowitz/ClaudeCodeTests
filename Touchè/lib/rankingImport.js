'use strict';
// Importa i file dei ranking Federscherma (.xlsx/.csv) nel database.
// Arma, categoria e sesso si deducono dal nome del foglio, dal nome del file e dal titolo in testa al foglio;
// un eventuale rankings/manifest.json può forzarli: { "file.xlsx": { "weapon": "spada", "category": "assoluti", "gender": "M" } }
// (oppure "file.xlsx#NomeFoglio" per un singolo foglio).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const R = require('./ranking');
const Store = require('./store');

const RULES = {
  weapon: [['fioretto', /fiorett|foil/], ['spada', /\bspad|epee/], ['sciabola', /sciabol|sabre|saber/]],
  gender: [['F', /femmin|\bdonn|\bfem\b|(^|[^a-z])f($|[^a-z])/], ['M', /maschil|\buomin|\bmasc\b|(^|[^a-z])m($|[^a-z])/]],
  // L'ordine conta: le categorie più specifiche prima delle generiche.
  category: [['paralimpico', /paralimpic/], ['non-vedenti', /non ?veden|(^|[^a-z])nv($|[^a-z])/], ['__combinata', /ragazz\w*[\s-]*i?\s*\+\s*allie/], ['bambini', /bambin|maschietti/], ['giovanissimi', /giovanissim/], ['ragazzi', /ragazz/], ['allievi', /allie[vw]/],
    ['under-14', /under ?14|\bu ?14\b/], ['under-23', /under ?23|\bu ?23\b/], ['cadetti', /cadett|under ?17|\bu ?17\b/], ['giovani', /giovan/],
    ['juniores', /junior|under ?20|\bu ?20\b/], ['assoluti', /assolut|senior/], ['master', /master|amis|veteran/]],
};
const low = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_\-.]+/g, ' ');
const WEAPON_CODE = { f: 'fioretto', sp: 'spada', sc: 'sciabola' };

// Ogni sorgente di testo ha precedenza sulle successive, per ogni campo.
// I fogli della Federscherma si chiamano FF, FM, SPF, SPM, SCF, SCM (arma + sesso) e, per i master, "… cat. N".
function inferMeta(...texts) {
  const out = {};
  const code = /^(f|sp|sc)([fm])(?![a-z])/.exec(low(texts[0]).trim());
  if (code) { out.weapon = WEAPON_CODE[code[1]]; out.gender = code[2].toUpperCase(); }
  for (const [field, rules] of Object.entries(RULES))
    if (!out[field]) for (const t of texts.map(low)) { const hit = rules.find(([, re]) => re.test(t)); if (hit) { out[field] = hit[0]; break; } }
  const cat = /\bcat\s*(\d)\b/.exec(low(texts[0]));
  if (out.category === 'master' && cat) out.category = `master-cat-${cat[1]}`;
  return out;
}

function listFiles(dir) {
  return fs.readdirSync(dir).filter(f => /\.(xlsx|xls|csv|zip)$/i.test(f) && !f.startsWith('~$') && !f.startsWith('.') && f.toLowerCase() !== 'societa.csv').sort();
}

// Restituisce un resoconto per ogni lista trovata: { file, sheet, status, ... }.
function importDir(store, dir, { dryRun = false, force = false, season = '', log = () => {} } = {}) {
  const manifest = fs.existsSync(path.join(dir, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')) : {};
  const report = [], cand = [];
  for (const file of listFiles(dir)) {
    const buf = fs.readFileSync(path.join(dir, file)), fileHash = crypto.createHash('sha256').update(buf).digest('hex');
    let lists;
    try { lists = R.parseRankingLists(buf, file); } catch (e) { report.push({ file, status: 'errore', reason: e.message }); continue; }
    if (!lists.length) { report.push({ file, status: 'errore', reason: 'nessun elenco riconosciuto (servono colonne posizione e cognome/nome)' }); continue; }
    for (const l of lists) {
      const id = `${file}#${l.source ? l.source + '#' : ''}${l.name}`, label = [l.source, l.name].filter(Boolean).join(' / ');
      const m = { ...inferMeta(l.name, l.source, l.title, file), ...manifest[file], ...(l.source && manifest[`${file}#${l.source}`]), ...manifest[`${file}#${l.name}`], ...manifest[id] };
      if (m.category === '__combinata') { report.push({ file, sheet: label, status: 'ignorato', reason: 'lista combinata, già coperta dalle liste singole' }); continue; }
      const missing = ['weapon', 'category', 'gender'].filter(k => !m[k]);
      if (missing.length) { report.push({ file, sheet: label, status: 'saltato', reason: `non riesco a dedurre: ${missing.join(', ')} (usa rankings/manifest.json)` }); continue; }
      cand.push({ file, l, m, label, key: Store.rankKey(m.category, m.weapon, m.gender), h: fileHash + '#' + (l.source ? l.source + '#' : '') + l.name + '#v3' });
    }
  }
  // Se più file contengono la stessa lista (es. un vecchio aggiornamento rimasto nella cartella) si usa la più recente.
  const best = new Map();
  for (const c of cand) { const o = best.get(c.key); if (!o || (c.l.table?.asOf || '') > (o.l.table?.asOf || '')) best.set(c.key, c); }
  for (const c of cand) {
    const { file, l, m, label, key, h } = c;
    if (best.get(key) !== c) { report.push({ file, sheet: label, status: 'ignorato', reason: `esiste una versione più recente (${best.get(key).file})` }); continue; }
    if (!force && store.rankingList(key)?.file_hash === h) { report.push({ file, sheet: label, status: 'invariato', key, count: l.entries.length }); continue; }
    if (dryRun) { report.push({ file, sheet: label, status: 'da importare', key, count: l.entries.length }); continue; }
    const t = l.table || {};
    const r = store.importList({ ...m, entries: l.entries, file: (l.source || file).replace(/^Copia di /i, ''), hash: h, season: m.season || season || t.season || '', columns: t.columns, legend: t.legend, asOf: t.asOf, edition: t.edition, title: t.title });
    report.push({ file, sheet: label, status: 'importato', ...r });
  }
  return report;
}

// Importa rankings/societa.csv (codice → nome società), se presente.
function importClubs(store, dir) {
  const file = path.join(dir, 'societa.csv');
  if (!fs.existsSync(file)) return null;
  return store.importClubs(require('./clubs').readClubsCsv(file));
}

module.exports = { inferMeta, importDir, importClubs, listFiles };
