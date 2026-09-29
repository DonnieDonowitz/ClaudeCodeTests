'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { iscrizioni: 'Iscrizioni', gironi: 'Gironi', tabellone: 'Tabellone', concluso: 'Concluso' };
const REGIONS = { 'abruzzo': 'Abruzzo', 'basilicata': 'Basilicata', 'calabria': 'Calabria', 'campania': 'Campania', 'emilia-romagna': 'Emilia-Romagna', 'friuli-venezia-giulia': 'Friuli-Venezia Giulia', 'lazio': 'Lazio', 'liguria': 'Liguria', 'lombardia': 'Lombardia', 'marche': 'Marche', 'molise': 'Molise', 'piemonte': 'Piemonte', 'puglia': 'Puglia', 'sardegna': 'Sardegna', 'sicilia': 'Sicilia', 'toscana': 'Toscana', 'trentino-alto-adige': 'Trentino-Alto Adige', 'umbria': 'Umbria', 'valle-d-aosta': 'Valle d\'Aosta', 'veneto': 'Veneto' };
const CATEGORIES = ['Giovani', 'Assoluti', 'Under-23', 'Cadetti', 'Juniores', 'Under-14', 'Master'];
const ZONE = { nazionale: 'Nazionali', master: 'Master', ...REGIONS };
let me = null, timer = null, tab = 'atleti';

async function api(method, url, body) {
  const r = await fetch('/api' + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Errore');
  return d;
}
const act = fn => async (...a) => { try { await fn(...a); } catch (e) { alert(e.message); } };
const ago = t => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'ora' : s < 3600 ? Math.round(s / 60) + ' min fa' : s < 86400 ? Math.round(s / 3600) + ' h fa' : new Date(t).toLocaleDateString('it-IT'); };

function nav() {
  $('#nav').innerHTML = !me ? `<a href="#/arbitro">Arbitri</a><a href="#/login">Direttori</a>`
    : me.role === 'referee' ? `<span class="mute">Arbitro · ${esc(me.name)}</span><a href="#/c/${me.competitionId}">La mia gara</a><a href="#" id="out">Esci</a>`
    : `<span class="mute">${esc(me.name)}</span><a href="#/new">Nuova gara</a><a href="#" id="out">Esci</a>`;
  const o = $('#out'); if (o) o.onclick = async e => { e.preventDefault(); await api('POST', '/logout'); me = null; nav(); location.hash = '#/'; };
}

/* ---------- Home / dashboard ---------- */
async function home(zone) {
  const [list, live] = await Promise.all([api('GET', '/competitions'), api('GET', '/live')]);
  const count = {}, active = {};
  list.forEach(c => { count[c.zone] = (count[c.zone] || 0) + 1; if (c.status === 'gironi' || c.status === 'tabellone') active[c.zone] = true; });
  const tile = (z, big) => `<a class="zone ${big ? 'big' : ''} ${zone === z ? 'on' : ''} ${count[z] ? '' : 'zero'}" href="#/${zone === z ? '' : 'z/' + z}"><b>${active[z] ? '<i class="dot"></i>' : ''}${esc(ZONE[z])}</b><span>${count[z] || 0} ${count[z] === 1 ? "gara" : "gare"}</span></a>`;
  const shown = list.filter(c => !zone || c.zone === zone), feed = live.filter(f => !zone || f.zone === zone);
  $('#app').innerHTML = `<h1>Competizioni</h1><p class="mute">Tutta la scherma italiana, in tempo reale.</p>
    <h2>Circuiti</h2><div class="zones top">${tile('nazionale', 1)}${tile('master', 1)}</div>
    <h2>Regioni</h2><div class="zones">${Object.keys(REGIONS).map(z => tile(z)).join('')}</div>
    ${feed.length ? `<h2><i class="dot"></i>Risultati in diretta</h2><div class="list feed">${feed.slice(0, 8).map(f => {
      const wa = f.sa > f.sb;
      return `<div class="r"><div>${wa ? '<b>' + esc(f.a) + '</b>' : esc(f.a)} <span class="sc">${f.forfeit ? 'V*' : f.sa + ' – ' + f.sb}</span> ${!wa ? '<b>' + esc(f.b) + '</b>' : esc(f.b)}
        <small>${esc(f.phase)} · ${esc(f.c)}${f.ref ? ' · Arb. ' + esc(f.ref) : ''}</small></div><span class="mute">${ago(f.t)}</span></div>`; }).join('')}</div>` : ''}
    <h2>${zone ? esc(ZONE[zone]) : 'Tutte le gare'}</h2><div class="list">${shown.map(c => {
      const pr = c.progress, live = c.status === 'gironi' || c.status === 'tabellone';
      return `<a class="item" href="#/c/${c.id}"><div><b>${esc(c.name)}</b><div class="mute">${esc(ZONE[c.zone])} · ${esc(c.weapon)} · ${esc(c.category)} · ${esc(c.place)} · ${esc(c.date)}</div></div>
      <div><span class="badge ${c.status}">${live ? '<i class="dot"></i>' : ''}${STATUS[c.status]}</span>${live && pr.total ? `<div class="bar"><i style="width:${Math.round(100 * pr.done / pr.total)}%"></i></div>` : `<span class="mute">${c.athletes} atleti</span>`}</div></a>`; }).join('') || '<p class="mute" style="padding:16px;margin:0">Nessuna gara in questa zona.</p>'}</div>`;
}

