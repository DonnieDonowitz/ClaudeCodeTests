'use strict';
// Crea un account da riga di comando (serve per il primo amministratore).
//   npm run create-user -- --role admin --name "Mario Rossi" --email mario@esempio.it --password '********'
//   ruoli: admin | regional (con --zone marche) | director | referee
const path = require('path');
const { open } = require('../lib/store');
const arg = n => { const i = process.argv.indexOf('--' + n); return i < 0 ? undefined : process.argv[i + 1]; };
try {
  const s = open(process.env.TOUCHE_DB || path.join(__dirname, '..', 'data', 'touche.db'));
  const u = s.createUser({ name: arg('name'), email: arg('email'), password: arg('password'), role: arg('role'), zone: arg('zone') });
  console.log(`Creato ${u.role} ${u.email}`); s.close();
} catch (e) { console.error(e.message); process.exit(1); }
