'use strict';
// Persistenza su SQLite (modulo integrato node:sqlite, Node >= 22.5).
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const R = require('./ranking');

const ROLES = ['admin', 'regional', 'director', 'referee'];
const SESSION_DAYS = 30;
const uid = () => crypto.randomBytes(6).toString('hex');
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const slug = x => String(x).toLowerCase().trim().replace(/[\s.]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
// I file Federscherma scrivono i nomi in maiuscolo: per la visualizzazione diventano "Cognome Nome".
const pretty = n => n === n.toUpperCase() ? n.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : n;
const rankKey = (category, weapon, gender) => [slug(category), slug(weapon), slug(gender || 'M')].join('|');

function open(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL; PRAGMA temp_store=MEMORY; PRAGMA cache_size=-20000; PRAGMA mmap_size=134217728;
  CREATE TABLE IF NOT EXISTS users(
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, pw TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','regional','director','referee')), zone TEXT, active INTEGER NOT NULL DEFAULT 1,
    created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS competitions(
    id TEXT PRIMARY KEY, owner_id TEXT REFERENCES users(id) ON DELETE SET NULL, zone TEXT NOT NULL, name TEXT NOT NULL, date TEXT,
    weapon TEXT, category TEXT, gender TEXT, data TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS comp_zone ON competitions(zone);
  CREATE INDEX IF NOT EXISTS comp_owner ON competitions(owner_id);
  CREATE TABLE IF NOT EXISTS ranking_lists(
    key TEXT PRIMARY KEY, category TEXT NOT NULL, weapon TEXT NOT NULL, gender TEXT NOT NULL, season TEXT, file TEXT, file_hash TEXT,
    updated INTEGER NOT NULL, count INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS ranking_entries(
    list_key TEXT NOT NULL REFERENCES ranking_lists(key) ON DELETE CASCADE, name_key TEXT NOT NULL, name TEXT NOT NULL,
    club TEXT NOT NULL DEFAULT '', club_key TEXT NOT NULL DEFAULT '', pos INTEGER NOT NULL, PRIMARY KEY(list_key, name_key));
  CREATE INDEX IF NOT EXISTS re_name ON ranking_entries(name_key);
  CREATE INDEX IF NOT EXISTS re_club ON ranking_entries(club_key);
  CREATE TABLE IF NOT EXISTS clubs(code_key TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, name_key TEXT NOT NULL, city TEXT NOT NULL DEFAULT '');
  CREATE INDEX IF NOT EXISTS clubs_name ON clubs(name_key);`);

  // Migrazione: codice FIS dell'atleta nei ranking (serve per collegare i risultati delle gare alle società).
  if (!db.prepare('PRAGMA table_info(ranking_entries)').all().some(c => c.name === 'code')) db.exec("ALTER TABLE ranking_entries ADD COLUMN code TEXT NOT NULL DEFAULT ''");
  for (const [t, col, def] of [['ranking_entries', 'born', "TEXT NOT NULL DEFAULT ''"], ['ranking_entries', 'total', 'REAL'], ['ranking_entries', 'prev', 'INTEGER'], ['ranking_entries', 'diff', 'INTEGER'],
    ['ranking_entries', 'scores', 'TEXT'], ['ranking_entries', 'places', 'TEXT'], ['ranking_entries', 'note', "TEXT NOT NULL DEFAULT ''"], ['ranking_lists', 'columns', 'TEXT'], ['ranking_lists', 'legend', 'TEXT'], ['ranking_lists', 'as_of', "TEXT NOT NULL DEFAULT ''"],
    ['ranking_lists', 'edition', "TEXT NOT NULL DEFAULT ''"], ['ranking_lists', 'title', "TEXT NOT NULL DEFAULT ''"]])
    if (!db.prepare(`PRAGMA table_info(${t})`).all().some(c => c.name === col)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${col} ${def}`);
  db.exec('CREATE INDEX IF NOT EXISTS re_code ON ranking_entries(code)');
  if (!db.prepare('PRAGMA table_info(clubs)').all().some(c => c.name === 'source')) db.exec("ALTER TABLE clubs ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
  // Statement preparati riutilizzati (compilati una sola volta).
  const stmts = new Map();
  const q = sql => { let st = stmts.get(sql); if (!st) { st = db.prepare(sql); stmts.set(sql, st); } return st; };
  // Versione dei dati: cambia a ogni scrittura (serve alle cache delle risposte).
  let version = 1;
  const bump = () => { version++; };
  const tx = fn => (...a) => { db.exec('BEGIN'); try { const r = fn(...a); db.exec('COMMIT'); bump(); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const like = t => '%' + t.replace(/[\\%_]/g, m => '\\' + m) + '%';
  const pub = u => u && { id: u.id, name: u.name, email: u.email, role: u.role, zone: u.zone || null, active: !!u.active };

  // --- Utenti e sessioni ---
  const S = {
    db, uid, close: () => db.close(), version: () => version,
    createUser({ name, email, password, role, zone }) {
      name = String(name || '').trim(); email = String(email || '').trim().toLowerCase();
      if (!ROLES.includes(role)) throw new Error('Ruolo non valido');
      if (!name || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Nome ed email validi sono obbligatori');
      if (String(password || '').length < 8) throw new Error('La password deve avere almeno 8 caratteri');
      if (q('SELECT 1 FROM users WHERE email=?').get(email)) throw Object.assign(new Error('Email già registrata'), { code: 409 });
      const salt = crypto.randomBytes(8).toString('hex'), id = uid();
      q('INSERT INTO users(id,name,email,salt,pw,role,zone,active,created) VALUES(?,?,?,?,?,?,?,1,?)').run(id, name, email, salt, hash(password, salt), role, zone || null, Date.now()); bump();
      return S.user(id);
    },
    user: id => (id ? pub(q('SELECT * FROM users WHERE id=?').get(String(id))) : null),
    users: (role) => q(`SELECT * FROM users ${role ? 'WHERE role=?' : ''} ORDER BY role, name`).all(...(role ? [role] : [])).map(pub),
    verify(email, password) {
      const u = q('SELECT * FROM users WHERE email=?').get(String(email || '').trim().toLowerCase());
      const ok = u && u.pw === hash(String(password || ''), u.salt);
      return ok && u.active ? pub(u) : null;
    },
    updateUser(id, f) {
      const u = q('SELECT * FROM users WHERE id=?').get(id); if (!u) return null;
      const n = { name: f.name ?? u.name, zone: f.zone === undefined ? u.zone : f.zone || null, active: f.active === undefined ? u.active : f.active ? 1 : 0, role: f.role ?? u.role };
      if (!ROLES.includes(n.role)) throw new Error('Ruolo non valido');
      q('UPDATE users SET name=?, zone=?, active=?, role=? WHERE id=?').run(String(n.name).trim() || u.name, n.zone, n.active, n.role, id);
      if (!n.active) S.dropSessions(id);
      bump(); return S.user(id);
    },
    setPassword(id, password) {
      if (String(password || '').length < 8) throw new Error('La password deve avere almeno 8 caratteri');
      const salt = crypto.randomBytes(8).toString('hex');
      q('UPDATE users SET salt=?, pw=? WHERE id=?').run(salt, hash(password, salt), id); S.dropSessions(id);
    },
    deleteUser: id => { S.dropSessions(id); q('DELETE FROM users WHERE id=?').run(id); bump(); },
    countRole: role => q('SELECT COUNT(*) n FROM users WHERE role=? AND active=1').get(role).n,
    createSession(userId) {
      const sid = crypto.randomBytes(24).toString('hex');
      q('DELETE FROM sessions WHERE expires<?').run(Date.now());
      q('INSERT INTO sessions(sid,user_id,expires) VALUES(?,?,?)').run(sid, userId, Date.now() + SESSION_DAYS * 864e5); return sid;
    },
    userBySid(sid) {
      if (!sid) return null;
      const u = q('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.sid=? AND s.expires>? AND u.active=1').get(sid, Date.now());
      return pub(u);
    },
    dropSession: sid => q('DELETE FROM sessions WHERE sid=?').run(sid || ''),
    dropSessions: id => q('DELETE FROM sessions WHERE user_id=?').run(id),
  };

  // --- Competizioni: SQLite è la fonte di verità, la cache in memoria serve a leggere velocemente ---
  const cache = new Map();
  let dataVersion = db.prepare('PRAGMA data_version').get().data_version;
  for (const r of q('SELECT data FROM competitions').all()) { const c = JSON.parse(r.data); cache.set(c.id, c); }
  Object.assign(S, {
    comps: () => [...cache.values()],
    comp: id => cache.get(id),
    saveComp(c) {
      q(`INSERT INTO competitions(id,owner_id,zone,name,date,weapon,category,gender,data) VALUES(?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id, zone=excluded.zone, name=excluded.name, date=excluded.date, weapon=excluded.weapon,
         category=excluded.category, gender=excluded.gender, data=excluded.data`)
        .run(c.id, c.ownerId || null, c.zone || 'nazionale', c.name, c.date || '', c.weapon || '', c.category || '', c.gender || 'M', JSON.stringify(c));
      cache.set(c.id, c); bump();
    },
    removeComp(id) { q('DELETE FROM competitions WHERE id=?').run(id); cache.delete(id); bump(); },
    // Se un altro processo ha modificato il database (import da riga di comando) si ricarica la cache delle gare.
    sync() {
      const dv = db.prepare('PRAGMA data_version').get().data_version;
      if (dv === dataVersion) return false;
      dataVersion = dv; cache.clear();
      for (const r of q('SELECT data FROM competitions').all()) { const c = JSON.parse(r.data); cache.set(c.id, c); }
      bump(); return true;
    },
  });

  // --- Ranking ---
  Object.assign(S, {
    // Sostituisce per intero una lista di ranking. Restituisce un riepilogo delle differenze.
    importList: tx(({ category, weapon, gender, entries, file = '', hash: fh = '', season = '', columns = null, legend = null, asOf = '', edition = '', title = '' }) => {
      const key = rankKey(category, weapon, gender), g = String(gender || 'M').toUpperCase();
      const old = new Map(q('SELECT name_key, pos FROM ranking_entries WHERE list_key=?').all(key).map(r => [r.name_key, r.pos]));
      q('DELETE FROM ranking_lists WHERE key=?').run(key);
      q('INSERT INTO ranking_lists(key,category,weapon,gender,season,file,file_hash,updated,count,columns,legend,as_of,edition,title) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(key, slug(category), slug(weapon), g, season, file, fh, Date.now(), entries.length, columns && JSON.stringify(columns), legend && JSON.stringify(legend), asOf, edition, title);
      const ins = q('INSERT INTO ranking_entries(list_key,name_key,name,club,club_key,pos,code,born,total,prev,diff,scores,places,note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
      let added = 0, changed = 0;
      for (const e of entries) {
        ins.run(key, e.key, pretty(e.name), e.club || '', R.norm(e.club || ''), e.pos, e.code || '', e.born || '', e.total ?? null, e.prev ?? null, e.diff ?? null, e.scores ? JSON.stringify(e.scores) : null, e.places ? JSON.stringify(e.places) : null, e.note || '');
        if (!old.has(e.key)) added++; else if (old.get(e.key) !== e.pos) changed++;
      }
      const seen = new Set(entries.map(e => e.key));
      return { key, count: entries.length, added, changed, removed: [...old.keys()].filter(k => !seen.has(k)).length, first: old.size === 0 };
    }),
    rankingLists: () => q('SELECT key, category, weapon, gender, season, file, updated, count, as_of, edition, title FROM ranking_lists ORDER BY weapon, category, gender').all(),
    rankingDetail: key => { const l = q('SELECT * FROM ranking_lists WHERE key=?').get(key); return l && { ...l, columns: l.columns ? JSON.parse(l.columns) : [], legend: l.legend ? JSON.parse(l.legend) : [] }; },
    rankingRows(key, { q: terms = [], offset = 0, limit = 50 } = {}) {
      const w = ['list_key=?', ...terms.map(() => `(name_key LIKE ? ESCAPE '\\' OR club_key LIKE ? ESCAPE '\\')`)].join(' AND ');
      const args = [key, ...terms.flatMap(t => [like(t), like(t)])];
      const total = q(`SELECT COUNT(*) n FROM ranking_entries WHERE ${w}`).get(...args).n;
      const rows = q(`SELECT name_key key, name, club, code, pos, born, total, prev, diff, scores, places, note FROM ranking_entries WHERE ${w} ORDER BY pos, name LIMIT ? OFFSET ?`).all(...args, limit, offset)
        .map(r => ({ ...r, scores: r.scores ? JSON.parse(r.scores) : null, places: r.places ? JSON.parse(r.places) : null }));
      return { total, rows };
    },
    rankingPos: (key, nameKey) => q('SELECT pos FROM ranking_entries WHERE list_key=? AND name_key=?').get(key, nameKey)?.pos ?? null,
    removeRankingFile: file => { const n = q('DELETE FROM ranking_lists WHERE file=?').run(file).changes; bump(); return n; },
    userByEmail: email => pub(q('SELECT * FROM users WHERE email=?').get(String(email).toLowerCase())),
    rankingList: key => q('SELECT key, category, weapon, gender, season, file, file_hash, updated, count FROM ranking_lists WHERE key=?').get(key),
    rankOf: (key, name) => q('SELECT pos FROM ranking_entries WHERE list_key=? AND name_key=?').get(key, R.nameKey(name))?.pos ?? null,
    athleteRankings: nk => q(`SELECT l.category, l.weapon, l.gender, l.season, l.file, l.updated, e.pos FROM ranking_entries e JOIN ranking_lists l ON l.key=e.list_key
      WHERE e.name_key=? ORDER BY l.weapon, l.category, l.gender`).all(nk),
    // Atleti e società presenti nei ranking (l'atleta compare anche se non ha mai gareggiato nell'app).
    rankedAthletes(terms, limit = 60) {
      const w = terms.map(() => `name_key LIKE ? ESCAPE '\\'`).join(' AND ');
      return q(`SELECT name_key key, MAX(name) name, MAX(club) club FROM ranking_entries WHERE ${w} GROUP BY name_key LIMIT ?`).all(...terms.map(like), limit);
    },
    rankedClubs(terms, limit = 60) {
      const w = terms.map(() => `club_key LIKE ? ESCAPE '\\'`).join(' AND ');
      return q(`SELECT club_key key, MAX(club) name, COUNT(DISTINCT name_key) count FROM ranking_entries WHERE club_key<>'' AND ${w} GROUP BY club_key LIMIT ?`).all(...terms.map(like), limit);
    },
    clubCodeByAthlete: code => q("SELECT club FROM ranking_entries WHERE code=? AND club<>'' LIMIT 1").get(String(code))?.club || '',
    athleteCodes: () => q("SELECT code, club FROM ranking_entries WHERE code<>'' AND club<>'' GROUP BY code").all(),
    rankedPerson: nk => q(`SELECT MAX(name) name, MAX(club) club FROM ranking_entries WHERE name_key=?`).get(nk),
    clubRanked: ck => q(`SELECT name_key key, MAX(name) name, MAX(club) club FROM ranking_entries WHERE club_key=? GROUP BY name_key`).all(ck),
    clubOfRanked: nk => q(`SELECT club FROM ranking_entries WHERE name_key=? AND club<>'' ORDER BY pos LIMIT 1`).get(nk)?.club || '',
  });

  // --- Società (codice Federscherma → nome) ---
  Object.assign(S, {
    // source 'manual' = rankings/societa.csv (prevale), 'auto' = ricavato dai PDF dei risultati.
    importClubs: tx((rows, source = 'manual') => {
      q('DELETE FROM clubs WHERE source=?').run(source);
      const ins = q(`INSERT OR ${source === 'manual' ? 'REPLACE' : 'IGNORE'} INTO clubs(code_key,code,name,name_key,city,source) VALUES(?,?,?,?,?,?)`);
      for (const c of rows) ins.run(R.norm(c.code), c.code, c.name, R.norm(c.name), c.city || '', source);
      return rows.length;
    }),
    clubRow: codeKey => q('SELECT code, name, city FROM clubs WHERE code_key=?').get(codeKey),
    clubKeyByName: nameKey => q('SELECT code_key FROM clubs WHERE name_key=?').get(nameKey)?.code_key || null,
    clubsByName(terms, limit = 60) {
      const w = terms.map(() => `name_key LIKE ? ESCAPE '\\'`).join(' AND ');
      return q(`SELECT code_key key, code, name, city FROM clubs WHERE ${w} LIMIT ?`).all(...terms.map(like), limit);
    },
    clubAthleteCount: ck => q('SELECT COUNT(DISTINCT name_key) n FROM ranking_entries WHERE club_key=?').get(ck).n,
  });

  // --- Migrazione una tantum dal vecchio data/db.json ---
  S.migrateJson = file => {
    if (!fs.existsSync(file) || q('SELECT COUNT(*) n FROM users').get().n) return false;
    const old = JSON.parse(fs.readFileSync(file, 'utf8'));
    tx(() => {
      for (const u of old.users || []) q('INSERT OR IGNORE INTO users(id,name,email,salt,pw,role,zone,active,created) VALUES(?,?,?,?,?,?,?,1,?)').run(u.id, u.name, u.email, u.salt, u.pw, 'director', null, Date.now());
      for (const c of old.competitions || []) {
        // I vecchi arbitri erano solo codici: ora servono account, quindi le assegnazioni vengono azzerate.
        c.referees = []; (c.pools || []).forEach(p => delete p.refereeId); (c.de?.rounds || []).flat().forEach(m => delete m.refereeId);
        S.saveComp(c);
      }
    })();
    return true;
  };
  return S;
}

module.exports = { open, ROLES, rankKey, slug, hash, uid };