/* ---------- Accesso ---------- */
function authView(mode) {
  const reg = mode === 'register';
  $('#app').innerHTML = `<div class="card" style="max-width:420px;margin:30px auto"><h1>${reg ? 'Registrati' : 'Direttori di gara'}</h1>
  <form id="f" style="display:grid;gap:10px">${reg ? '<input name="name" placeholder="Nome e cognome" required>' : ''}
  <input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Password" required>
  ${reg ? '<input name="invite" placeholder="Codice invito" required>' : ''}
  <button class="primary">${reg ? 'Crea account' : 'Entra'}</button></form>
  <p class="mute"><a href="#/${reg ? 'login' : 'register'}">${reg ? 'Hai già un account? Accedi' : 'Nuovo direttore? Registrati'}</a> · <a href="#/arbitro">Sono un arbitro</a></p></div>`;
  $('#f').onsubmit = act(async e => { e.preventDefault(); me = await api('POST', reg ? '/register' : '/login', Object.fromEntries(new FormData(e.target))); me.role = 'director'; nav(); location.hash = '#/'; });
}
function refereeLogin() {
  $('#app').innerHTML = `<div class="card" style="max-width:420px;margin:30px auto"><h1>Area arbitri</h1><p class="mute">Inserisci il codice a 6 cifre che ti ha dato il direttore di gara.</p>
  <form id="f" style="display:grid;gap:10px"><input name="code" inputmode="numeric" maxlength="6" placeholder="000000" style="font-size:28px;text-align:center;letter-spacing:.3em" required><button class="primary">Accedi</button></form></div>`;
  $('#f').onsubmit = act(async e => { e.preventDefault(); me = await api('POST', '/referee/login', Object.fromEntries(new FormData(e.target))); nav(); location.hash = '#/c/' + me.competitionId; });
}
function newView() {
  if (!me || me.role !== 'director') return location.hash = '#/login';
  $('#app').innerHTML = `<h1>Nuova gara</h1><div class="card"><form id="f" class="grid">
  <div><label>Nome</label><input name="name" required></div><div><label>Data</label><input type="date" name="date"></div>
  <div><label>Zona</label><select name="zone">${Object.entries(ZONE).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></div>
  <div><label>Luogo</label><input name="place"></div><div><label>Categoria</label><select name="category">${CATEGORIES.map(x => `<option>${x}</option>`).join('')}</select></div>
  <div><label>Sesso</label><select name="gender"><option value="M">Maschile</option><option value="F">Femminile</option></select></div>
  <div><label>Arma</label><select name="weapon"><option>spada</option><option>fioretto</option><option>sciabola</option></select></div>
  <div style="align-self:end"><button class="primary">Crea</button></div></form></div>`;
  $('#f').onsubmit = act(async e => { e.preventDefault(); const r = await api('POST', '/competitions', Object.fromEntries(new FormData(e.target))); location.hash = '#/c/' + r.id; });
}

