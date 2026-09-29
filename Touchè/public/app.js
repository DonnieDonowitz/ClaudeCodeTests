'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { iscrizioni: 'Iscrizioni', gironi: 'Gironi', tabellone: 'Tabellone', concluso: 'Concluso' };
let me = null, timer = null;

async function api(method, url, body) {
  const r = await fetch('/api' + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Errore');
  return d;
}
const toast = m => alert(m);
const act = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };

function nav() {
  $('#nav').innerHTML = me
    ? `<span class="mute">${esc(me.name)}</span><a href="#/new">Nuova gara</a><a href="#" id="out">Esci</a>`
    : `<a href="#/login">Area direttori</a>`;
  const o = $('#out'); if (o) o.onclick = async e => { e.preventDefault(); await api('POST', '/logout'); me = null; nav(); location.hash = '#/'; };
}

async function home() {
  const list = await api('GET', '/competitions');
  $('#app').innerHTML = `<h1>Competizioni</h1><p class="mute">Gironi, classifiche e tabelloni in diretta.</p><div class="list">` +
    (list.map(c => `<a class="item" href="#/c/${c.id}"><div><b>${esc(c.name)}</b><div class="mute">${esc(c.weapon)} · ${esc(c.category)} · ${esc(c.place)} · ${esc(c.date)}</div></div>
      <div><span class="badge ${c.status}">${STATUS[c.status]}</span> <span class="mute">${c.athletes} atleti</span></div></a>`).join('') || '<p class="mute">Nessuna gara ancora.</p>') + '</div>';
}

function authView(mode) {
  const reg = mode === 'register';
  $('#app').innerHTML = `<div class="card" style="max-width:420px;margin:30px auto"><h1>${reg ? 'Registrati' : 'Accedi'}</h1>
  <form id="f" style="display:grid;gap:10px">${reg ? '<input name="name" placeholder="Nome e cognome" required>' : ''}
  <input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Password" required>
  ${reg ? '<input name="invite" placeholder="Codice invito" required>' : ''}
  <button class="primary">${reg ? 'Crea account' : 'Entra'}</button></form>
  <p class="mute"><a href="#/${reg ? 'login' : 'register'}">${reg ? 'Hai già un account? Accedi' : 'Sei un direttore di gara? Registrati'}</a></p></div>`;
  $('#f').onsubmit = act(async e => {
    e.preventDefault();
    me = await api('POST', reg ? '/register' : '/login', Object.fromEntries(new FormData(e.target)));
    nav(); location.hash = '#/';
  });
}

function newView() {
  if (!me) return location.hash = '#/login';
  $('#app').innerHTML = `<h1>Nuova gara</h1><div class="card"><form id="f" class="grid">
  <div><label>Nome</label><input name="name" required></div><div><label>Data</label><input type="date" name="date"></div>
  <div><label>Luogo</label><input name="place"></div><div><label>Categoria</label><input name="category" placeholder="es. Assoluti"></div>
  <div><label>Arma</label><select name="weapon"><option>spada</option><option>fioretto</option><option>sciabola</option></select></div>
  <div style="align-self:end"><button class="primary">Crea</button></div></form></div>`;
  $('#f').onsubmit = act(async e => { e.preventDefault(); const r = await api('POST', '/competitions', Object.fromEntries(new FormData(e.target))); location.hash = '#/c/' + r.id; });
}

let tab = 'atleti';
async function compView(id, t) {
  const c = await api('GET', '/competitions/' + id);
  tab = t || tab;
  const avail = ['atleti', ...(c.pools ? ['gironi', 'classifica'] : []), ...(c.de ? ['tabellone'] : []), ...(c.final?.length ? ['finale'] : [])];
  if (!avail.includes(tab)) tab = avail.at(-1);
  const name = Object.fromEntries(c.athletes.map(a => [a.id, a]));
  const n = id => name[id] ? esc(name[id].name) : '<span class="mute">—</span>';
  // Conserva campo attivo e testo digitato attraverso il ridisegno (salvataggi e aggiornamento automatico).
  const ae = document.activeElement, keep = ae?.dataset?.live !== undefined && $('#app').contains(ae)
    ? { sel: ['p', 'i', 's', 'de'].map(k => ae.dataset[k] === undefined ? '' : `[data-${k}="${ae.dataset[k]}"]`).join(''), v: ae.value } : null;
  const body = { atleti: () => athletesTab(c), gironi: () => poolsTab(c, n), classifica: () => rankTab(c, n), tabellone: () => bracketTab(c, n), finale: () => finalTab(c, n) }[tab]();
  $('#app').innerHTML = `<div class="row2" style="justify-content:space-between"><div><h1>${esc(c.name)}</h1>
    <div class="mute">${esc(c.weapon)} · ${esc(c.category)} · ${esc(c.place)} · ${esc(c.date)} · direttore: ${esc(c.owner)}</div></div>
    <span class="badge ${c.status}">${STATUS[c.status]}</span></div>
    <div class="tabs">${avail.map(x => `<a href="#/c/${id}/${x}" class="${x === tab ? 'on' : ''}">${x[0].toUpperCase() + x.slice(1)}</a>`).join('')}</div>${body}`;
  bind(c);
  if (keep) { const el = document.querySelector('input[data-live]' + keep.sel); if (el) { el.value = keep.v; el.focus(); } }
}

