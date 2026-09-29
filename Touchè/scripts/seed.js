'use strict';
// Dati dimostrativi (nomi e società INVENTATI). Uso: npm run seed  — sovrascrive data/db.json
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const E = require('../lib/engine');

let s = 42; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const uid = () => crypto.randomBytes(6).toString('hex');
const SURN = ['Rossi', 'Bianchi', 'Ferrari', 'Esposito', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro', 'Mariani', 'Rinaldi', 'Caruso', 'Ferrara', 'Galli', 'Martini', 'Leone', 'Longo'];
const NAMES = ['Marco', 'Luca', 'Giulia', 'Sofia', 'Andrea', 'Chiara', 'Matteo', 'Elena', 'Davide', 'Sara', 'Paolo', 'Marta', 'Fabio', 'Irene', 'Simone'];
const CLUBS = ['Circolo Scherma Alba', 'Accademia Spade Nord', 'Sala d\'Armi Tirreno', 'Club Fioretto Adriatico', 'Scherma Colle Verde', 'Gladio Scherma', 'Fenice Scherma', 'Stocco Club'];
const athletes = n => Array.from({ length: n }, (_, i) => ({ id: uid(), name: `${SURN[(i * 7) % SURN.length]} ${NAMES[(i * 5 + 3) % NAMES.length]}`, club: CLUBS[Math.floor(rnd() * CLUBS.length)] }));

const salt = 'demo', user = { id: uid(), name: 'Direttore Demo', email: 'demo@touche.it', salt, pw: crypto.scryptSync('demo1234', salt, 32).toString('hex') };
const base = (name, date, place, weapon, category, n) => ({ id: uid(), ownerId: user.id, name, date, place, weapon, category, athletes: athletes(n), pools: null, de: null });

function playPools(c, upTo = Infinity) {
  c.lots = Object.fromEntries(c.athletes.map(a => [a.id, rnd()]));
  c.pools = E.buildPools(c.athletes, 0);
  const rank = new Map(c.athletes.map((a, i) => [a.id, i])); let k = 0;
  for (const p of c.pools) for (const b of p.bouts) {
    if (k++ >= upTo) return;
    // il più forte (ranking migliore) vince più spesso
    const aWins = rnd() < 0.5 + (rank.get(b.b) - rank.get(b.a)) * 0.02;
    const lose = Math.floor(rnd() * 5); b.sa = aWins ? 5 : lose; b.sb = aWins ? lose : 5;
  }
}
function playDE(c) {
  const rk = E.ranking(c.pools, c.athletes, c.lots).map(r => r.id);
  c.de = E.buildBracket(rk);
  c.de.rounds.forEach((rd, r) => rd.forEach((m, i) => {
    if (m.a && m.b && !m.winner) { const w = rnd() < 0.5 + (rk.indexOf(m.b) - rk.indexOf(m.a)) * 0.03; const lose = Math.floor(rnd() * 14); E.setDEScore(c.de.rounds, r, i, w ? 15 : lose, w ? lose : 15); }
  }));
}

const done = base('Trofeo Città di Esempio', '2026-09-13', 'Palazzetto Comunale, Torino', 'spada', 'Assoluti M', 22); playPools(done); playDE(done);
const live = base('Coppa Adriatica', '2026-09-27', 'PalaScherma, Pesaro', 'fioretto', 'Under 20 F', 14); playPools(live, 30);
const open = base('Gran Premio Colle Verde', '2026-10-18', 'Sala Armi Colle Verde, Verona', 'sciabola', 'Assoluti M', 12);

const file = path.join(__dirname, '..', 'data', 'db.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify({ users: [user], sessions: {}, competitions: [done, live, open] }));
console.log('Dati demo scritti. Accesso direttore: demo@touche.it / demo1234');
