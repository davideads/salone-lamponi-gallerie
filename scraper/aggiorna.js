#!/usr/bin/env node
/* Salone Lamponi — aggiornamento automatico delle mostre in corso.
   Legge gallerie.json, visita le pagine delle gallerie, scrive ../dati/mostre.json.
   Uso:  node aggiorna.js            (tutte le gallerie)
         node aggiorna.js clima ropac (solo alcune, per prova)                     */
'use strict';
const fs = require('fs');
const path = require('path');
const { DOMParser } = require('linkedom');
const E = require('./estrai.js');

const QUI = __dirname;
const USCITA = path.join(QUI, '..', 'dati', 'mostre.json');
const MANUALI = path.join(QUI, 'manuali.json');
const AGENTE = 'Mozilla/5.0 (compatible; SaloneLamponi/1.0; +https://salonelamponi.it/gallerie)';
const oggi = new Date();
const OGGI = E.iso(oggi);

function leggiJSON(f, vuoto) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return vuoto; } }

async function scarica(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': AGENTE, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'it,en;q=0.8' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const testo = await r.text();
    if (/<title>\s*(un momento|one moment|just a moment|attention required)/i.test(testo)) throw new Error('pagina di verifica anti-robot');
    return testo;
  } finally { clearTimeout(t); }
}

// una mostra è ancora "in corso"? (vale anche per i dati vecchi e per quelli manuali)
function ancoraInCorso(m) {
  if (m.al) return m.al >= OGGI && (!m.dal || m.dal <= OGGI);
  if (m.dal) return m.dal <= OGGI && (oggi - new Date(m.dal)) / 864e5 <= 75; // senza data di chiusura: al massimo 75 giorni
  return true;
}

// alterna le gallerie, così il mosaico non mostra due mostre della stessa galleria di fila
function alterna(mostre) {
  const gruppi = new Map();
  for (const m of mostre) { if (!gruppi.has(m.id)) gruppi.set(m.id, []); gruppi.get(m.id).push(m); }
  const liste = [...gruppi.values()].sort((a, b) => (b[0].dal || '').localeCompare(a[0].dal || ''));
  const out = [];
  while (liste.some(l => l.length)) for (const l of liste) if (l.length) out.push(l.shift());
  return out;
}

async function main() {
  const conf = leggiJSON(path.join(QUI, 'gallerie.json'), { gallerie: [] }).gallerie;
  const solo = process.argv.slice(2);
  const scelte = conf.filter(g => g.pagina && (!solo.length || solo.includes(g.id)));
  const precedente = leggiJSON(USCITA, { mostre: [] });
  const rapporto = [];
  const nuove = [];

  // massimo 3 gallerie alla volta, per non pesare sui loro server
  const coda = scelte.slice();
  async function lavoratore() {
    while (coda.length) {
      const g = coda.shift();
      const riga = { id: g.id, nome: g.nome, esito: 'ok', mostre: 0, note: [] };
      try {
        const { mostre, diario } = await E.leggiGalleria(g, scarica, { DOMParser, oggi });
        riga.note = diario;
        if (/link trovati: 0\b/.test(diario[0])) throw new Error('nessun link trovato nella pagina elenco');
        mostre.forEach(m => { m.id = g.id; m.sito = g.sito; });
        nuove.push(...mostre);
        riga.mostre = mostre.length;
      } catch (e) {
        riga.esito = 'errore';
        riga.note.push(String(e.message || e));
        // la galleria non si legge: teniamo le sue mostre dell'ultimo giro, se sono ancora in corso
        const vecchie = (precedente.mostre || []).filter(m => m.id === g.id && !m.manuale && ancoraInCorso(m));
        nuove.push(...vecchie);
        riga.mostre = vecchie.length;
        if (vecchie.length) riga.note.push(`tenute ${vecchie.length} mostre dall'aggiornamento precedente`);
      }
      rapporto.push(riga);
      console.log(`${riga.esito === 'ok' ? '✓' : '✗'} ${g.nome}: ${riga.mostre} in corso${riga.esito !== 'ok' ? ' — ' + riga.note[riga.note.length - 1] : ''}`);
    }
  }
  await Promise.all([lavoratore(), lavoratore(), lavoratore()]);

  // gallerie non lette in questo giro (es. prova con argomenti): restano quelle di prima
  if (solo.length) for (const m of precedente.mostre || []) if (!solo.includes(m.id) && !m.manuale && ancoraInCorso(m)) nuove.push(m);

  // mostre inserite a mano
  const manuali = leggiJSON(MANUALI, { mostre: [] }).mostre || [];
  for (const m of manuali) if (m.titolo && m.link && ancoraInCorso(m)) nuove.push(Object.assign({ id: 'manuale', manuale: true }, m));

  // niente doppioni (stesso indirizzo), e solo mostre ancora in corso
  const viste = new Set();
  const finali = alterna(nuove.filter(m => {
    const k = (m.link || '').replace(/\/$/, '').toLowerCase();
    if (!k || viste.has(k) || !ancoraInCorso(m)) return false;
    viste.add(k); return true;
  })).map(({ galleria, id, titolo, immagine, link, dal, al, sito, manuale }) =>
    ({ galleria, id, titolo, immagine, link, dal, al, ...(sito ? { sito } : {}), ...(manuale ? { manuale } : {}) }));

  const dati = {
    aggiornato: new Date().toISOString(),
    totale: finali.length,
    mostre: finali,
    rapporto: rapporto.sort((a, b) => a.nome.localeCompare(b.nome)).map(r => ({ galleria: r.nome, esito: r.esito, mostre: r.mostre, note: r.note.slice(-3) })),
  };
  fs.mkdirSync(path.dirname(USCITA), { recursive: true });
  fs.writeFileSync(USCITA, JSON.stringify(dati, null, 2) + '\n');
  console.log(`\n${finali.length} mostre in corso scritte in dati/mostre.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
