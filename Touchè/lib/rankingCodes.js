'use strict';
// Significato delle colonne dei ranking Federscherma (le sigle nelle intestazioni dei file xlsx).
// group: reg = qualificazioni regionali/di zona, naz = prove nazionali, fin = campionati e fasi finali, int = gare internazionali.
const FIXED = {
  qual1: ['1ª Qualificazione regionale / di zona', 'reg'], qual2: ['2ª Qualificazione regionale / di zona', 'reg'],
  open1: ['1ª Prova Nazionale di Qualificazione (Open)', 'naz'], open2: ['2ª Prova Nazionale di Qualificazione (Open)', 'naz'],
  goldreg: ['Qualificazione regionale Gold', 'reg'], gold: ['Campionato Nazionale Gold', 'fin'], silver: ['Campionato Nazionale Silver', 'fin'],
  assoluti: ['Campionati Italiani Assoluti', 'fin'], assogold: ['Campionato Nazionale Gold Assoluti', 'fin'], asso: ['Campionati Italiani Assoluti', 'fin'], integrata: ['Prova Integrata', 'naz'],
  under23: ['Campionato Italiano Under 23', 'fin'],
  cad1: ['1ª Prova Nazionale Cadetti', 'naz'], cad2: ['2ª Prova Nazionale Cadetti', 'naz'], cad1r: ['1ª Qualificazione regionale Cadetti', 'reg'], cad2r: ['2ª Qualificazione regionale Cadetti', 'reg'],
  cadgr: ['Qualificazione regionale Gold Cadetti', 'reg'], cadsil: ['Campionato Nazionale Silver Cadetti', 'fin'], cadgold: ['Campionato Nazionale Gold Cadetti', 'fin'], cadf: ['Campionati Italiani Cadetti (fase finale)', 'fin'],
  gio1: ['1ª Prova Nazionale Giovani', 'naz'], gio2: ['2ª Prova Nazionale Giovani', 'naz'], gio1r: ['1ª Qualificazione regionale Giovani', 'reg'], gio2r: ['2ª Qualificazione regionale Giovani', 'reg'],
  giocir: ['Circuito Giovani', 'naz'], giogor: ['Qualificazione regionale Gold Giovani', 'reg'], giogold: ['Campionato Nazionale Gold Giovani', 'fin'], giof: ['Campionati Italiani Giovani (fase finale)', 'fin'],
  eur: ['Campionati Europei', 'int'], chm: ['Campionati del Mondo', 'int'], mond: ['Campionati del Mondo', 'int'], cdm: ['Coppa del Mondo', 'int'],
};
const PATTERN = [[/^cdm(?:under20)?(\d)$/, m => [`Coppa del Mondo ${m[1]}`, 'int']], [/^gp(\d)$/, m => [`Grand Prix ${m[1]}`, 'int']], [/^ce(\d)$/, m => [`Circuito Europeo Under 23 n. ${m[1]}`, 'int']],
  [/^ceu(\d)$/, m => [`Circuito Europeo Cadetti n. ${m[1]}`, 'int']], [/^(\d+)ris$/, m => [`${m[1]}° risultato`, 'naz']], [/^(\d+)risce$/, m => [`${m[1]}° risultato europeo`, 'int']]];

const key = h => String(h).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/cmd/g, 'cdm').replace(/[^a-z0-9]/g, '');

// Restituisce le colonne con etichetta leggibile; `legend` (gare internazionali con città e data) arricchisce Coppa del Mondo, Europei, ecc.
function describeColumns(columns, legend = []) {
  const leg = new Map(legend.map(l => [key(l.code).replace('under20', ''), l]));
  return columns.map(c => {
    // intestazioni descrittive (ranking paralimpico): "1^ Prova NAZIONALE 2025-26", "Assoluti 2025-26", "CdM"…
    if (String(c.key).length > 12 || /^cdm$/i.test(c.key)) {
      const t = String(c.key).replace(/\s+/g, ' ').trim();
      const group = /cdm|eur|chm|mond|coppa|europe|world/i.test(t) ? 'int' : /assolut|campionat/i.test(t) ? 'fin' : 'naz';
      return { code: '', label: /^cdm$/i.test(t) ? 'Coppa del Mondo' : t.replace(/NAZIONALE/g, 'Nazionale'), group, detail: c.sub || '' };
    }
    const k = key(c.key);
    let hit = FIXED[k]; if (!hit) for (const [re, f] of PATTERN) { const m = re.exec(k); if (m) { hit = f(m); break; } }
    const ev = leg.get(k.replace('under20', '')) || (k === 'chm' ? leg.get('mond') : k === 'mond' ? leg.get('chm') : null);
    const detail = c.sub || (ev ? `${ev.name}${ev.date ? ' · ' + ev.date.split('-').reverse().join('/') : ''}` : '');
    return { code: c.key, label: hit ? hit[0] : c.key, group: hit ? hit[1] : 'naz', detail };
  });
}

module.exports = { describeColumns };
