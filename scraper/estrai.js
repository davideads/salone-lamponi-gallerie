/* Salone Lamponi — motore di lettura delle pagine delle gallerie.
   Funzioni pure: ricevono HTML già scaricato e restituiscono dati.
   Funziona sia in Node (con linkedom) sia nel browser (DOMParser nativo). */
(function (root) {
  'use strict';

  const MESI = {
    gen: 1, gennaio: 1, jan: 1, january: 1, januar: 1,
    feb: 2, febbraio: 2, february: 2, februar: 2,
    mar: 3, marzo: 3, march: 3, märz: 3,
    apr: 4, aprile: 4, april: 4,
    mag: 5, maggio: 5, may: 5, mai: 5,
    giu: 6, giugno: 6, jun: 6, june: 6, juni: 6,
    lug: 7, luglio: 7, jul: 7, july: 7, juli: 7,
    ago: 8, agosto: 8, aug: 8, august: 8,
    set: 9, sett: 9, settembre: 9, sep: 9, sept: 9, september: 9,
    ott: 10, ottobre: 10, oct: 10, october: 10, okt: 10, oktober: 10,
    nov: 11, novembre: 11, november: 11,
    dic: 12, dicembre: 12, dec: 12, december: 12, dez: 12, dezember: 12,
  };
  const NOMI_MESI = Object.keys(MESI).sort((a, b) => b.length - a.length).join('|');
  const ANNO = '(\\d{4})';

  // ogni "menzione" di data trovata nel testo: {i (posizione), fine, g, m, a|null}
  function menzioni(testo) {
    const out = [];
    const prendi = (re, f) => { let x; re.lastIndex = 0; while ((x = re.exec(testo))) { const r = f(x); if (r) out.push(Object.assign(r, { i: x.index, fine: x.index + x[0].length })); } };
    // 15.10.2026 · 15/10/2026 · 01.10. · 15-10-2026
    prendi(/(?<![\d.])(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{4}|\d{2}(?![.\/-]\d))|,\s*(\d{4}))?\.?(?![\d\/])/g, x => {
      const g = +x[1], m = +x[2]; if (g < 1 || g > 31 || m < 1 || m > 12) return null;
      // senza anno serve almeno il punto finale ("01.10.") per non confondere con altri numeri
      // senza anno: va bene "01.10." oppure "24.09 - 31.10.2026" (seguita da un'altra data)
      if (x[4]) x[3] = x[4];
      if (!x[3] && !/\.$/.test(x[0]) && !/^\s*[–—-]\s*\d/.test(testo.slice(x.index + x[0].length))) return null;
      let a = x[3] ? +x[3] : null; if (a !== null && a < 100) a += 2000;
      return { g, m, a };
    });
    // 22 settembre 2026 · 22nd September · 3 ott.
    prendi(new RegExp('(?<!\\d)(\\d{1,2})(?:st|nd|rd|th|°)?\\s+(' + NOMI_MESI + ')\\.?(?![a-zà-ü])(?:,?\\s+' + ANNO + ')?', 'gi'), x =>
      ({ g: +x[1], m: MESI[x[2].toLowerCase()], a: x[3] ? +x[3] : null }));
    // September 22, 2026 · Sept. 22
    prendi(new RegExp('(?<![a-zà-ü])(' + NOMI_MESI + ')\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)(?:,?\\s+' + ANNO + ')?', 'gi'), x =>
      ({ g: +x[2], m: MESI[x[1].toLowerCase()], a: x[3] ? +x[3] : null }));
    // "12 – 30 novembre 2026": il primo numero è un giorno dello stesso mese
    prendi(new RegExp('(?<![\\d.])(\\d{1,2})(?=\\s*(?:[–—-]|al|to|until|bis)\\s*\\d{1,2}(?:st|nd|rd|th)?\\s+(' + NOMI_MESI + '))', 'gi'), x =>
      ({ g: +x[1], m: MESI[x[2].toLowerCase()], a: null, soloGiorno: true }));
    // tieni la menzione più lunga quando due si sovrappongono
    out.sort((p, q) => p.i - q.i || (q.fine - q.i) - (p.fine - p.i));
    const pulite = [];
    for (const d of out) { const u = pulite[pulite.length - 1]; if (u && d.i < u.fine) continue; pulite.push(d); }
    return pulite.filter(d => d.g >= 1 && d.g <= 31 && d.m);
  }

  const SEPARATORE = /^[\s,.]*(?:[–—\-|/]|to|till|until|al|a|fino al|bis|through|→)[\s,.]*$|^\s*$/i;

  /* Trova il primo intervallo "dal … al …" nel testo. Restituisce {dal, al} come stringhe AAAA-MM-GG. */
  function intervallo(testo, oggi) {
    if (!testo) return null;
    testo = String(testo).replace(/\s+/g, ' ')
      // "May 9 - 23, 2026" → "May 9, 2026 - May 23, 2026"
      .replace(new RegExp('(?<![a-zà-ü])(' + NOMI_MESI + ')\\.?\\s+(\\d{1,2})\\s*[–—-]\\s*(\\d{1,2})(?!\\d|\\s*(?:' + NOMI_MESI + '))(,?\\s*\\d{4})?', 'gi'), '$1 $2$4 - $1 $3$4');
    const ds = menzioni(testo);
    const annoOggi = (oggi || new Date()).getFullYear();
    for (let k = 0; k < ds.length - 1; k++) {
      const a = ds[k], b = ds[k + 1];
      const tra = testo.slice(a.fine, b.i);
      if (tra.length > 14 || !SEPARATORE.test(tra)) continue;
      let annoFine = b.a || a.a || annoOggi;
      let annoInizio = a.a || (a.m > b.m ? annoFine - 1 : annoFine);
      const dal = new Date(Date.UTC(annoInizio, a.m - 1, a.g));
      const al = new Date(Date.UTC(annoFine, b.m - 1, b.g));
      if (al < dal || al - dal > 400 * 864e5) continue; // non plausibile
      return { dal: iso(dal), al: iso(al) };
    }
    // "through November 5th, 2026" · "fino al 30 novembre 2026": solo la data di chiusura
    const f = new RegExp('(?:through|until|till|fino al|fino a|bis zum|bis)\\s+', 'i').exec(testo);
    if (f) {
      const d = ds.find(x => x.i >= f.index + f[0].length && x.i <= f.index + f[0].length + 12);
      if (d) return { dal: null, al: iso(new Date(Date.UTC(d.a || annoOggi, d.m - 1, d.g))) };
    }
    return null;
  }
  const iso = d => d.toISOString().slice(0, 10);

  /* Solo data d'inaugurazione (es. "Date: 5 novembre 2026"): se è recente la mostra è considerata in corso. */
  function inizioRecente(testo, oggi, giorni) {
    if (!testo) return null;
    oggi = oggi || new Date();
    const d = menzioni(String(testo).replace(/\s+/g, ' ').slice(0, 1500)).find(x => x.a && !x.soloGiorno);
    if (!d) return null;
    const t = new Date(Date.UTC(d.a, d.m - 1, d.g));
    const diff = (oggi - t) / 864e5;
    return diff >= 0 && diff <= (giorni || 45) ? { dal: iso(t), al: null } : null;
  }

  function inCorso(r, oggi) {
    const t = iso(oggi || new Date());
    return !!r && (!r.dal || r.dal <= t) && (!r.al || t <= r.al);
  }

  /* ---------- HTML ---------- */
  function documento(html, url, DOMParserImpl) {
    const P = DOMParserImpl || root.DOMParser;
    const d = new P().parseFromString(html, 'text/html');
    d.__url = url;
    d.__html = html;
    // alcune pagine dichiarano un <base href>: gli indirizzi relativi vanno risolti da lì
    const b = d.querySelector && d.querySelector('base[href]');
    try { d.__base = b ? new URL(b.getAttribute('href'), url).href : url; } catch (_) { d.__base = url; }
    return d;
  }
  const assoluto = (h, base) => { try { return new URL(h, base).href.split('#')[0]; } catch (_) { return null; } };
  const spazi = s => (s || '').replace(/\s+/g, ' ').trim();
  // testo di un elemento con uno spazio tra un blocco e l'altro ("BARSKAYA" + "April 09" non si fondono)
  function testoDi(el) {
    if (!el) return '';
    const out = [];
    (function giro(n) {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) out.push(c.nodeValue);
        else if (c.nodeType === 1 && !/^(SCRIPT|STYLE|NOSCRIPT)$/.test(c.nodeName)) { out.push(' '); giro(c); out.push(' '); }
      }
    })(el);
    return spazi(out.join(''));
  }

  /* link alle schede delle mostre presenti nella pagina elenco */
  function linkMostre(doc, conf) {
    const base = doc.__base || doc.__url;
    const re = new RegExp(conf.link || '(exhibition|esibizion|mostr|show|esposizion)[^/]*/[^/?#]{3,}', 'i');
    const origine = new URL(base).origin.replace(/^https?:\/\/(www\.)?/, '');
    const visti = new Map();
    const reTesto = conf.testoLink ? new RegExp(conf.testoLink, 'i') : null;
    if (reTesto) { // tieni solo gli indirizzi che compaiono in almeno un link con quel testo (es. "EXHIBITION")
      const ok = new Set([...doc.querySelectorAll('a[href]')].filter(a => reTesto.test(spazi(a.textContent))).map(a => assoluto(a.getAttribute('href'), base)));
      conf = Object.assign({}, conf, { __ok: ok });
    }
    let ambito = conf.sezione ? doc.querySelector(conf.sezione) : null;
    ambito = ambito || doc;
    for (const a of ambito.querySelectorAll('a[href]')) {
      const h = assoluto(a.getAttribute('href'), base);
      if (!h || !re.test(h)) continue;
      if (h.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] !== origine) continue;
      if (conf.escludi && new RegExp(conf.escludi, 'i').test(h)) continue;
      if (conf.__ok && !conf.__ok.has(h)) continue;
      const t = testoDi(a);
      const prec = visti.get(h);
      if (!prec) visti.set(h, { url: h, testo: t, testi: t ? [t] : [], contesto: contesto(a, re, base), img: immagineVicina(a, base) });
      else { if (t.length > prec.testo.length) prec.testo = t; if (t && !prec.testi.includes(t)) prec.testi.push(t); if (!prec.img) prec.img = immagineVicina(a, base); }
    }
    return [...visti.values()];
  }
  // immagine dentro il link o nel suo riquadro (anteprima nella pagina elenco)
  function immagineVicina(a, base) {
    let n = a;
    for (let i = 0; i < 3 && n; i++) {
      const img = n.querySelector && n.querySelector('img');
      if (img) { const u = immagineDa(img, base); if (u && !NON_FOTO.test(u)) return u; }
      n = n.parentElement;
      if (n && n.querySelectorAll('a[href]').length > 3) break; // siamo usciti dal riquadro
    }
    return null;
  }

  // testo del "riquadro" che contiene il link (per leggere le date scritte accanto)
  function contesto(a, re, base) {
    const mio = assoluto(a.getAttribute('href'), base);
    let n = a, ultimo = testoDi(a);
    for (let i = 0; i < 4 && n.parentElement; i++) {
      n = n.parentElement;
      // se il riquadro contiene anche altre mostre, ci fermiamo: le loro date non sono di questa
      if (re) {
        const altri = new Set();
        for (const x of n.querySelectorAll('a[href]')) { const h = assoluto(x.getAttribute('href'), base); if (h && h !== mio && re.test(h)) altri.add(h); }
        if (altri.size) return ultimo;
      }
      const t = testoDi(n);
      if (t.length > 600) return ultimo;
      ultimo = t;
      if (t.length > 40) return t;
    }
    return ultimo;
  }

  // testo principale della pagina, senza intestazione, menu e piè di pagina
  function testoPrincipale(doc) {
    const c = (doc.querySelector('main, article, [role=main], #main, .main, #content, .content') || doc.body);
    if (!c) return '';
    const copia = c.cloneNode(true);
    copia.querySelectorAll('header, footer, nav, script, style, noscript, form, [class*=footer], [class*=cookie], [id*=footer], [id*=cookie]').forEach(n => n.remove());
    return testoDi(copia);
  }

  function testoTuttaPagina(doc) {
    if (!doc.body) return '';
    const copia = doc.body.cloneNode(true);
    copia.querySelectorAll('script, style, noscript, nav').forEach(n => n.remove());
    return testoDi(copia);
  }

  const meta = (doc, nomi) => {
    for (const n of nomi) {
      const el = doc.querySelector(`meta[property="${n}"], meta[name="${n}"]`);
      const v = el && el.getAttribute('content');
      if (v && v.trim()) return v.trim();
    }
    return null;
  };

  function immagineDa(img, base) {
    const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
    if (srcset) {
      // il candidato più largo
      const parti = srcset.split(',').map(s => s.trim().split(/\s+/)).filter(p => p[0]);
      parti.sort((p, q) => (parseInt(q[1]) || 0) - (parseInt(p[1]) || 0));
      if (parti[0] && !parti[0][0].startsWith('data:')) return assoluto(parti[0][0], base);
    }
    for (const a of ['data-src', 'data-lazy-src', 'data-original', 'src']) {
      const v = img.getAttribute(a);
      if (v && !v.startsWith('data:')) return assoluto(v, base);
    }
    return null;
  }
  const NON_FOTO = /logo|icon|favicon|sprite|avatar|placeholder|blank|spacer|\.svg(\?|$)|\.gif(\?|$)|artist-pic|flag/i;

  function primaImmagine(doc, conf) {
    const base = doc.__base || doc.__url;
    const c = (conf.immagineSel && doc.querySelector(conf.immagineSel)) || doc.querySelector('main, article, #content, .content') || doc.body;
    if (!c) return null;
    for (const img of c.querySelectorAll(conf.immagineSel ? 'img, source' : 'img')) {
      if (img.closest && img.closest('header, footer, nav')) continue;
      const u = immagineDa(img, base);
      if (!u || NON_FOTO.test(u)) continue;
      const w = parseInt(img.getAttribute('width') || '0');
      if (w && w < 200) continue;
      return u;
    }
    // immagini di sfondo in stile in linea
    const bg = c.querySelector('[style*="background-image"]');
    if (bg) { const m = /url\(["']?([^"')]+)/.exec(bg.getAttribute('style')); if (m && !NON_FOTO.test(m[1])) return assoluto(m[1], base); }
    return null;
  }

  function pulisciTitolo(t, nomeGalleria) {
    if (!t) return '';
    t = spazi(t);
    const parti = t.split(/\s+[|–—•·:-]\s+|\s+-\s+/).map(spazi).filter(Boolean);
    const chiave = (nomeGalleria || '').toLowerCase().replace(/^galleria\s+/, '').replace(/[^a-z0-9]/g, '');
    const utili = parti.filter(p => {
      const k = p.toLowerCase().replace(/^galleria\s+/, '').replace(/[^a-z0-9]/g, '');
      return !(chiave && (k === chiave || k.includes(chiave) || (k.length > 3 && chiave.includes(k))));
    });
    return (utili.length ? utili : parti).join(' — ');
  }

  /* ---------- logo della galleria ----------
     Cercato nell'intestazione del sito: immagine o SVG con "logo" nel nome, oppure dentro il link alla home.
     In gallerie.json si può indicare a mano: "logo": "https://..." (o "nessuno"), "logoNero": true per i loghi bianchi. */
  const RE_LOGO = /logo|brand|marchio/i;
  const RE_NON_LOGO = /sponsor|partner|social|instagram|facebook|twitter|whatsapp|newsletter|payoff|hamburger|loader|search|cerca|arrow|freccia|close|chiudi/i;
  const RE_CHIARO = /white|bianc|negativ|light|inverse|_w\.|-w\./i;
  function firma(el) {
    if (!el || !el.getAttribute) return '';
    return ['class', 'id', 'alt', 'title', 'aria-label'].map(a => el.getAttribute(a) || '').join(' ');
  }
  // SVG scritto dentro la pagina: diventa un'immagine "data:" (nessun file esterno)
  function svgInLinea(svg) {
    if (svg.querySelector('use, image, foreignObject')) return null;
    let s = svg.outerHTML || '';
    if (!s || s.length > 40000) return null;
    if (!/xmlns=/.test(s)) s = s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    s = s.replace(/currentColor/g, '#000');
    const colori = (s.match(/(?:fill|stroke)\s*[=:]\s*["']?\s*(#[0-9a-f]{3,8}|white|black|rgb\([^)]*\))/gi) || [])
      .map(c => c.replace(/.*[=:]\s*["']?\s*/, '').toLowerCase()).filter(c => c !== 'none');
    const chiaro = colori.length > 0 && colori.every(c => /^(#fff(fff)?|white|rgb\(255,\s*255,\s*255\))$/.test(c));
    return { url: 'data:image/svg+xml,' + encodeURIComponent(s), chiaro };
  }
  function eHome(href, base) {
    const h = assoluto(href || '', base);
    if (!h) return false;
    try {
      const u = new URL(h), b = new URL(base);
      return u.host.replace(/^www\./, '') === b.host.replace(/^www\./, '') && /^\/((it|en)\/?)?(index\.(html?|php))?$/i.test(u.pathname);
    } catch (_) { return false; }
  }
  function trovaLogo(doc, conf) {
    const base = doc.__base || doc.__url;
    const parole = (conf.nome || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !/galleria|gallery|fondazione/.test(w));
    let migliore = null, punti = -Infinity;
    [...doc.querySelectorAll('img, svg')].forEach((n, i) => {
      const img = /^img$/i.test(n.nodeName);
      if (!img && n.parentNode && n.parentNode.closest && n.parentNode.closest('svg')) return;
      const src = img ? immagineDa(n, base) : null;
      if (img && !src) return;
      const qui = firma(n) + ' ' + (src || '').split('/').pop();
      if (RE_NON_LOGO.test(qui)) return;
      let su = '';
      for (let g = n.parentNode, k = 0; g && g.getAttribute && k < 4; g = g.parentNode, k++) su += ' ' + firma(g);
      let p = 0;
      if (RE_LOGO.test(qui)) p += 6;
      if (RE_LOGO.test(su)) p += 4;
      const a = n.closest && n.closest('a');
      if (a && eHome(a.getAttribute('href'), base)) p += 4;
      if (n.closest && n.closest('header, nav, [class*="header"], [id*="header"]')) p += 3;
      if (n.closest && n.closest('footer, [class*="footer"], [id*="footer"]')) p -= 6;
      const alt = ((img && n.getAttribute('alt')) || firma(a) || '').toLowerCase();
      if (parole.some(w => alt.includes(w))) p += 3;
      if (p < 6) return;
      p -= i * 0.01; // a parità di indizi vince il primo nella pagina
      if (p <= punti) return;
      const v = img ? { url: src.replace(/^http:/, 'https:'), chiaro: RE_CHIARO.test(src.split('/').pop()) } : svgInLinea(n);
      if (!v) return;
      punti = p; migliore = v;
    });
    if (migliore) return migliore;
    // ripiego: l'icona del sito per i dispositivi
    const ico = doc.querySelector('link[rel~="apple-touch-icon"], link[rel="icon"][sizes="192x192"], link[rel="icon"][sizes="180x180"]');
    const u = ico && assoluto(ico.getAttribute('href'), base);
    return u ? { url: u.replace(/^http:/, 'https:'), chiaro: false, icona: true } : null;
  }
  function logoGalleria(doc, conf) {
    if (conf.logo === 'nessuno') return null;
    const l = conf.logo ? { url: assoluto(conf.logo, conf.sito || doc.__url), chiaro: false } : trovaLogo(doc, conf);
    if (l && conf.logoNero !== undefined) l.chiaro = !!conf.logoNero;
    return l;
  }

  /* dati della scheda mostra */
  function scheda(doc, conf) {
    const titoloGrezzo = (conf.titoloSel && testoDi(doc.querySelector(conf.titoloSel))) ||
      meta(doc, ['og:title', 'twitter:title']) || spazi(doc.querySelector('h1')?.textContent) || spazi(doc.title);
    let immagine = meta(doc, ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']);
    if (immagine) immagine = assoluto(immagine, doc.__base || doc.__url);
    if (!immagine || NON_FOTO.test(immagine) || conf.preferisciFoto) immagine = primaImmagine(doc, conf) || immagine;
    if (conf.immagineRegex) { // immagine cercata nel codice della pagina (siti che le caricano con JavaScript)
      const m = new RegExp(conf.immagineRegex, 'i').exec(String(doc.__html || '').replace(/\\u002F/gi, '/'));
      if (m) immagine = m[0];
    }
    if (immagine && conf.immagineDa) immagine = immagine.replace(new RegExp(conf.immagineDa[0]), conf.immagineDa[1]);
    const testo = conf.testoTutto ? testoTuttaPagina(doc) : testoPrincipale(doc);
    return { titolo: pulisciTitolo(titoloGrezzo, conf.nome), immagine, testo };
  }

  /* Legge una galleria: pagina elenco → schede → solo mostre in corso (a Milano).
     scarica(url) deve restituire il testo HTML della pagina. */
  async function leggiGalleria(conf, scarica, opz) {
    opz = opz || {};
    const oggi = opz.oggi || new Date();
    const P = opz.DOMParser;
    const diario = [];
    const html = await scarica(conf.pagina);
    const doc = documento(html, conf.pagina, P);
    const links = linkMostre(doc, conf);
    diario.push(`link trovati: ${links.length}`);
    // logo: dalla pagina elenco; se lì non c'è (o c'è solo l'icona), dalla home del sito
    let logo = logoGalleria(doc, conf);
    if ((!logo || logo.icona) && !conf.logo && conf.sito && conf.sito.replace(/\/$/, '') !== conf.pagina.replace(/\/$/, '')) {
      try { logo = trovaLogo(documento(await scarica(conf.sito), conf.sito, P), conf) || logo; } catch (_) { /* resta quello che c'è */ }
      if (logo && conf.logoNero !== undefined) logo.chiaro = !!conf.logoNero;
    }
    const mostre = [];
    let schedeLette = 0, passateDiFila = 0;
    const MAX_SCHEDE = conf.maxSchede || 10;
    const RE_MILANO = /\bmila(n|no)\b/i;
    const RE_ALTRE = conf.altreCitta ? new RegExp(conf.altreCitta, 'i') : null;
    for (const l of links.slice(0, conf.soloPrima ? 1 : (conf.max || 40))) {
      let r = intervallo(l.testo, oggi) || intervallo(l.contesto, oggi) ||
        intervallo(decodeURIComponent(l.url).replace(/[\/_]/g, ' '), oggi); // date scritte nell'indirizzo
      if (!r && conf.dataMese) r = meseRecente(l.testo + ' ' + l.contesto, oggi);
      if (r && !inCorso(r, oggi)) {
        if (r.al < iso(oggi)) { passateDiFila++; if (passateDiFila >= 6) break; }
        continue;
      }
      if (conf.richiedi && !new RegExp(conf.richiedi, 'i').test(l.testo + ' ' + l.contesto)) continue; // es. solo "Mostra", non concerti o talk
      if (!r && conf.soloDateElenco) continue; // le schede senza date nell'elenco non sono mostre (es. pagine artista)
      if (conf.cittaInElenco && !RE_MILANO.test(l.testo + ' ' + l.contesto)) continue;
      if (schedeLette >= MAX_SCHEDE) break;
      let s;
      try { s = scheda(documento(await scarica(l.url), l.url, P), conf); schedeLette++; }
      catch (e) { diario.push(`scheda non letta ${l.url}: ${e.message || e}`); continue; }
      if (!r) r = intervallo(s.testo.slice(0, 4000), oggi);
      if (!r && conf.dataSingola !== false) r = inizioRecente(s.testo, oggi, conf.dataSingola);
      const accetta = r ? inCorso(r, oggi) : !!conf.tutteInCorso;
      if (!accetta) { if (r && r.al < iso(oggi)) passateDiFila++; continue; }
      passateDiFila = 0;
      if (RE_ALTRE) {
        const dove = l.contesto + ' ' + s.testo.slice(0, 2500);
        if (RE_ALTRE.test(dove) && !RE_MILANO.test(dove)) { diario.push(`scartata (non a Milano): ${l.url}`); continue; }
        if (conf.soloMilano && !RE_MILANO.test(dove)) { diario.push(`scartata (Milano non citata): ${l.url}`); continue; }
      }
      if (conf.titoloDaElenco) {
        const via = /^(exhibitions?|mostr[ae]|current|in corso|on view)$|\b(via|corso|viale|piazza)\b|\d{5}/i;
        const t = l.testi.filter(x => !via.test(x) && x.length < 120);
        if (t.length) s.titolo = t.join(' — ');
      }
      if (!s.immagine && l.img) s.immagine = conf.immagineDa ? l.img.replace(new RegExp(conf.immagineDa[0]), conf.immagineDa[1]) : l.img;
      if (!s.titolo) { diario.push(`senza titolo: ${l.url}`); continue; }
      mostre.push({
        // sempre https: la pagina del Salone scarta i collegamenti non sicuri
        galleria: conf.nome, id: conf.id, titolo: s.titolo, link: l.url.replace(/^http:/, 'https:'),
        dal: r ? r.dal : null, al: r ? r.al : null,
      });
    }
    diario.push(`schede lette: ${schedeLette}, mostre in corso: ${mostre.length}`);
    return { mostre, diario, logo };
  }

  /* Solo mese e anno (es. "October, 2026"): inizio al primo del mese, valido se recente. */
  function meseRecente(testo, oggi, giorni) {
    const m = new RegExp('(?<![a-zà-ü])(' + NOMI_MESI + ')\\.?,?\\s+(\\d{4})', 'i').exec(String(testo || ''));
    if (!m) return null;
    const t = new Date(Date.UTC(+m[2], MESI[m[1].toLowerCase()] - 1, 1));
    const diff = ((oggi || new Date()) - t) / 864e5;
    return diff >= 0 && diff <= (giorni || 75) ? { dal: iso(t), al: null } : null;
  }

  const API = { trovaLogo, logoGalleria, meseRecente, leggiGalleria, inizioRecente, menzioni, intervallo, inCorso, documento, linkMostre, scheda, testoPrincipale, pulisciTitolo, iso };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.SLEstrai = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