function athletesTab(c) {
  const e = c.canEdit && !c.pools;
  return `<div class="card"><table><tr><th>#</th><th class="l">Atleta</th><th class="l">Società</th>${e ? '<th></th>' : ''}</tr>` +
    c.athletes.map((a, i) => `<tr style="${a.absent ? 'opacity:.45;text-decoration:line-through' : ''}"><td>${i + 1}</td><td class="l">${esc(a.name)}</td><td class="l">${esc(a.club)}</td>${e ? `<td><button class="small" data-mv="${a.id}" data-d="-1">↑</button> <button class="small" data-mv="${a.id}" data-d="1">↓</button> <button class="small" data-ab="${a.id}" title="Segna assente/presente">${a.absent ? 'presente' : 'assente'}</button> <button class="small danger" data-rm="${a.id}">✕</button></td>` : ''}</tr>`).join('') +
    `</table>${c.athletes.length ? '' : '<p class="mute">Nessun iscritto.</p>'}</div>` +
    (e ? `<div class="card"><label>Aggiungi atleti — una riga ciascuno: <i>Cognome Nome, Società</i>. L'ordine è il ranking (primo = testa di serie 1).</label>
      <textarea id="ath" rows="5"></textarea><div class="row2" style="margin-top:8px"><button id="addAth">Aggiungi</button></div></div>
      <div class="card row2"><label style="margin:0">Numero gironi</label><input id="pc" type="number" min="1" placeholder="auto" style="width:90px">
      <button class="primary" id="genPools">Genera gironi</button></div>` : '') +
    (c.canEdit ? `<button class="danger small" id="delComp">Elimina gara</button>` : '');
}

function poolsTab(c, n) {
  const st = Object.fromEntries(c.ranking.map(r => [r.id, r]));
  const e = c.canEdit && !c.de;
  const pools = c.pools.map(p => `<div class="card"><b>Girone ${p.index}</b>
    <table style="margin:8px 0"><tr><th>#</th><th class="l">Atleta</th><th>V/M</th><th>Ind</th></tr>${p.athletes.map((a, i) => `<tr><td>${i + 1}</td><td class="l">${n(a)}</td><td>${st[a].v}/${st[a].m}</td><td>${st[a].ind > 0 ? '+' : ''}${st[a].ind}</td></tr>`).join('')}</table>
    ${p.bouts.map((b, i) => { const d = b.sa != null, wa = d && b.sa > b.sb, wb = d && b.sb > b.sa;
      return `<div class="bout ${d ? 'done' : ''}"><span class="n r ${wa ? 'w' : ''}">${n(b.a)}</span>
      ${e ? `<input data-live data-p="${p.index}" data-i="${i}" data-s="a" value="${b.sa ?? ''}" inputmode="numeric"> - <input data-live data-p="${p.index}" data-i="${i}" data-s="b" value="${b.sb ?? ''}" inputmode="numeric">` : `<b>${d ? b.sa + ' - ' + b.sb : 'vs'}</b>`}
      <span class="n ${wb ? 'w' : ''}">${n(b.b)}</span></div>`; }).join('')}</div>`).join('');
  return `<div class="pools">${pools}</div>` + (c.canEdit ? `<div class="card row2">
    ${!c.de ? `<button class="primary" id="genDE">Genera tabellone</button><button class="danger" id="resetPools">Rigenera gironi</button>` : '<span class="mute">Tabellone generato: gironi bloccati.</span>'}</div>` : '');
}

function rankTab(c, n) {
  return `<div class="card"><table><tr><th>Pos</th><th class="l">Atleta</th><th>V</th><th>M</th><th>V/M</th><th>TS</th><th>TR</th><th>Ind</th></tr>` +
    c.ranking.map(r => `<tr><td>${r.rank}${r.tie ? '*' : ''}</td><td class="l">${n(r.id)}</td><td>${r.v}</td><td>${r.m}</td><td>${r.ratio.toFixed(2)}</td><td>${r.ts}</td><td>${r.tr}</td><td>${r.ind > 0 ? '+' : ''}${r.ind}</td></tr>`).join('') + '</table>' + (c.ranking.some(r => r.tie) ? '<p class="mute">* Ex aequo su V/M, indice e TS: posizione decisa per sorteggio.</p>' : '') + '</div>';
}

