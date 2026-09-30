'use strict';
// Dati dimostrativi (nomi e società INVENTATI). Uso: npm run seed  — sovrascrive data/db.json
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const E = require('../lib/engine');
const R = require('../lib/ranking');

let s = 42; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const uid = () => crypto.randomBytes(6).toString('hex');
const SURN = ['Rossi', 'Bianchi', 'Ferrari', 'Esposito', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi', 'Moretti', 'Barbieri', 'Fontana', 'Santoro', 'Mariani', 'Rinaldi', 'Caruso', 'Ferrara', 'Galli', 'Martini', 'Leone', 'Longo'];
const NAMES = ['Marco', 'Luca', 'Giulia', 'Sofia', 'Andrea', 'Chiara', 'Matteo', 'Elena', 'Davide', 'Sara', 'Paolo', 'Marta', 'Fabio', 'Irene', 'Simone'];
const CLUBS = ['Circolo Scherma Alba', 'Accademia Spade Nord', 'Sala d\'Armi Tirreno', 'Club Fioretto Adriatico', 'Scherma Colle Verde', 'Gladio Scherma', 'Fenice Scherma', 'Stocco Club'];
// ~80% degli atleti ha un ranking (posizioni casuali distinte), gli altri restano senza (9999).
const athletes = n => {
  const list = Array.from({ length: n }, (_, i) => ({ id: uid(), name: `${SURN[(i * 7) % SURN.length]} ${NAMES[(i * 5 + 3) % NAMES.length]}`, club: CLUBS[Math.floor(rnd() * CLUBS.length)], rank: null }));
  const pos = new Set(); while (pos.size < Math.round(n * 0.8)) pos.add(1 + Math.floor(rnd() * 250));
  [...pos].forEach((r, i) => { list[i].rank = r; list[i].manual = true; });
  return list.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
};

const salt = 'demo', user = { id: uid(), name: 'Direttore Demo', email: 'demo@touche.it', salt, pw: crypto.scryptSync('demo1234', salt, 32).toString('hex') };
const REFS = ['Bruno Ferri', 'Laura Serra', 'Enrico Vitale', 'Anna Pellegrini'];
const base = (name, date, place, weapon, category, n, zone, gender = 'M') => ({ id: uid(), ownerId: user.id, name, date, place, zone, weapon, category, gender, athletes: athletes(n), pools: null, de: null,
  referees: REFS.map(r => ({ id: uid(), name: r, code: String(100000 + Math.floor(rnd() * 900000)) })) });
const assign = c => { let k = 0; c.pools?.forEach(p => { p.refereeId = c.referees[k++ % c.referees.length].id; }); c.de?.rounds.flat().forEach(m => { if (m.a && m.b) m.refereeId = c.referees[k++ % c.referees.length].id; }); };
let clock = Date.now() - 3 * 3600e3; const tick = () => (clock += 20e3 + rnd() * 40e3);

function playPools(c, upTo = Infinity) {
  c.lots = Object.fromEntries(c.athletes.map(a => [a.id, rnd()]));
  c.pools = E.buildPools(c.athletes, 0);
  const rank = new Map(c.athletes.map((a, i) => [a.id, i])); let k = 0;
  for (const p of c.pools) for (const b of p.bouts) {
    if (k++ >= upTo) return;
    // il più forte (ranking migliore) vince più spesso
    const aWins = rnd() < 0.5 + (rank.get(b.b) - rank.get(b.a)) * 0.02;
    const lose = Math.floor(rnd() * 5); b.sa = aWins ? 5 : lose; b.sb = aWins ? lose : 5; b.t = tick();
  }
}
function playDE(c) {
  const rk = E.ranking(c.pools, c.athletes, c.lots).map(r => r.id);
  c.de = E.buildBracket(rk);
  c.de.rounds.forEach((rd, r) => rd.forEach((m, i) => {
    if (m.a && m.b && !m.winner) { const w = rnd() < 0.5 + (rk.indexOf(m.b) - rk.indexOf(m.a)) * 0.03; const lose = Math.floor(rnd() * 14); E.setDEScore(c.de.rounds, r, i, w ? 15 : lose, w ? lose : 15); m.t = tick(); }
  }));
}

const done = base('Trofeo Città di Esempio', '2026-09-13', 'Palazzetto Comunale, Torino', 'spada', 'Assoluti', 22, 'nazionale'); playPools(done); assign(done); playDE(done); assign(done);
const live = base('Coppa Adriatica', '2026-09-27', 'PalaScherma, Pesaro', 'fioretto', 'Juniores', 14, 'marche', 'F'); playPools(live, 30); assign(live);
const open = base('Gran Premio Colle Verde', '2026-10-18', 'Sala Armi Colle Verde, Verona', 'sciabola', 'Assoluti', 12, 'veneto');
const master = base('Trofeo Master Città di Esempio', '2026-09-20', 'Palestra Civica, Firenze', 'spada', 'Master', 10, 'master'); playPools(master); assign(master);
const reg = base('Regionale Piemonte Giovanissimi', '2026-10-04', 'Sala d\'Armi Nord, Torino', 'fioretto', 'Under-14', 16, 'piemonte');

const file = path.join(__dirname, '..', 'data', 'db.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
const competitions = [done, live, open, master, reg];
// Ranking dimostrativi per categoria/arma/sesso, come se caricati dai file Federscherma.
const rankings = {};
for (const c of competitions) rankings[[c.category, c.weapon, c.gender].map(x => x.toLowerCase()).join('|')] = { updated: Date.now(), file: 'ranking-demo.xlsx',
  map: Object.fromEntries(c.athletes.filter(a => a.rank).map(a => [R.nameKey(a.name), a.rank])), count: c.athletes.filter(a => a.rank).length };
fs.writeFileSync(file, JSON.stringify({ users: [user], sessions: {}, competitions, rankings }));
console.log('Dati demo scritti. Accesso direttore: demo@touche.it / demo1234');