/* ---------- Gara ---------- */
async function compView(id, t, poll) {
  const c = await api('GET', '/competitions/' + id);
  if (poll && (document.activeElement?.matches('textarea,select,input:not([data-live])') || document.querySelector('dialog[open]'))) return;
  tab = t || tab;
  const avail = ['atleti', ...(c.pools ? ['gironi', 'classifica'] : []), ...(c.de ? ['tabellone'] : []), ...(c.final?.length ? ['finale'] : []), ...(c.canEdit ? ['arbitri'] : [])];
  if (!avail.includes(tab)) tab = avail.filter(x => x !== 'arbitri').at(-1);
  const name = Object.fromEntries(c.athletes.map(a => [a.id, a]));
  const n = id => name[id] ? esc(name[id].name) : '<span class="mute">—</span>';
  const ae = document.activeElement, keep = ae?.dataset?.live !== undefined && $('#app').contains(ae)
    ? { sel: `[data-de="${ae.dataset.de}"][data-s="${ae.dataset.s}"]`, v: ae.value } : null;
  const body = { atleti: () => athletesTab(c), gironi: () => poolsTab(c, n), classifica: () => rankTab(c, n), tabellone: () => bracketTab(c, n), finale: () => finalTab(c, n), arbitri: () => refereesTab(c) }[tab]();
  const mineP = c.referee ? (c.pools || []).filter(p => p.refereeId === c.referee.id).length : 0;
  const mineM = c.referee ? (c.de?.rounds || []).flat().filter(m => m.refereeId === c.referee.id && !m.winner).length : 0;
  $('#app').innerHTML = `<div class="row2" style="justify-content:space-between"><div><h1>${esc(c.name)}</h1>
    <div class="mute">${esc(ZONE[c.zone])} · ${esc(c.weapon)} · ${esc(c.category)} ${esc(c.gender || 'M')} · ${esc(c.place)} · ${esc(c.date)} · direttore: ${esc(c.owner)}</div></div>
    <span class="badge ${c.status}">${STATUS[c.status]}</span></div>
    ${c.referee ? `<div class="banner">Ciao <b>${esc(c.referee.name)}</b>: ${mineP} gironi e ${mineM} assalti del tabellone ti aspettano. Tocca una cella della griglia (o un punteggio nel tabellone) per inserire il risultato.</div>` : ''}
    <div class="tabs">${avail.map(x => `<a href="#/c/${id}/${x}" class="${x === tab ? 'on' : ''}">${x[0].toUpperCase() + x.slice(1)}</a>`).join('')}</div>${body}`;
  bind(c);
  if (keep) { const el = document.querySelector('input[data-live]' + keep.sel); if (el) { el.value = keep.v; el.focus(); } }
}

function athletesTab(c) {
  const e = c.canEdit && !c.pools, ri = c.rankingInfo;
  return `<div class="card"><table><tr><th>#</th><th>Ranking</th><th class="l">Atleta</th><th class="l">Società</th>${e ? '<th></th>' : ''}</tr>` +
    c.athletes.map((a, i) => `<tr style="${a.absent ? 'opacity:.45;text-decoration:line-through' : ''}"><td>${i + 1}</td><td><b class="${a.rank == null ? 'mute' : ''}">${a.rank ?? 9999}</b></td><td class="l">${esc(a.name)}</td><td class="l">${esc(a.club)}</td>${e ? `<td><button class="small" data-ab="${a.id}">${a.absent ? 'presente' : 'assente'}</button> <button class="small danger" data-rm="${a.id}">✕</button></td>` : ''}</tr>`).join('') +
    `</table>${c.athletes.length ? '' : '<p class="mute">Nessun iscritto.</p>'}<p class="hint">Gli atleti sono ordinati per ranking; senza ranking valgono 9999 e vengono sorteggiati.</p></div>` +
    (e ? `<div class="card"><label>Ranking Federscherma · ${esc(c.category)} · ${esc(c.weapon)} · ${c.gender === 'F' ? 'femminile' : 'maschile'}</label>
      <p class="mute">${ri ? `Caricato: ${ri.count} atleti da <b>${esc(ri.file)}</b> (${new Date(ri.updated).toLocaleDateString('it-IT')}). Carica di nuovo il file quando il ranking viene aggiornato.` : 'Nessun ranking caricato. Scarica il file Excel dal sito della Federscherma e caricalo qui.'}</p>
      <input type="file" id="rkfile" accept=".xlsx,.csv"></div>
      <div class="card"><label>Aggiungi atleti — una riga ciascuno: Cognome Nome, Società (facoltativo: , ranking manuale)</label>
      <textarea id="ath" rows="5"></textarea><div class="row2" style="margin-top:8px"><button id="addAth">Aggiungi</button></div></div>
      <div class="card row2"><label style="margin:0">Numero gironi</label><input id="pc" type="number" min="1" placeholder="auto" style="width:90px">
      <button class="primary" id="genPools">Genera gironi</button></div>` : '') +
    (c.canEdit ? `<button class="danger small" id="delComp">Elimina gara</button>` : '');
}

