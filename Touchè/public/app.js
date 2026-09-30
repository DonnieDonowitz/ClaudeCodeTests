'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { iscrizioni: 'Iscrizioni', gironi: 'Gironi', tabellone: 'Tabellone', concluso: 'Concluso' };
const REGIONS = { 'abruzzo': 'Abruzzo', 'basilicata': 'Basilicata', 'calabria': 'Calabria', 'campania': 'Campania', 'emilia-romagna': 'Emilia-Romagna', 'friuli-venezia-giulia': 'Friuli-Venezia Giulia', 'lazio': 'Lazio', 'liguria': 'Liguria', 'lombardia': 'Lombardia', 'marche': 'Marche', 'molise': 'Molise', 'piemonte': 'Piemonte', 'puglia': 'Puglia', 'sardegna': 'Sardegna', 'sicilia': 'Sicilia', 'toscana': 'Toscana', 'trentino-alto-adige': 'Trentino-Alto Adige', 'umbria': 'Umbria', 'valle-d-aosta': 'Valle d\'Aosta', 'veneto': 'Veneto' };
const CATEGORIES = ['Giovani', 'Assoluti', 'Under-23', 'Cadetti', 'Juniores', 'Under-14', 'Master'];
const ZONE = { nazionale: 'Nazionali', master: 'Master', ...REGIONS };
const ABBR = { nazionale: 'FIS', master: 'AMIS', 'emilia-romagna': 'EMR', 'friuli-venezia-giulia': 'FVG', 'trentino-alto-adige': 'TAA', 'valle-d-aosta': 'VDA' };
let me = null, timer = null, tab = 'atleti', HL = '', LOGOS = {};
const wkey0 = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const wkey = s => wkey0(s).split(' ').filter(Boolean).sort().join(' ');
// Evidenzia il nome dello schermidore cercato (confronto indipendente dall'ordine cognome/nome).
const hl = name => HL && wkey(name) === HL ? `<mark class="hl">${esc(name)}</mark>` : esc(name);
// Logo della zona (file in public/logos/) oppure sigla al suo posto.
const logo = (z, sm) => LOGOS[z] ? `<img class="zl ${sm ? 'sm' : ''}" src="${LOGOS[z]}" alt="">` : `<span class="zl mono ${sm ? 'sm' : ''}">${esc(ABBR[z] || z.slice(0, 3).toUpperCase())}</span>`;

async function api(method, url, body) {
  const r = await fetch('/api' + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Errore');
  return d;
}
const act = fn => async (...a) => { try { await fn(...a); } catch (e) { alert(e.message); } };
const ago = t => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'ora' : s < 3600 ? Math.round(s / 60) + ' min fa' : s < 86400 ? Math.round(s / 3600) + ' h fa' : new Date(t).toLocaleDateString('it-IT'); };

const ROLE = { admin: 'Amministratore', regional: 'Admin regionale', director: 'Direttore di gara', referee: 'Arbitro' };
function nav() {
  const l = (h, t) => `<a href="#/${h}">${t}</a>`;
  $('#nav').innerHTML = !me ? l('login', 'Accedi')
    : `${me.role === 'admin' ? l('admin', 'Account') : me.role === 'regional' ? l('admin', 'Account') : ''}${l('gestione', me.role === 'referee' ? 'Le mie gare' : me.role === 'director' ? 'Le mie gare' : 'Gestione')}
    <a class="mute" href="#/account" title="${esc(ROLE[me.role])}${me.zone ? ' · ' + esc(ZONE[me.zone]) : ''}">${esc(me.name)}</a><a href="#" id="out">Esci</a>`;
  const o = $('#out'); if (o) o.onclick = async e => { e.preventDefault(); await api('POST', '/logout'); me = null; nav(); location.hash = '#/'; };
}

