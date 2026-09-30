
'use strict';
// Avvio del server: database, contesto di dominio, route e livello HTTP (lib/http.js).
const path = require('path');
const Store = require('./lib/store');
const { createApp } = require('./lib/http');
const createContext = require('./lib/context');

const DB_FILE = process.env.TOUCHE_DB || path.join(__dirname, 'data', 'touche.db');

const S = Store.open(DB_FILE);
if (process.env.TOUCHE_DB === undefined && S.migrateJson(path.join(__dirname, 'data', 'db.json'))) console.log('Dati importati dal vecchio data/db.json (gli arbitri vanno ricreati come account).');
if (!S.countRole('admin')) {
  if (process.env.TOUCHE_ADMIN_EMAIL && process.env.TOUCHE_ADMIN_PASSWORD) {
    S.createUser({ name: 'Amministratore', email: process.env.TOUCHE_ADMIN_EMAIL, password: process.env.TOUCHE_ADMIN_PASSWORD, role: 'admin' });
    console.log('Creato amministratore ' + process.env.TOUCHE_ADMIN_EMAIL);
  } else console.log('ATTENZIONE: nessun amministratore. Crealo con: npm run create-user -- --role admin --email ... --name ... --password ...');
}

const ctx = createContext(S);
// Risposte pubbliche (uguali per tutti gli utenti) tenute in cache finché i dati non cambiano.
const cacheable = p => /^\/api\/(competitions|live|search|rankings(\/[^/]+)?|athletes\/[^/]+|clubs\/[^/]+|logos|categories|zones)$/.test(p);
let lastSync = 0;
const app = createApp({
  publicDir: path.join(__dirname, 'public'), version: S.version, cacheable,
  // se un altro processo (npm run results / rankings) ha scritto nel database, si ricarica la cache delle gare
  sync: () => { const now = Date.now(); if (now - lastSync > 1000) { lastSync = now; S.sync(); } },
});
for (const m of ['auth', 'users', 'competitions', 'public']) require('./routes/' + m)(app.route, ctx);

const server = app.server;
const PORT = process.env.PORT || 3000;
if (require.main === module) server.listen(PORT, () => console.log(`Touchè su http://localhost:${PORT}`));
module.exports = { server, S };