const refSelect = (c, attr, val, cur) => `<select class="mini" ${attr}="${val}"><option value="">Arbitro: —</option>${(c.referees || []).map(r => `<option value="${r.id}" ${r.id === cur ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>`;
const refName = (c, id) => (c.referees || []).find(r => r.id === id)?.name;

function poolsTab(c, n) {
  const st = Object.fromEntries(c.ranking.map(r => [r.id, r]));
  const rk = Object.fromEntries(c.ranking.map((r, i) => [r.id, i]));
  const club = Object.fromEntries(c.athletes.map(a => [a.id, a.club]));
  return `<div class="pools">` + c.pools.map(p => {
    const mine = c.referee && p.refereeId === c.referee.id, edit = !c.de && (c.canEdit || mine), A = p.athletes;
    const order = [...A].sort((x, y) => rk[x] - rk[y]), any = A.some(a => st[a].m);
    const cell = (i, j) => {
      const b = p.bouts.find(x => (x.a === A[i] && x.b === A[j]) || (x.a === A[j] && x.b === A[i]));
      if (!b || b.sa == null) return { t: '', v: false };
      const own = b.a === A[i] ? b.sa : b.sb, opp = b.a === A[i] ? b.sb : b.sa;
      return { t: own > opp ? (own === 5 ? 'V' : 'V' + own) : String(own), v: own > opp };
    };
    const rows = A.map((a, i) => `<tr><td class="n">${i + 1}</td><td class="nm">${n(a)}<small>${esc(club[a])}</small></td>${A.map((_, j) => {
      if (i === j) return '<td class="x"></td>';
      const x = cell(i, j);
      return `<td class="c ${x.v ? 'v' : ''} ${edit ? 'e' : ''}" ${edit ? `data-p="${p.index}" data-a="${a}" data-b="${A[j]}"` : ''}>${x.t}</td>`;
    }).join('')}<td class="s">${st[a].v}</td><td class="s">${st[a].m}</td><td class="s">${st[a].m ? (st[a].v / st[a].m).toFixed(2) : ''}</td><td class="s">${st[a].ts}</td><td class="s">${st[a].tr}</td><td class="s">${st[a].m ? (st[a].ind > 0 ? '+' : '') + st[a].ind : ''}</td><td class="s pl">${any ? order.indexOf(a) + 1 : ''}</td></tr>`).join('');
    return `<div class="card ${mine ? 'mine' : ''}"><div class="pool-h"><b>Girone ${p.index}</b>
      ${c.canEdit && !c.de ? refSelect(c, 'data-refpool', p.index, p.refereeId) : `<span class="ref">${p.refereeId ? 'Arbitro: <b>' + esc(refName(c, p.refereeId) || '') + '</b>' : ''}</span>`}</div>
      <div class="mx-wrap"><table class="mx"><tr><th>#</th><th class="l">Atleta</th>${A.map((_, i) => `<th>${i + 1}</th>`).join('')}<th>V</th><th>M</th><th>V/M</th><th>TS</th><th>TR</th><th>Ind</th><th>Pl</th></tr>${rows}</table></div>
      ${edit ? '<p class="hint">Tocca una cella per inserire le stoccate dell\'assalto.</p>' : ''}</div>`;
  }).join('') + `</div>` + (c.canEdit ? `<div class="card row2" style="margin-top:16px">
    ${!c.de ? `<button class="primary" id="genDE">Genera tabellone</button><button class="danger" id="resetPools">Rigenera gironi</button>` : '<span class="mute">Tabellone generato: gironi bloccati.</span>'}</div>` : '');
}

function rankTab(c, n) {
  return `<div class="card"><table><tr><th>Pos</th><th class="l">Atleta</th><th>V</th><th>M</th><th>V/M</th><th>TS</th><th>TR</th><th>Ind</th></tr>` +
    c.ranking.map(r => `<tr><td>${r.rank}${r.tie ? '*' : ''}</td><td class="l">${n(r.id)}</td><td>${r.v}</td><td>${r.m}</td><td>${r.ratio.toFixed(2)}</td><td>${r.ts}</td><td>${r.tr}</td><td>${r.ind > 0 ? '+' : ''}${r.ind}</td></tr>`).join('') + '</table>' +
    (c.ranking.some(r => r.tie) ? '<p class="mute">* Ex aequo su V/M, indice e TS: posizione decisa per sorteggio.</p>' : '') + '</div>';
}

function roundName(size, r) {
  const left = size / 2 ** r;
  return left === 2 ? 'Finale' : left === 4 ? 'Semifinali' : left === 8 ? 'Quarti' : `Tabellone dei ${left}`;
}
let brRound = 'all';
function bracketTab(c, n0) {
  const { size, rounds } = c.de, last = rounds.length - 1, champ = rounds[last][0].winner;
  const pos = Object.fromEntries(c.ranking.map(r => [r.id, r.rank]));
  // Posizione dopo i gironi davanti al nome.
  const n = id => (id ? `<i class="seed" title="Posizione dopo i gironi">${pos[id] ?? ''}</i>` : '') + n0(id);
  const isBye = (r, m) => r === 0 && (!m.a || !m.b);
  const total = (rd, r) => rd.filter(m => !isBye(r, m)).length, done = (rd, r) => rd.filter(m => m.winner && !isBye(r, m)).length;

  const card = (r, i, m, list) => {
    if (isBye(r, m)) return `<div class="match bye"><div class="row w"><span>${n(m.a || m.b)}</span><span class="mute">bye</span></div></div>`;
    const mine = c.referee && m.refereeId === c.referee.id, ed = c.canEdit || mine;
    const row = (id, s, w) => `<div class="row ${m.winner && m.winner === id ? 'w' : ''}"><span>${n(id)}</span><span>${m.forfeit ? (m.winner === id ? '<b>V*</b>' : '') : m.a && m.b && ed ? `<input data-live data-de="${r}/${i}" data-s="${s}" value="${w ?? ''}" inputmode="numeric">${c.canEdit ? ` <button class="small" data-ff="${r}/${i}" data-side="${s}" title="Vittoria a tavolino">F</button>` : ''}` : `<b>${w ?? ''}</b>`}</span></div>`;
    const foot = m.a && m.b && !m.winner && c.canEdit ? refSelect(c, 'data-refde', `${r}/${i}`, m.refereeId) : m.refereeId ? `<span>Arbitro: <b>${esc(refName(c, m.refereeId) || '')}</b></span>` : '';
    return `<div class="match ${mine ? 'mine' : ''}">${row(m.a, 'a', m.sa)}${row(m.b, 'b', m.sb)}</div>${foot ? `<div class="${list ? 'foot' : 'refl'}">${foot}</div>` : ''}`;
  };

  const sel = `<div class="tabs sub"><a href="#" data-rd="all" class="${brRound === 'all' ? 'on' : ''}">Tutto il tabellone</a>${rounds.map((rd, r) =>
    `<a href="#" data-rd="${r}" class="${String(brRound) === String(r) ? 'on' : ''}">${roundName(size, r)} <small>${done(rd, r)}/${total(rd, r)}</small></a>`).join('')}</div>`;

  let body;
  if (brRound === 'all' || !rounds[brRound]) {
    // Albero: le colonne hanno la stessa altezza e ogni assalto occupa una fetta uguale, così i turni si allineano.
    body = `<div class="tree">${rounds.map((rd, r) => `<div class="col c${r === 0 ? 0 : 1}"><h3>${roundName(size, r)}</h3><div class="slots">${rd.map((m, i) =>
      `<div class="slot ${r < last ? 'out ' + (i % 2 ? 'bot' : 'top') : ''}">${r > 0 ? '<i class="in"></i>' : ''}${card(r, i, m, false)}</div>`).join('')}</div></div>`).join('')}</div>`;
  } else {
    const r = +brRound;
    body = `<div class="rdlist">${rounds[r].map((m, i) => `<div class="cell"><div class="mute" style="margin:0 4px 4px">Assalto ${i + 1}</div>${card(r, i, m, true)}</div>`).join('')}</div>`;
  }
  return (champ ? `<p class="podium">🏆 ${n0(champ)}</p>` : '') + sel + body +
    (c.canEdit ? `<div class="card row2" style="margin-top:14px"><button class="danger" id="resetDE">Rigenera tabellone</button></div>` : '');
}

function refereesTab(c) {
  const used = id => (c.pools || []).filter(p => p.refereeId === id).length + (c.de?.rounds || []).flat().filter(m => m.refereeId === id).length;
  return `<div class="card"><label>Arbitri della gara</label><table>${(c.referees || []).map(r => `<tr><td class="l">${esc(r.name)}<div class="mute">${used(r.id)} assegnazioni</div></td><td><span class="code">${r.code}</span></td><td><button class="small danger" data-rmref="${r.id}">✕</button></td></tr>`).join('') || '<tr><td class="mute">Nessun arbitro.</td></tr>'}</table></div>
    <div class="card"><form id="addRef" class="row2"><input name="name" placeholder="Nome arbitro" style="flex:1;min-width:180px" required><button class="primary">Aggiungi</button></form></div>
    <div class="card row2"><button id="autoRef">Assegna automaticamente</button><span class="mute">Distribuisce gli arbitri su gironi e assalti.</span></div>
    <p class="mute">Ogni arbitro apre <b>${esc(location.origin)}/#/arbitro</b> dal proprio dispositivo e inserisce il codice a 6 cifre: potrà registrare solo i risultati dei suoi gironi e assalti, visibili subito a tutti.</p>`;
}

