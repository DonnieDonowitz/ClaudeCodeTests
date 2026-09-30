'use strict';
// Legge i PDF dei risultati Federscherma ("Classifica definitiva | Spada maschile | …") e ne ricava gare, classifiche e società.
const R = require('./ranking');
const { pdfRaw, pageLines } = require('./pdf');
const { parseDetail, buildDetail } = require('./resultsDetail');

const WEAPONS = { fioretto: 'fioretto', spada: 'spada', sciabola: 'sciabola' };
const SMALL = /(?<=.) (Di|Del|Della|Dei|Delle|Dello|Degli|Da|De|E|Al|Alla|Allo|Ai|In|Per|Su|Sul|Sulla|Con)(?= )/g;
const pretty = n => n === n.toUpperCase() ? n.toLowerCase().replace(/(^|[\s'’(/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(SMALL, m => m.toLowerCase()) : n;
// Sigle che nei nomi delle società restano maiuscole.
const ACR = /\b(Cus|Cds|Ss|Ssd|Asd|Gs|Gsp|As|Uisp|Tbb|Asi|Csen|Cc|Srl|Spa|Fis|Gsa|Cras|Sc|Scd)\b/g;
const prettyClub = n => pretty(n).replace(ACR, m => m.toUpperCase());
const iso = d => { const m = /^(\d\d)\/(\d\d)\/(\d\d(?:\d\d)?)$/.exec(d || ''); return m ? `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2]}-${m[1]}` : ''; };
const CAT_CELL = [[/^cat\.?\s*(\d)/i, m => `Master Cat. ${m[1]}`], [/allievi/i, () => 'Allievi'], [/giovanissim/i, () => 'Giovanissimi'], [/maschietti|bambin/i, () => 'Bambini'],
  [/ragazz/i, () => 'Ragazzi'], [/non vedenti/i, () => 'Non vedenti'], [/^categoria\s+(\w)/i, m => `Categoria ${m[1].toUpperCase()}`]];
const CAT_EVENT = [[/master/i, 'Master'], [/cadett/i, 'Cadetti'], [/giovani/i, 'Giovani'], [/under\s*23|u23/i, 'Under-23'], [/assolut/i, 'Assoluti'], [/non vedenti/i, 'Non vedenti'],
  [/integrata/i, 'Integrata'], [/giovanissimi|joy of moving|under\s*14|-14/i, 'Under-14']];

// Interpreta un PDF già convertito in righe di celle. Restituisce { kind: 'individual'|'team'|'unknown', ... }.
function parseResults(pages) {
  const lines = pages.flat();
  const head = lines.slice(0, 10);
  const cls = head.find(l => /^Classifica (definitiva|provvisoria)/i.test(l[0]));
  if (!cls) return { kind: 'unknown' };
  const state = /provvisoria/i.test(cls[0]) ? 'provvisoria' : 'definitiva';
  const event = (head[1] || [''])[0];
  const w = /(fioretto|spada|sciabola)\s+(maschile|femminile)(\s+a squadre)?/i.exec(cls[1] || '');
  if (!w) return { kind: 'unknown', event };
  const where = cls.slice(2).join(' '), pl = /^(.*?)\s*\(([A-Z]{2})\)\s*-\s*/.exec(where);
  let place = pl ? pl[1] : /^([^-]+?)\s*-\s/.exec(where)?.[1] || '';
  if (/^italia$/i.test(place)) place = '';
  const stampaIdx = head.findIndex(l => l.includes('Stampa:')), stampa = head[stampaIdx] || [];
  const printed = iso(stampa[stampa.indexOf('Stampa:') + 1]);
  const base = { state, event, weapon: WEAPONS[w[1].toLowerCase()], gender: w[2].toLowerCase() === 'femminile' ? 'F' : 'M', place, province: pl?.[2] || '', printed };

  if (w[3]) { // gare a squadre: ci servono solo codice/sigla/denominazione/località delle società
    const clubs = [];
    for (const l of lines) {
      const m = /^\d+ \| \d+ \| \d+ \| \d+(?: \| | )([A-Z][A-Z0-9]{3,5}) \| (.+?) \| ([^|]+)$/.exec(l.join(' | '));
      if (m) clubs.push({ code: m[1], name: m[2], city: m[3] });
    }
    return { kind: 'team', ...base, clubs };
  }

  // categoria: dalla riga sotto la testata (Cat.2 (50+), Allievi/Allieve, …), altrimenti dal nome della gara
  const sub = head[head.indexOf(cls) + 1] || [];
  let category = '';
  for (const c of [...sub, ...head.slice(0, 6).flat()]) { const hit = CAT_CELL.find(([re]) => re.test(c)); if (hit) { category = hit[1](hit[0].exec(c)); break; } }
  if (!category) category = CAT_EVENT.find(([re]) => re.test(event))?.[1] || 'Assoluti';
  if (/^Master Cat/.test(category) === false && /master/i.test(event)) category = 'Master';

  const rows = [];
  for (const l of lines) {
    const s = l.join(' | ');
    const m = /^(\d+) \| (\d{4,7}) (.+?) \| (.*?) \| (\d\d\/\d\d\/\d\d(?:\d\d)?)(?: \| (.*))?$/.exec(s);
    if (m) rows.push({ pos: +m[1], code: m[2], surname: m[3], given: m[4], born: m[5], club: (m[6] || '').trim() });
  }
  // Altre sezioni del PDF (gironi, iscritti) riportano "COGNOME | NOME | SIGLA | data | NumFis": servono a collegare codice FIS e società.
  const sigla = {};
  for (const l of lines) { const m = /\| ([A-Z][A-Z0-9]{3,5}) \| \d\d\/\d\d\/\d\d(?:\d\d)? \| (\d{4,7})$/.exec(l.join(' | ')); if (m) sigla[m[2]] = m[1]; }
  // Classifica iniziale per ranking: "progr. | SI/NO | posizione in ranking | cognome | nome | sigla | data | NumFis"
  const seedRank = {};
  for (const l of lines) { const m = /^\d+ \| (?:SI|NO) \| (\d+) \| .+ \| [A-Z][A-Z0-9]{2,5} \| \d\d\/\d\d\/\d\d(?:\d\d)? \| (\d{4,7})$/.exec(l.join(' | ')); if (m) seedRank[m[2]] = +m[1]; }
  return { kind: 'individual', ...base, category, rows, sigla, seedRank };
}

async function parsePdf(buf) {
  const raw = await pdfRaw(buf), r = parseResults(raw.map(pageLines));
  if (r.kind === 'individual') { try { r.detail = parseDetail(raw); } catch (e) { r.detailError = e.message; } }
  return r;
}

// Gara nel formato dell'app (conclusa, con la sola classifica finale).
function toCompetition(r, { id, source, group }) {
  const catLabel = r.category;
  const athletes = r.rows.map((x, i) => ({ id: `${id}a${i}`, name: pretty(`${x.surname} ${x.given}`.replace(/\s+/g, ' ').trim()), club: prettyClub(x.club), fis: x.code, rank: null, manual: true }));
  const poolSigla = {};
  for (const p of r.detail?.pools || []) for (const x of p.rows) if (x.sigla) poolSigla[x.code] = x.sigla;
  const det = r.detail ? buildDetail(r.detail, athletes, a => r.sigla?.[a.fis] || poolSigla[a.fis] || '') : {};
  for (const a of athletes) if (r.seedRank?.[a.fis]) a.rank = r.seedRank[a.fis];
  return {
    id, ownerId: null, name: r.event, group,
    date: r.printed, place: r.place, weapon: r.weapon, category: catLabel, gender: r.gender,
    zone: /master/i.test(r.event) || /^Master/.test(catLabel) ? 'master' : 'nazionale', referees: [], athletes, pools: det.pools || null, de: det.de || null,
    imported: { ...source, v: 3, state: r.state, final: r.rows.map((x, i) => ({ id: athletes[i].id, pos: x.pos })) },
  };
}

// Società: sigla → denominazione dalle gare a squadre; per le altre si usa il codice FIS degli atleti (presente nei ranking) con la denominazione del PDF.
function buildClubs(store, parsed) {
  const out = new Map(); // code → { code, name, city }
  for (const r of parsed) if (r.kind === 'team') for (const c of r.clubs) out.set(c.code, { code: c.code, name: prettyClub(c.name), city: pretty(c.city) });
  const votes = new Map();
  for (const r of parsed) if (r.kind === 'individual') for (const x of r.rows) {
    if (!x.club) continue;
    const code = r.sigla?.[x.code] || store.clubCodeByAthlete(x.code); if (!code || out.has(code)) continue;
    const v = votes.get(code) || new Map(); v.set(x.club, (v.get(x.club) || 0) + 1); votes.set(code, v);
  }
  for (const [code, v] of votes) {
    const best = [...v].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
    out.set(code, { code, name: prettyClub(best), city: '' });
  }
  return [...out.values()];
}

module.exports = { parseResults, parsePdf, toCompetition, buildClubs, pretty, prettyClub };
