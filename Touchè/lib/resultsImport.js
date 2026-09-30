'use strict';
// Scarica dal sito della Federscherma i PDF dei "RISULTATI" e importa le gare concluse nel database.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { parsePdf, toCompetition, buildClubs } = require('./results');

const SITE = 'https://federscherma.it';
const UA = { 'User-Agent': 'Mozilla/5.0 (Touche importer)' };

async function get(url, tries = 3) {
  for (let i = 1; ; i++) {
    try { const r = await fetch(url, { headers: UA }); if (r.status >= 500 && i < tries) throw new Error('HTTP ' + r.status); return r; }
    catch (e) { if (i >= tries) throw e; await new Promise(res => setTimeout(res, 800 * i)); }
  }
}

// Elenco dei documenti (slug con "risultat…") modificati dalla data indicata, dalle sitemap pubbliche del sito.
async function listDocuments(since, test = slug => /risultat/i.test(slug)) {
  const index = await (await get(`${SITE}/sitemap_index.xml`)).text();
  const maps = [...index.matchAll(/<loc>([^<]*documento-sitemap\d*\.xml)<\/loc>/g)].map(m => m[1]);
  const docs = [];
  for (const m of maps) {
    const xml = await (await get(m)).text();
    for (const u of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]*)<\/lastmod>/g)) {
      const slug = u[1].split('/documento/')[1] || '';
      if (test(slug) && u[2].slice(0, 10) >= since) docs.push({ url: u[1], slug: slug.replace(/\/$/, ''), modified: u[2].slice(0, 10) });
    }
  }
  return docs.sort((a, b) => a.modified.localeCompare(b.modified));
}

// Scarica il PDF di un documento (con cache su disco). Il pulsante "scarica" del sito usa l'ID dell'articolo.
async function fetchPdf(doc, cacheDir) {
  const idx = path.join(cacheDir, 'index.json'), map = fs.existsSync(idx) ? JSON.parse(fs.readFileSync(idx, 'utf8')) : {};
  let id = map[doc.url];
  if (!id) {
    const html = await (await get(doc.url)).text();
    id = /postid-(\d+)/.exec(html)?.[1];
    if (!id) throw new Error('ID del documento non trovato');
    map[doc.url] = id; fs.writeFileSync(idx, JSON.stringify(map));
  }
  const file = path.join(cacheDir, `${id}.pdf`);
  if (!fs.existsSync(file)) {
    const noFile = () => Object.assign(new Error('documento senza file PDF scaricabile'), { skip: true });
    let buf;
    try { buf = Buffer.from(await (await get(`${SITE}/wp-content/plugins/if_document_manager/forceDownload.php?ID_file=${id}`)).arrayBuffer()); } catch (e) { throw /redirect/.test(String(e.cause?.message || e.message)) ? noFile() : e; }
    if (buf.subarray(0, 4).toString() !== '%PDF') throw noFile();
    fs.writeFileSync(file, buf);
  }
  return { id, file };
}

async function pool(items, n, fn) {
  let i = 0; const out = [];
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

// Importa tutti i PDF: dal sito (since = data minima) oppure da una cartella locale (localDir).
async function importResults(store, { since = '2025-08-01', cacheDir, localDir, dryRun = false, force = false, log = () => {}, concurrency = 5, limit = Infinity } = {}) {
  fs.mkdirSync(cacheDir, { recursive: true });
  let items;
  if (localDir) items = fs.readdirSync(localDir).filter(f => /\.pdf$/i.test(f)).sort().map(f => ({ id: path.basename(f, '.pdf'), file: path.join(localDir, f), url: '', slug: f }));
  else {
    const docs = (await listDocuments(since)).slice(0, limit);
    log(`${docs.length} documenti "risultati" dal ${since}`);
    let done = 0;
    items = (await pool(docs, concurrency, async doc => {
      try { const r = await fetchPdf(doc, cacheDir); if (++done % 25 === 0) log(`  scaricati ${done}/${docs.length}`); return { ...doc, ...r }; }
      catch (e) { return { ...doc, error: e.message, skip: e.skip }; }
    }));
  }
  const parsed = [], report = { imported: 0, updated: 0, unchanged: 0, skipped: [], errors: [], teams: 0 };
  for (const it of items) {
    if (it.error) { (it.skip ? report.skipped : report.errors).push(`${it.slug}: ${it.error}`); continue; }
    try {
      const buf = fs.readFileSync(it.file), hash = crypto.createHash('sha1').update(buf).digest('hex');
      const r = await parsePdf(buf);
      parsed.push({ ...r, it, hash });
    } catch (e) { report.errors.push(`${it.slug}: ${e.message}`); }
  }

  // Se la stessa gara è pubblicata più volte (provvisoria/definitiva) si tiene la più recente, meglio se definitiva.
  const best = new Map();
  for (const r of parsed) {
    if (r.kind === 'team') { report.teams++; continue; }
    if (r.kind !== 'individual') { report.skipped.push(`${r.it.slug}: formato non riconosciuto`); continue; }
    if (!r.rows.length) { report.skipped.push(`${r.it.slug}: nessun atleta`); continue; }
    const key = [r.event, r.weapon, r.gender, r.category].join('|'), o = best.get(key);
    const rank = x => (x.state === 'definitiva' ? 1 : 0) + ':' + x.printed;
    if (!o || rank(r) > rank(o)) best.set(key, r);
  }
  // Raggruppa i file della stessa gara (stesso titolo, date ravvicinate): categorie, armi e sessi diversi sono varianti di un'unica gara.
  const byTitle = new Map();
  for (const r of best.values()) { const k = r.event.toLowerCase().replace(/\s+/g, ' ').trim(); (byTitle.get(k) || byTitle.set(k, []).get(k)).push(r); }
  for (const list of byTitle.values()) {
    list.sort((a, b) => a.printed.localeCompare(b.printed));
    let start = list[0].printed, prev = start, n = 0;
    for (const r of list) {
      if ((new Date(r.printed) - new Date(prev)) / 864e5 > 10) { start = r.printed; n++; }
      prev = r.printed;
      r.group = { id: 'g' + crypto.createHash('sha1').update(`${r.event.toLowerCase()}|${start}|${n}`).digest('hex').slice(0, 10), title: r.event };
    }
  }
  for (const r of best.values()) {
    const id = 'fis' + r.it.id, old = store.comp(id);
    if (old && old.imported?.hash === r.hash && old.imported?.v === 3 && old.group?.id === r.group.id && !force) { report.unchanged++; continue; }
    if (dryRun) { report.imported++; continue; }
    const c = toCompetition(r, { id, group: r.group, source: { source: 'federscherma.it', url: r.it.url, doc: r.it.id, hash: r.hash } });
    if (old) { c.ownerId = old.ownerId; if (old.zone !== c.zone && old.zoneFixed) c.zone = old.zone; report.updated++; } else report.imported++;
    store.saveComp(c);
  }
  // Società: denominazioni dalle classifiche a squadre e dai codici FIS degli atleti.
  if (!dryRun) { const clubs = buildClubs(store, parsed); store.importClubs(clubs, 'auto'); report.clubs = clubs.length; }
  return report;
}

module.exports = { importResults, listDocuments, get, SITE };