function finalTab(c, n) {
  const club = Object.fromEntries(c.athletes.map(a => [a.id, a.club]));
  return `<div class="card"><table><tr><th>Pos</th><th class="l">Atleta</th><th class="l">Società</th></tr>` +
    c.final.map(f => `<tr><td>${f.pos}${f.tie ? ' <span class="mute">ex aequo</span>' : ''}</td><td class="l">${n(f.id)}</td><td class="l">${esc(club[f.id])}</td></tr>`).join('') +
    `</table></div><div class="row2 noprint"><button id="csv">Esporta CSV</button><button id="print">Stampa</button></div>`;
}
function exportCSV(c) {
  const by = Object.fromEntries(c.athletes.map(a => [a.id, a]));
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [['Pos', 'Atleta', 'Società'], ...c.final.map(f => [f.pos, by[f.id].name, by[f.id].club])];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(q).join(';')).join('\n')], { type: 'text/csv' }));
  a.download = c.name.replace(/\W+/g, '_') + '_classifica.csv'; a.click();
}

/* ---------- Finestra risultato assalto di girone ---------- */
function openBout(c, pi, A, B) {
  const p = c.pools[pi - 1], i = p.bouts.findIndex(x => (x.a === A && x.b === B) || (x.a === B && x.b === A)), b = p.bouts[i];
  const nm = id => c.athletes.find(a => a.id === id)?.name || '';
  const d = document.createElement('dialog');
  d.innerHTML = `<h3>Girone ${pi} · assalto</h3>
    <div class="sc"><span>${esc(nm(b.a))}</span><input id="sa" inputmode="numeric" maxlength="1" value="${b.sa ?? ''}"></div>
    <div class="sc"><span>${esc(nm(b.b))}</span><input id="sb" inputmode="numeric" maxlength="1" value="${b.sb ?? ''}"></div>
    <p class="hint">Stoccate da 0 a 5. Se il vincitore arriva a 5 in griglia compare solo «V»; se vince con meno, «V» e il numero.</p>
    <div class="row2"><button id="no">Annulla</button>${b.sa != null ? '<button class="danger" id="clr">Azzera</button>' : ''}<button class="primary" id="ok">Salva</button></div>`;
  document.body.appendChild(d); d.showModal(); d.querySelector('#sa').select();
  d.onclose = () => d.remove();
  const send = act(async body => { await api('PUT', `/competitions/${c.id}/pools/${pi}/bouts/${i}`, body); d.close(); render(); });
  d.querySelector('#no').onclick = () => d.close();
  d.querySelector('#ok').onclick = () => send({ sa: d.querySelector('#sa').value, sb: d.querySelector('#sb').value });
  const clr = d.querySelector('#clr'); if (clr) clr.onclick = () => send({ sa: null });
  d.onkeydown = e => { if (e.key === 'Enter') d.querySelector('#ok').click(); };
}

