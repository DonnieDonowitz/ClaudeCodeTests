'use strict';
// Crea gli account dimostrativi (password demo1234) se mancano. NON tocca gare né ranking: quelle reali si importano con
// `npm run rankings` e `npm run results`. Uso: npm run seed
const path = require('path');
const { open } = require('../lib/store');

const store = open(process.env.TOUCHE_DB || path.join(__dirname, '..', 'data', 'touche.db'));
const accounts = [
  ['Amministratore Demo', 'admin@touche.it', 'admin'], ['Admin Marche Demo', 'marche@touche.it', 'regional', 'marche'], ['Admin Piemonte Demo', 'piemonte@touche.it', 'regional', 'piemonte'],
  ['Direttore Demo', 'demo@touche.it', 'director'], ['Arbitro Demo', 'arbitro@touche.it', 'referee'],
];
for (const [name, email, role, zone] of accounts) {
  try { store.createUser({ name, email, password: 'demo1234', role, zone }); console.log('creato', email, `(${role})`); } catch (e) { console.log('già presente', email); }
}
store.close();
console.log('Password di tutti gli account demo: demo1234 — cambiale o disattivali prima di mettere l\'app online.');