function roundName(size, r) {
  const left = size / 2 ** r;
  return left === 2 ? 'Finale' : left === 4 ? 'Semifinali' : left === 8 ? 'Quarti' : `Tabellone dei ${left}`;
}
function bracketTab(c, n) {
  const e = c.canEdit, { size, rounds } = c.de;
  const champ = rounds.at(-1)[0].winner;
  return (champ ? `<p class="podium">🏆 Vincitore: ${n(champ)}</p>` : '') + `<div class="bracket">` + rounds.map((rd, r) =>
    `<div class="round"><h3>${roundName(size, r)}</h3>${rd.map((m, i) => {
      if (r === 0 && (!m.a || !m.b)) return `<div class="match"><div class="row ${m.a ? 'w' : ''}"><span>${n(m.a || m.b)}</span></div><div class="row mute">Bye</div></div>`;
      const ed = e && m.a && m.b;
      const row = (id, s, w) => `<div class="row ${m.winner && m.winner === id ? 'w' : ''}"><span>${n(id)}</span><span>${m.forfeit ? (m.winner === id ? '<b title="Vittoria a tavolino">V*</b>' : '') : ed ? `<input data-live data-de="${r}/${i}" data-s="${s}" value="${w ?? ''}" inputmode="numeric"> <button class="small" data-ff="${r}/${i}" data-side="${s}" title="Vittoria a tavolino">F</button>` : `<b>${w ?? ''}</b>`}</span></div>`;
      return `<div class="match">${row(m.a, 'a', m.sa)}${row(m.b, 'b', m.sb)}</div>`;
    }).join('')}</div>`).join('') + '</div>' + (e ? `<div class="card row2" style="margin-top:14px"><button class="danger" id="resetDE">Rigenera tabellone</button></div>` : '');
}

function bind(c) {
  const on = (s, fn) => { const el = $(s); if (el) el.onclick = act(fn); };
  on('#addAth', async () => { await api('POST', `/competitions/${c.id}/athletes`, { text: $('#ath').value }); render(); });
  on('#genPools', async () => { await api('POST', `/competitions/${c.id}/pools`, { poolCount: $('#pc').value }); location.hash = `#/c/${c.id}/gironi`; });
  on('#resetPools', async () => { if (confirm('Rigenerare i gironi? I risultati andranno persi.')) { await api('POST', `/competitions/${c.id}/pools`, {}); render(); } });
  on('#genDE', async () => { await api('POST', `/competitions/${c.id}/de`); location.hash = `#/c/${c.id}/tabellone`; });
  on('#resetDE', async () => { if (confirm('Rigenerare il tabellone?')) { await api('POST', `/competitions/${c.id}/de`); render(); } });
  on('#delComp', async () => { if (confirm('Eliminare la gara?')) { await api('DELETE', `/competitions/${c.id}`); location.hash = '#/'; } });
  document.querySelectorAll('[data-rm]').forEach(b => b.onclick = act(async () => { await api('DELETE', `/competitions/${c.id}/athletes/${b.dataset.rm}`); render(); }));
  document.querySelectorAll('[data-ab]').forEach(b => b.onclick = act(async () => { await api('POST', `/competitions/${c.id}/athletes/${b.dataset.ab}/absent`); render(); }));
  document.querySelectorAll('[data-ff]').forEach(b => b.onclick = act(async () => {
    if (!confirm('Assegnare la vittoria a tavolino a questo atleta?')) return;
    await api('PUT', `/competitions/${c.id}/de/${b.dataset.ff}`, { forfeit: b.dataset.side }); render();
  }));
  on('#csv', async () => exportCSV(c));
  on('#print', async () => print());
  document.querySelectorAll('[data-mv]').forEach(b => b.onclick = act(async () => { await api('POST', `/competitions/${c.id}/athletes/${b.dataset.mv}/move`, { dir: +b.dataset.d }); render(); }));
  // Un punteggio viene inviato quando entrambi i campi dell'assalto sono compilati.
  document.querySelectorAll('input[data-live]').forEach(inp => inp.onchange = act(async () => {
    const box = inp.closest('.bout, .match'), ins = [...box.querySelectorAll('input')];
    const [a, b] = ins.map(x => x.value);
    const url = inp.dataset.de ? `/competitions/${c.id}/de/${inp.dataset.de}` : `/competitions/${c.id}/pools/${inp.dataset.p}/bouts/${inp.dataset.i}`;
    if (a === '' && b === '' && !inp.dataset.de) await api('PUT', url, { sa: null });
    else if (a === '' || b === '') return;
    else await api('PUT', url, { sa: a, sb: b });
    render();
  }));
}

async function render() {
  clearTimeout(timer);
  const [, sect, id, t] = location.hash.split('/');
  try {
    if (sect === 'login') authView('login');
    else if (sect === 'register') authView('register');
    else if (sect === 'new') newView();
    else if (sect === 'c') { await compView(id, t); timer = setTimeout(render, 5000); return; }
    else { await home(); timer = setTimeout(render, 10000); }
  } catch (e) { $('#app').innerHTML = `<p class="msg">${esc(e.message)}</p>`; }
}
addEventListener('hashchange', render);
api('GET', '/me').then(u => { me = u; nav(); render(); });

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
  a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(q).join(';')).join('\n')], { type: 'text/csv' }));
  a.download = c.name.replace(/\W+/g, '_') + '_classifica.csv'; a.click();
}