function bind(c) {
  const on = (s, fn) => { const el = $(s); if (el) el.onclick = act(fn); };
  const all = (s, fn) => document.querySelectorAll(s).forEach(fn);
  on('#addAth', async () => { await api('POST', `/competitions/${c.id}/athletes`, { text: $('#ath').value }); render(); });
  on('#genPools', async () => { await api('POST', `/competitions/${c.id}/pools`, { poolCount: $('#pc').value }); location.hash = `#/c/${c.id}/gironi`; });
  on('#resetPools', async () => { if (confirm('Rigenerare i gironi? I risultati andranno persi.')) { await api('POST', `/competitions/${c.id}/pools`, {}); render(); } });
  on('#genDE', async () => { await api('POST', `/competitions/${c.id}/de`); location.hash = `#/c/${c.id}/tabellone`; });
  on('#resetDE', async () => { if (confirm('Rigenerare il tabellone?')) { await api('POST', `/competitions/${c.id}/de`); render(); } });
  on('#delComp', async () => { if (confirm('Eliminare la gara?')) { await api('DELETE', `/competitions/${c.id}`); location.hash = '#/'; } });
  on('#csv', async () => exportCSV(c));
  on('#print', async () => print());
  on('#autoRef', async () => { await api('POST', `/competitions/${c.id}/referees/auto`); render(); });
  const ar = $('#addRef'); if (ar) ar.onsubmit = act(async e => { e.preventDefault(); await api('POST', `/competitions/${c.id}/referees`, { name: new FormData(ar).get('name') }); render(); });
  all('[data-rmref]', b => b.onclick = act(async () => { if (confirm('Rimuovere l\'arbitro?')) { await api('DELETE', `/competitions/${c.id}/referees/${b.dataset.rmref}`); render(); } }));
  all('[data-rm]', b => b.onclick = act(async () => { await api('DELETE', `/competitions/${c.id}/athletes/${b.dataset.rm}`); render(); }));
  all('[data-ab]', b => b.onclick = act(async () => { await api('POST', `/competitions/${c.id}/athletes/${b.dataset.ab}/absent`); render(); }));
  all('[data-ff]', b => b.onclick = act(async () => {
    if (!confirm('Assegnare la vittoria a tavolino a questo atleta?')) return;
    await api('PUT', `/competitions/${c.id}/de/${b.dataset.ff}`, { forfeit: b.dataset.side }); render();
  }));
  all('select[data-refpool]', s => s.onchange = act(async () => { await api('PUT', `/competitions/${c.id}/pools/${s.dataset.refpool}/referee`, { refereeId: s.value }); render(); }));
  all('select[data-refde]', s => s.onchange = act(async () => { await api('PUT', `/competitions/${c.id}/de/${s.dataset.refde}/referee`, { refereeId: s.value }); render(); }));
  const rf = $('#rkfile');
  if (rf) rf.onchange = act(async () => {
    const f = rf.files[0]; if (!f) return;
    const u8 = new Uint8Array(await f.arrayBuffer()); let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    await api('POST', `/competitions/${c.id}/ranking`, { file: btoa(bin), filename: f.name }); render();
  });
  all('[data-rd]', a => a.onclick = e => { e.preventDefault(); brRound = a.dataset.rd; render(); });
  all('td.e', td => td.onclick = () => openBout(c, +td.dataset.p, td.dataset.a, td.dataset.b));
  // Tabellone: il punteggio parte quando entrambi i campi sono compilati.
  all('input[data-live]', inp => inp.onchange = act(async () => {
    const [a, b] = [...inp.closest('.match').querySelectorAll('input')].map(x => x.value);
    if (a === '' || b === '') return;
    await api('PUT', `/competitions/${c.id}/de/${inp.dataset.de}`, { sa: a, sb: b }); render();
  }));
}

async function render(poll) {
  clearTimeout(timer);
  const [, sect, id, t] = location.hash.split('/');
  try {
    if (sect === 'login') authView('login');
    else if (sect === 'register') authView('register');
    else if (sect === 'arbitro') refereeLogin();
    else if (sect === 'new') newView();
    else if (sect === 'c') { await compView(id, t, poll === true); timer = setTimeout(() => render(true), 4000); return; }
    else { await home(sect === 'z' ? id : null); timer = setTimeout(() => render(true), 4000); }
  } catch (e) { $('#app').innerHTML = `<p class="msg">${esc(e.message)}</p>`; }
}
addEventListener('hashchange', () => render());
api('GET', '/me').then(u => { me = u; nav(); render(); });