/* ---------- Home / dashboard ---------- */
async function home(zone) {
  const [list, live] = await Promise.all([api('GET', '/competitions'), api('GET', '/live')]);
  const count = {}, active = {};
  list.forEach(c => { count[c.zone] = (count[c.zone] || 0) + 1; if (c.status === 'gironi' || c.status === 'tabellone') active[c.zone] = true; });
  const tile = (z, big) => `<a class="zone ${big ? 'big' : ''} ${zone === z ? 'on' : ''} ${count[z] ? '' : 'zero'}" href="#/${zone === z ? '' : 'z/' + z}">${logo(z)}<b>${active[z] ? '<i class="dot"></i>' : ''}${esc(ZONE[z])}</b><span>${count[z] || 0} ${count[z] === 1 ? "gara" : "gare"}</span></a>`;
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
      return `<a class="item" href="#/c/${c.id}"><div><b>${esc(c.name)}</b><div class="mute">${logo(c.zone, 1)}${esc(ZONE[c.zone])} · ${esc(c.weapon)} · ${esc(c.category)} · ${esc(c.place)} · ${esc(c.date)}</div></div>
      <div><span class="badge ${c.status}">${live ? '<i class="dot"></i>' : ''}${STATUS[c.status]}</span>${live && pr.total ? `<div class="bar"><i style="width:${Math.round(100 * pr.done / pr.total)}%"></i></div>` : `<span class="mute">${c.athletes} atleti</span>`}</div></a>`; }).join('') || '<p class="mute" style="padding:16px;margin:0">Nessuna gara in questa zona.</p>'}</div>`;
}

/* ---------- Accesso unico per admin, admin regionali, direttori di gara e arbitri ---------- */
function loginView() {
  $('#app').innerHTML = `<div class="card" style="max-width:420px;margin:30px auto"><h1>Accedi</h1>
  <p class="mute">Direttori di gara, arbitri e amministratori accedono da qui con l'account creato per loro. Gli account si richiedono all'amministratore o al proprio comitato regionale.</p>
  <form id="f" style="display:grid;gap:10px"><input name="email" type="email" placeholder="Email" autocomplete="username" required>
  <input name="password" type="password" placeholder="Password" autocomplete="current-password" required><button class="primary">Entra</button></form></div>`;
  $('#f').onsubmit = act(async e => { e.preventDefault(); me = await api('POST', '/login', Object.fromEntries(new FormData(e.target))); nav(); location.hash = me.role === 'referee' ? '#/gestione' : '#/'; });
}
function accountView() {
  if (!me) return location.hash = '#/login';
  $('#app').innerHTML = `<h1>${esc(me.name)}</h1><p class="mute">${esc(ROLE[me.role])}${me.zone ? ' · ' + esc(ZONE[me.zone]) : ''} · ${esc(me.email)}</p>
  <div class="card" style="max-width:420px"><label>Cambia password</label><form id="f" style="display:grid;gap:10px"><input name="current" type="password" placeholder="Password attuale" autocomplete="current-password" required>
  <input name="password" type="password" placeholder="Nuova password (min. 8 caratteri)" autocomplete="new-password" minlength="8" required><button class="primary">Salva</button></form></div>`;
  $('#f').onsubmit = act(async e => { e.preventDefault(); await api('POST', '/me/password', Object.fromEntries(new FormData(e.target))); e.target.reset(); alert('Password aggiornata'); });
}

/* ---------- Pannello account (admin: tutti · admin regionale: direttori e arbitri della sua zona) ---------- */
let userFilter = '';
async function adminView() {
  if (!me || !['admin', 'regional'].includes(me.role)) return location.hash = '#/login';
  const users = await api('GET', '/users'), adm = me.role === 'admin';
  const roles = adm ? ['director', 'referee', 'regional', 'admin'] : ['director', 'referee'];
  const zoneSel = (name, cur, blank) => `<select name="${name}" ${adm ? '' : 'disabled'}><option value="">${blank}</option>${Object.entries(ZONE).map(([k, v]) => `<option value="${k}" ${k === (adm ? cur : me.zone) ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
  const shown = users.filter(u => !userFilter || u.role === userFilter);
  $('#app').innerHTML = `<h1>Account</h1><p class="mute">${adm ? 'Crea e gestisci gli account di amministratori regionali, direttori di gara e arbitri.' : `Crea e gestisci direttori di gara e arbitri di ${esc(ZONE[me.zone])}.`}</p>
  <div class="card"><label>Nuovo account</label><form id="nu" class="grid">
    <div><label>Nome e cognome</label><input name="name" required></div><div><label>Email</label><input name="email" type="email" required></div>
    <div><label>Password iniziale</label><input name="password" minlength="8" placeholder="min. 8 caratteri" required></div>
    <div><label>Ruolo</label><select name="role">${roles.map(r => `<option value="${r}">${ROLE[r]}</option>`).join('')}</select></div>
    <div><label>Zona</label>${zoneSel('zone', '', adm ? 'Nessuna (tutte)' : '')}</div><div style="align-self:end"><button class="primary">Crea account</button></div></form>
    <p class="hint">${adm ? 'L\'admin regionale richiede una zona. Direttori e arbitri possono avere una zona (facoltativa).' : ''} La persona potrà cambiare la password da «il mio nome» in alto.</p></div>
  <div class="tabs"><a href="#" data-uf="" class="${userFilter === '' ? 'on' : ''}">Tutti (${users.length})</a>${roles.map(r => `<a href="#" data-uf="${r}" class="${userFilter === r ? 'on' : ''}">${ROLE[r]} (${users.filter(u => u.role === r).length})</a>`).join('')}</div>
  <div class="card" style="overflow-x:auto"><table><tr><th class="l">Nome</th><th class="l">Email</th><th class="l">Ruolo</th><th class="l">Zona</th><th></th></tr>${shown.map(u => `<tr style="${u.active ? '' : 'opacity:.5'}">
    <td class="l">${esc(u.name)}</td><td class="l">${esc(u.email)}</td><td class="l">${ROLE[u.role]}</td>
    <td class="l">${adm ? `<select class="mini" data-uzone="${u.id}"><option value="">—</option>${Object.entries(ZONE).map(([k, v]) => `<option value="${k}" ${k === u.zone ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>` : esc(ZONE[u.zone] || '—')}</td>
    <td style="white-space:nowrap">${u.id === me.id ? '<span class="mute">tu</span>' : `<button class="small" data-uact="${u.id}" data-on="${u.active ? 1 : 0}">${u.active ? 'Disattiva' : 'Attiva'}</button> <button class="small" data-upw="${u.id}">Password</button> <button class="small danger" data-udel="${u.id}" data-n="${esc(u.name)}">✕</button>`}</td></tr>`).join('') || '<tr><td class="mute">Nessun account.</td></tr>'}</table></div>`;
  $('#nu').onsubmit = act(async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (!adm) d.zone = me.zone; await api('POST', '/users', d); adminView(); });
  document.querySelectorAll('[data-uf]').forEach(a => a.onclick = e => { e.preventDefault(); userFilter = a.dataset.uf; adminView(); });
  document.querySelectorAll('[data-uact]').forEach(b => b.onclick = act(async () => { await api('PATCH', '/users/' + b.dataset.uact, { active: b.dataset.on !== '1' }); adminView(); }));
  document.querySelectorAll('[data-uzone]').forEach(s => s.onchange = act(async () => { await api('PATCH', '/users/' + s.dataset.uzone, { zone: s.value }); adminView(); }));
  document.querySelectorAll('[data-upw]').forEach(b => b.onclick = act(async () => { const p = prompt('Nuova password (min. 8 caratteri):'); if (p) { await api('POST', `/users/${b.dataset.upw}/password`, { password: p }); alert('Password aggiornata: le sessioni di quell\'utente sono state chiuse.'); } }));
  document.querySelectorAll('[data-udel]').forEach(b => b.onclick = act(async () => { if (confirm(`Eliminare l'account di ${b.dataset.n}?`)) { await api('DELETE', '/users/' + b.dataset.udel); adminView(); } }));
}

/* ---------- Pannello gare: admin (tutte), admin regionale (la sua zona), direttore/arbitro (le proprie) ---------- */
let gzone = '';
async function manageView() {
  if (!me) return location.hash = '#/login';
  const [list, dirs] = await Promise.all([api('GET', '/manage/competitions' + (me.role === 'admin' && gzone ? '?zone=' + gzone : '')), ['admin', 'regional'].includes(me.role) ? api('GET', '/users').then(u => u.filter(x => x.role === 'director' && x.active)) : []]);
  const mgr = ['admin', 'regional'].includes(me.role), title = me.role === 'regional' ? `Gestione ${esc(ZONE[me.zone])}` : me.role === 'admin' ? 'Gestione gare' : 'Le mie gare';
  $('#app').innerHTML = `<div class="row2" style="justify-content:space-between"><h1>${me.role === 'regional' ? logo(me.zone, 1) : ''}${title}</h1>${me.role === 'referee' ? '' : '<a class="btn primary" href="#/new">+ Nuova gara</a>'}</div>
  ${me.role === 'admin' ? `<p><select id="gz"><option value="">Tutte le zone</option>${Object.entries(ZONE).map(([k, v]) => `<option value="${k}" ${k === gzone ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></p>` : ''}
  ${me.role === 'referee' ? '<p class="mute">Le gare in cui sei stato assegnato: apri la gara e tocca un assalto per inserire il risultato.</p>' : ''}
  <div class="card" style="overflow-x:auto"><table><tr><th class="l">Gara</th>${me.role === 'admin' ? '<th class="l">Zona</th>' : ''}<th class="l">Data</th><th class="l">Stato</th>${me.role !== 'referee' ? '<th class="l">Direttore</th>' : ''}<th></th></tr>${list.map(c => `<tr>
    <td class="l"><a href="#/c/${c.id}/_"><b>${esc(c.name)}</b></a><div class="mute">${esc(c.weapon)} · ${esc(c.category)} ${esc(c.gender)} · ${esc(c.place)} · ${c.athletes} atleti</div></td>
    ${me.role === 'admin' ? `<td class="l">${esc(ZONE[c.zone])}</td>` : ''}<td class="l">${esc(c.date)}</td><td class="l"><span class="badge ${c.status}">${STATUS[c.status]}</span></td>
    ${me.role !== 'referee' ? `<td class="l">${mgr ? `<select class="mini" data-own="${c.id}"><option value="">—</option>${(dirs.some(d => d.id === c.ownerId) || !c.ownerId ? dirs : [...dirs, { id: c.ownerId, name: c.owner }]).map(d => `<option value="${d.id}" ${d.id === c.ownerId ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>` : esc(c.owner || '—')}</td>` : ''}
    <td style="white-space:nowrap">${me.role === 'referee' ? '' : `<button class="small" data-edit='${esc(JSON.stringify(c))}'>Modifica</button> <button class="small danger" data-del="${c.id}" data-n="${esc(c.name)}">✕</button>`}</td></tr>`).join('') || '<tr><td class="mute">Nessuna gara.</td></tr>'}</table></div>`;
  const gz = $('#gz'); if (gz) gz.onchange = () => { gzone = gz.value; manageView(); };
  document.querySelectorAll('[data-own]').forEach(s => s.onchange = act(async () => { await api('PATCH', '/competitions/' + s.dataset.own, { ownerId: s.value }); manageView(); }));
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = act(async () => { if (confirm(`Eliminare «${b.dataset.n}» con tutti i risultati?`)) { await api('DELETE', '/competitions/' + b.dataset.del); manageView(); } }));
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editComp(JSON.parse(b.dataset.edit)));
}
function editComp(c) {
  const d = document.createElement('dialog'), lock = c.status !== 'iscrizioni';
  d.innerHTML = `<h3>Modifica gara</h3><form id="ef" class="grid" style="min-width:min(520px,80vw)">
    <div><label>Nome</label><input name="name" value="${esc(c.name)}" required></div><div><label>Data</label><input type="date" name="date" value="${esc(c.date)}"></div>
    <div><label>Luogo</label><input name="place" value="${esc(c.place)}"></div>
    <div><label>Categoria</label><select name="category" ${lock ? 'disabled' : ''}>${CATEGORIES.map(x => `<option ${x === c.category ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
    <div><label>Arma</label><select name="weapon" ${lock ? 'disabled' : ''}>${['spada', 'fioretto', 'sciabola'].map(x => `<option ${x === c.weapon ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
    <div><label>Sesso</label><select name="gender" ${lock ? 'disabled' : ''}><option value="M" ${c.gender === 'M' ? 'selected' : ''}>Maschile</option><option value="F" ${c.gender === 'F' ? 'selected' : ''}>Femminile</option></select></div>
    ${me.role === 'admin' ? `<div><label>Zona</label><select name="zone">${Object.entries(ZONE).map(([k, v]) => `<option value="${k}" ${k === c.zone ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>` : ''}
    </form>${lock ? '<p class="hint">Arma, categoria e sesso non si cambiano dopo la generazione dei gironi.</p>' : ''}
    <div class="row2"><button id="no">Annulla</button><button class="primary" id="ok">Salva</button></div>`;
  document.body.appendChild(d); d.showModal(); d.onclose = () => d.remove();
  d.querySelector('#no').onclick = () => d.close();
  d.querySelector('#ok').onclick = act(async () => { const f = Object.fromEntries(new FormData(d.querySelector('#ef'))); await api('PATCH', '/competitions/' + c.id, f); d.close(); manageView(); });
}
async function newView() {
  if (!me || me.role === 'referee') return location.hash = '#/login';
  const fixed = me.role === 'regional' || (me.role === 'director' && me.zone), mgr = ['admin', 'regional'].includes(me.role);
  const dirs = mgr ? (await api('GET', '/users')).filter(u => u.role === 'director' && u.active) : [];
  $('#app').innerHTML = `<h1>Nuova gara</h1><div class="card"><form id="f" class="grid">
  <div><label>Nome</label><input name="name" required></div><div><label>Data</label><input type="date" name="date"></div>
  <div><label>Zona</label><select name="zone" ${fixed ? 'disabled' : ''}>${Object.entries(ZONE).map(([k, v]) => `<option value="${k}" ${k === (fixed ? me.zone : 'nazionale') ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
  ${mgr ? `<div><label>Direttore di gara</label><select name="ownerId"><option value="">Da assegnare</option>${dirs.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select></div>` : ''}
  <div><label>Luogo</label><input name="place"></div><div><label>Categoria</label><select name="category">${CATEGORIES.map(x => `<option>${x}</option>`).join('')}</select></div>
  <div><label>Sesso</label><select name="gender"><option value="M">Maschile</option><option value="F">Femminile</option></select></div>
  <div><label>Arma</label><select name="weapon"><option>spada</option><option>fioretto</option><option>sciabola</option></select></div>
  <div style="align-self:end"><button class="primary">Crea</button></div></form></div>`;
  $('#f').onsubmit = act(async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (fixed) d.zone = me.zone; const r = await api('POST', '/competitions', d); location.hash = '#/c/' + r.id; });
}

/* ---------- Gara ---------- */
async function compView(id, t, poll) {
  const c = await api('GET', '/competitions/' + id);
  if (poll && (document.activeElement?.matches('textarea,select,input:not([data-live])') || document.querySelector('dialog[open]'))) return;
  tab = t && t !== '_' ? t : tab;
  const avail = ['atleti', ...(c.pools ? ['gironi', 'classifica'] : []), ...(c.de ? ['tabellone'] : []), ...(c.final?.length ? ['finale'] : []), ...(c.canEdit ? ['arbitri'] : [])];
  if (!avail.includes(tab)) tab = avail.filter(x => x !== 'arbitri').at(-1);
  const name = Object.fromEntries(c.athletes.map(a => [a.id, a]));
  const n = id => name[id] ? hl(name[id].name) : '<span class="mute">—</span>';
  const ae = document.activeElement, keep = ae?.dataset?.live !== undefined && $('#app').contains(ae)
    ? { sel: `[data-de="${ae.dataset.de}"][data-s="${ae.dataset.s}"]`, v: ae.value } : null;
  if (tab === 'arbitri') refPool = await api('GET', '/referees').catch(() => []);
  const body = { atleti: () => athletesTab(c), gironi: () => poolsTab(c, n), classifica: () => rankTab(c, n), tabellone: () => bracketTab(c, n), finale: () => finalTab(c, n), arbitri: () => refereesTab(c) }[tab]();
  const mineP = c.referee ? (c.pools || []).filter(p => p.refereeId === c.referee.id).length : 0;
  const mineM = c.referee ? (c.de?.rounds || []).flat().filter(m => m.refereeId === c.referee.id && !m.winner).length : 0;
  $('#app').innerHTML = `<div class="row2" style="justify-content:space-between"><div><h1>${esc(c.name)}</h1>
    <div class="mute">${logo(c.zone, 1)}${esc(ZONE[c.zone])} · ${esc(c.weapon)} · ${esc(c.category)} ${esc(c.gender || 'M')} · ${esc(c.place)} · ${esc(c.date)} · direttore: ${esc(c.owner)}</div></div>
    <span class="badge ${c.status}">${STATUS[c.status]}</span></div>
    ${c.referee ? `<div class="banner">Ciao <b>${esc(c.referee.name)}</b>: ${mineP} gironi e ${mineM} assalti del tabellone ti aspettano. Tocca una cella della griglia (o un punteggio nel tabellone) per inserire il risultato.</div>` : ''}
    <div class="tabs">${avail.map(x => `<a href="#/c/${id}/${x}${HL ? '/' + encodeURIComponent(HL) : ''}" class="${x === tab ? 'on' : ''}">${x[0].toUpperCase() + x.slice(1)}</a>`).join('')}</div>${body}`;
  bind(c);
  if (keep) { const el = document.querySelector('input[data-live]' + keep.sel); if (el) { el.value = keep.v; el.focus(); } }
}

function athletesTab(c) {
  const e = c.canEdit && !c.pools, ri = c.rankingInfo;
  return `<div class="card"><table><tr><th>#</th><th>Ranking</th><th class="l">Atleta</th><th class="l">Società</th>${e ? '<th></th>' : ''}</tr>` +
    c.athletes.map((a, i) => `<tr style="${a.absent ? 'opacity:.45;text-decoration:line-through' : ''}"><td>${i + 1}</td><td><b class="${a.rank == null ? 'mute' : ''}">${a.rank ?? 9999}</b></td><td class="l"><a class="pl" href="#/a/${encodeURIComponent(wkey(a.name))}">${hl(a.name)}</a></td><td class="l">${a.club ? `<a class="pl" href="#/s/${encodeURIComponent(wkey0(a.club))}">${esc(a.club)}</a>` : ''}</td>${e ? `<td><button class="small" data-ab="${a.id}">${a.absent ? 'presente' : 'assente'}</button> <button class="small danger" data-rm="${a.id}">✕</button></td>` : ''}</tr>`).join('') +
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
    // Stessa struttura dell'albero: solo la colonna del turno scelto, con gli stessi spazi tra gli assalti
    // e le linee delle coppie che escono verso il turno successivo (vuoto).
    const r = +brRound;
    body = `<div class="tree single"><div class="col ${r === 0 ? 'c0' : 'c1'}"><h3>${roundName(size, r)}</h3><div class="slots">${rounds[r].map((m, i) =>
      `<div class="slot ${r < last ? 'out ' + (i % 2 ? 'bot' : 'top') : ''}" ${r > 0 ? `style="flex:none;height:${r < last ? 104 * 2 ** r : 104}px"` : ''}>${r < last && i % 2 === 0 ? '<i class="dangle"></i>' : ''}${card(r, i, m, false)}</div>`).join('')}</div></div></div>`;
  }
  return (champ ? `<p class="podium">🏆 ${n0(champ)}</p>` : '') + sel + body +
    (c.canEdit ? `<div class="card row2" style="margin-top:14px"><button class="danger" id="resetDE">Rigenera tabellone</button></div>` : '');
}

let refPool = [];
function refereesTab(c) {
  const used = id => (c.pools || []).filter(p => p.refereeId === id).length + (c.de?.rounds || []).flat().filter(m => m.refereeId === id).length;
  const free = refPool.filter(r => !(c.referees || []).some(x => x.id === r.id));
  return `<div class="card"><label>Arbitri della gara</label><table>${(c.referees || []).map(r => `<tr><td class="l">${esc(r.name)}<div class="mute">${used(r.id)} assegnazioni</div></td><td><button class="small danger" data-rmref="${r.id}">✕</button></td></tr>`).join('') || '<tr><td class="mute">Nessun arbitro.</td></tr>'}</table></div>
    <div class="card"><form id="addRef" class="row2"><select name="userId" style="flex:1;min-width:180px" required><option value="">Scegli un arbitro…</option>${free.map(r => `<option value="${r.id}">${esc(r.name)}${r.zone ? ' · ' + esc(ZONE[r.zone]) : ''}</option>`).join('')}</select><button class="primary">Aggiungi</button></form>
    ${refPool.length ? '' : '<p class="hint">Non ci sono arbitri registrati: chiedi all\'amministratore o al comitato regionale di creare gli account.</p>'}</div>
    <div class="card row2"><button id="autoRef">Assegna automaticamente</button><span class="mute">Distribuisce gli arbitri su gironi e assalti.</span></div>
    <p class="mute">Gli arbitri accedono con il proprio account e possono registrare solo i risultati dei gironi e degli assalti che hai assegnato loro: sono visibili subito a tutti.</p>`;
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
  const ar = $('#addRef'); if (ar) ar.onsubmit = act(async e => { e.preventDefault(); await api('POST', `/competitions/${c.id}/referees`, { userId: new FormData(ar).get('userId') }); render(); });
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


/* ---------- Ricerca, schermidori, società ---------- */
const WEAPON = w => w[0].toUpperCase() + w.slice(1);
const compRow = c => `<a class="item" href="#/c/${c.id}/_${HLNEXT ? '/' + encodeURIComponent(HLNEXT) : ''}"><div><b>${esc(c.name)}</b><div class="mute">${logo(c.zone, 1)}${esc(ZONE[c.zone])} · ${esc(c.weapon)} · ${esc(c.category)} ${esc(c.gender)} · ${esc(c.place)} · ${esc(c.date)}</div></div>
  <div><span class="badge ${c.status}">${c.live ? '<i class="dot"></i>' : ''}${STATUS[c.status]}</span></div></a>`;
let HLNEXT = '';
const athRow = a => `<a class="item" href="#/a/${encodeURIComponent(a.key)}"><div><b>${esc(a.name)}</b><div class="mute">${esc(a.club || 'Società non indicata')} · ${a.count} ${a.count === 1 ? 'gara' : 'gare'}</div></div>${a.live ? '<div><span class="badge"><i class="dot"></i>In gara</span></div>' : '<div></div>'}</a>`;
const clubRow = c => `<a class="item" href="#/s/${encodeURIComponent(c.key)}"><div><b>${esc(c.name)}</b><div class="mute">${c.count} ${c.count === 1 ? 'schermidore' : 'schermidori'}</div></div><div></div></a>`;

async function searchView(q) {
  q = decodeURIComponent(q || '');
  $('#q').value = q; HLNEXT = '';
  const r = await api('GET', '/search?q=' + encodeURIComponent(q));
  const sec = (t, arr, fn) => arr.length ? `<h2>${t}</h2><div class="list">${arr.map(fn).join('')}</div>` : '';
  const none = !r.competitions.length && !r.athletes.length && !r.clubs.length;
  $('#app').innerHTML = `<h1>Risultati per “${esc(q)}”</h1>` + (q.trim().length < 2 ? '<p class="mute">Scrivi almeno due lettere.</p>' : none ? '<p class="mute">Nessun risultato: prova con un altro nome di gara, schermidore o società.</p>' : '') +
    sec('Competizioni', r.competitions, compRow) + sec('Schermidori', r.athletes, athRow) + sec('Società', r.clubs, clubRow);
}
async function athleteView(key) {
  key = decodeURIComponent(key); HLNEXT = key;
  const a = await api('GET', '/athletes/' + encodeURIComponent(key));
  const live = a.competitions.filter(c => c.live), past = a.competitions.filter(c => !c.live);
  const rk = a.rankings.length ? `<div class="card"><table><tr><th class="l">Arma</th><th class="l">Categoria</th><th>Sesso</th><th>Ranking</th></tr>${a.rankings.map(r =>
    `<tr><td class="l">${esc(WEAPON(r.weapon))}</td><td class="l">${esc(CATEGORIES.find(x => x.toLowerCase() === r.category) || r.category)}</td><td>${r.gender === 'F' ? 'F' : 'M'}</td><td><b>${r.pos}°</b></td></tr>`).join('')}</table>
    <p class="hint">Dai ranking Federscherma caricati (${[...new Set(a.rankings.map(r => r.file).filter(Boolean))].map(esc).join(', ') || 'file manuale'}).</p></div>`
    : '<p class="mute">Nessun ranking disponibile per questo schermidore nei file caricati.</p>';
  $('#app').innerHTML = `<h1>${esc(a.name)}</h1><div class="mute">${a.club ? `Società: <a href="#/s/${encodeURIComponent(wkey0(a.club))}">${esc(a.club)}</a>` : 'Società non indicata'}</div>
    <h2>Ranking</h2>${rk}
    ${live.length ? `<h2><i class="dot"></i>In corso</h2><div class="list">${live.map(compRow).join('')}</div>` : ''}
    <h2>${live.length ? 'Gare precedenti e in programma' : 'Competizioni'}</h2><div class="list">${past.map(compRow).join('') || '<p class="mute" style="padding:16px;margin:0">Nessun’altra gara.</p>'}</div>`;
}
async function clubView(key) {
  key = decodeURIComponent(key); HLNEXT = '';
  const c = await api('GET', '/clubs/' + encodeURIComponent(key));
  $('#app').innerHTML = `<h1>${esc(c.name)}</h1><p class="mute">${c.athletes.length} ${c.athletes.length === 1 ? 'schermidore' : 'schermidori'}</p>
    <div class="list">${c.athletes.map(a => `<a class="item" href="#/a/${encodeURIComponent(a.key)}"><div><b>${esc(a.name)}</b><div class="mute">${a.rankings.map(r => `${esc(WEAPON(r.weapon))} ${esc(CATEGORIES.find(x => x.toLowerCase() === r.category) || r.category)} ${r.gender}: ${r.pos}°`).join(' · ') || `${a.count} ${a.count === 1 ? 'gara' : 'gare'}`}</div></div>${a.live ? '<div><span class="badge"><i class="dot"></i>In gara</span></div>' : '<div></div>'}</a>`).join('')}</div>`;
}

/* Barra di ricerca nell'intestazione: suggerimenti al volo, Invio apre tutti i risultati. */
function initSearch() {
  const q = $('#q'), box = $('#sugg'); let t = 0;
  const close = () => box.classList.remove('open');
  q.oninput = () => {
    clearTimeout(t);
    if (q.value.trim().length < 2) return close();
    t = setTimeout(async () => {
      const r = await api('GET', '/search?q=' + encodeURIComponent(q.value)).catch(() => null); if (!r) return;
      const grp = (title, arr, href, label, sub) => arr.length ? `<div class="sg">${title}</div>` + arr.slice(0, 4).map(x => `<a href="${href(x)}"><b>${esc(label(x))}</b><small>${esc(sub(x))}</small></a>`).join('') : '';
      const html = grp('Competizioni', r.competitions, x => `#/c/${x.id}/_`, x => x.name, x => `${x.weapon} · ${x.category} · ${x.date}`) +
        grp('Schermidori', r.athletes, x => `#/a/${encodeURIComponent(x.key)}`, x => x.name, x => x.club) + grp('Società', r.clubs, x => `#/s/${encodeURIComponent(x.key)}`, x => x.name, x => `${x.count} schermidori`);
      box.innerHTML = html + (html ? `<a class="all" href="#/cerca/${encodeURIComponent(q.value)}">Tutti i risultati</a>` : '<div class="sg">Nessun risultato</div>');
      box.classList.add('open');
    }, 180);
  };
  q.onkeydown = e => { if (e.key === 'Enter' && q.value.trim()) { close(); location.hash = '#/cerca/' + encodeURIComponent(q.value.trim()); } else if (e.key === 'Escape') close(); };
  box.onclick = () => close();
  document.addEventListener('click', e => { if (!e.target.closest('.search')) close(); });
}

async function render(poll) {
  clearTimeout(timer);
  const [, sect, id, t, h] = location.hash.split('/');
  HL = sect === 'c' && h ? decodeURIComponent(h) : '';
  if (sect !== 'cerca') $('#q').value = '';
  try {
    if (sect === 'login' || sect === 'register' || sect === 'arbitro') loginView();
    else if (sect === 'admin') await adminView();
    else if (sect === 'gestione') await manageView();
    else if (sect === 'account') accountView();
    else if (sect === 'cerca') await searchView(id);
    else if (sect === 'a') await athleteView(id);
    else if (sect === 's') await clubView(id);
    else if (sect === 'new') await newView();
    else if (sect === 'c') { await compView(id, t, poll === true); if (HL && poll !== true) document.querySelector('.hl')?.scrollIntoView({ block: 'center' }); timer = setTimeout(() => render(true), 4000); return; }
    else { await home(sect === 'z' ? id : null); timer = setTimeout(() => render(true), 4000); }
  } catch (e) { $('#app').innerHTML = `<p class="msg">${esc(e.message)}</p>`; }
}
addEventListener('hashchange', () => render());
initSearch();
Promise.all([api('GET', '/me'), api('GET', '/logos').catch(() => ({}))]).then(([u, l]) => { me = u; LOGOS = l; nav(); render(); });
