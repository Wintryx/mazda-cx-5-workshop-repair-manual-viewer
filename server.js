// server.js – Mazda CX-5 Service Manual Viewer (v1.5.0)
//
// Änderungen v1.5.0:
//  - Handbuch-Verzeichnis über lib/paths.js: MANUAL_DIR → config/settings.json → data\
//  - Startprüfung: fehlendes Verzeichnis oder PDF-Anzahl ≠ Index wird klar gemeldet
//  - /api/status nennt zusätzlich die Quelle des Pfades (manualDirSource)
//
// Änderungen v1.4.0:
//  - Sicherheit: Path-Traversal in /pdf/ und /public/ geschlossen (safeJoin), keine CORS-Wildcard mehr
//  - Suche: Wortgrenzen, IDF-Gewichtung, Phrasen-Synonyme, Tippfehler-Fallback, Paging
//  - Kataloge aus config/*.json (Kapitel, Reparatur-Packs, Checklisten) statt hartkodierter Listen
//  - O(1)-Lookups über Map statt linearer Suche
//  - Startprüfung des Handbuch-Verzeichnisses mit klarer Fehlermeldung

const http = require('http');
const fs = require('fs');
const path = require('path');

const { MANUAL_DIR, MANUAL_SOURCE, countPdfs } = require('./lib/paths');

const START_PORT = parseInt(process.env.PORT, 10) || 3300;
const MANUAL_ROOT = MANUAL_DIR;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CONFIG_DIR = path.join(__dirname, 'config');
const INDEX_FILE = path.join(PUBLIC_DIR, 'search_index.json');
const PORT_FILE = path.join(__dirname, '.active_port');

// Request-Log: API- und PDF-Aufrufe sowie alle Fehler; mit LOG_REQUESTS=0 abschaltbar.
const REQUEST_LOG = process.env.LOG_REQUESTS !== '0';
// Testläufe dürfen die echte .active_port nicht überschreiben (MAZDA_PORT_FILE=0).
const WRITE_PORT_FILE = process.env.MAZDA_PORT_FILE !== '0';

let CURRENT_PORT = START_PORT;
let portFileWritten = false;

/** Schreibt den aktiven Port – nur solange der Server läuft. */
function writePortFile(port) {
  if (!WRITE_PORT_FILE) return;
  try {
    fs.writeFileSync(PORT_FILE, String(port), 'utf8');
    portFileWritten = true;
  } catch (e) {
    // z. B. im asar-Archiv der Desktop-App nicht schreibbar
  }
}

/** Entfernt die Datei beim Beenden, damit kein veralteter Port stehen bleibt. */
function clearPortFile() {
  if (!portFileWritten) return;
  portFileWritten = false;
  try {
    if (fs.readFileSync(PORT_FILE, 'utf8').trim() === String(CURRENT_PORT)) fs.unlinkSync(PORT_FILE);
  } catch (e) {
    // Datei existiert nicht mehr oder gehört einem anderen Prozess
  }
}

process.on('exit', clearPortFile);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
  process.on(signal, () => { clearPortFile(); process.exit(0); });
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Löst einen relativen Pfad sicher unterhalb von root auf. null = unzulässig. */
function safeJoin(root, rel) {
  let decoded;
  try {
    decoded = decodeURIComponent(rel);
  } catch (e) {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const target = path.resolve(root, decoded);
  const relPath = path.relative(root, target);
  if (!relPath || relPath.startsWith('..') || path.isAbsolute(relPath)) return null;
  return target;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (fs.existsSync(file)) console.warn(`Konfiguration konnte nicht gelesen werden: ${file} (${e.message})`);
    return fallback;
  }
}

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function pad(s) {
  return ' ' + s + ' ';
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf'
};

// ---------------------------------------------------------------------------
// Katalog
// ---------------------------------------------------------------------------

let catalog = [];
const byFile = new Map();
let docs = [];
let treeCache = null;

function loadCatalog() {
  catalog = readJson(INDEX_FILE, []);
  if (!Array.isArray(catalog) || catalog.length === 0) {
    console.warn('WARNUNG: search_index.json fehlt oder ist leer. Bitte "node build_index.js" ausführen.');
    catalog = [];
  }
  byFile.clear();
  for (const e of catalog) byFile.set(e.f, e);
  treeCache = null;
  dtcCache = null;
  console.log(`Katalog geladen: ${catalog.length} Dokumente.`);
  docs = null; // Suchindex wird lazy gebaut
}

// ---------------------------------------------------------------------------
// Kapitelbaum (aus dem Index generiert, v1.8.0)
// ---------------------------------------------------------------------------

/**
 * Baut aus dem Katalog einen Baum Gruppe → Sektion → Dokumente.
 * Die 161 Sektionen ergeben sich aus den Sektionscodes, die Bezeichnung aus
 * dem häufigsten Titel der Sektion. Wird beim ersten Aufruf berechnet und
 * beim Neuladen des Katalogs verworfen.
 */
function buildTree() {
  if (treeCache) return treeCache;

  const groups = new Map();
  for (const e of catalog) {
    const groupLabel = e.grp || 'Allgemein';
    let group = groups.get(groupLabel);
    if (!group) {
      group = { label: groupLabel, count: 0, sections: new Map(), types: new Set() };
      groups.set(groupLabel, group);
    }
    group.count++;
    group.types.add(e.type || 'workshop');

    // Sektion = Kapitelteil des Codes ("01-14B-35" -> "01-14B"), nicht die Einzelseite
    const code = (String(e.sec || '').match(/^(\d{2}-\d{2}[A-Z]?)/) || [])[1] || '';
    let section = group.sections.get(code);
    if (!section) {
      section = { code, titles: new Map(), docs: [] };
      group.sections.set(code, section);
    }
    section.docs.push({ f: e.f, s: e.sec || '', t: (e.t || '').slice(0, 70) });
    if (e.t) section.titles.set(e.t, (section.titles.get(e.t) || 0) + 1);
  }

  const groupRank = (label) => {
    const m = String(label).match(/^(\d{2})\b/);
    return m ? parseInt(m[1], 10) : 99;
  };
  const fileNo = (f) => {
    const m = String(f).match(/(\d+)\.pdf$/);
    return m ? parseInt(m[1], 10) : 0;
  };

  // Schlüssel für die Übersetzung: Dokumentfamilie, sonst Kapitelnummer (00–12).
  const FAMILY_KEYS = { wiring: 'wiring', bodyshop: 'body', technical: 'tech', root: 'misc' };
  const groupKey = (g) => {
    const types = [...g.types];
    if (types.length === 1 && FAMILY_KEYS[types[0]]) return FAMILY_KEYS[types[0]];
    const prefix = String(g.label).match(/^(\d{2})\b/);
    return prefix ? prefix[1] : 'misc';
  };

  const tree = [...groups.values()].map((g) => {
    const sections = [...g.sections.values()].map((s) => {
      // Nur eine wirklich homogene Sektion bekommt eine Bezeichnung; sonst
      // bleibt der Code stehen, statt einen irreführenden Titel zu zeigen.
      let label = '';
      let best = 0;
      for (const [title, n] of s.titles) {
        if (n > best) { best = n; label = title; }
      }
      if (!label || best / s.docs.length < 0.4) label = '';
      s.docs.sort((a, b) => fileNo(a.f) - fileNo(b.f));
      return { code: s.code, label: label.slice(0, 60), count: s.docs.length, docs: s.docs };
    }).sort((a, b) => (a.code || 'zz').localeCompare(b.code || 'zz'));

    return { key: groupKey(g), label: g.label, count: g.count, sections };
  }).sort((a, b) => groupRank(a.label) - groupRank(b.label) || a.label.localeCompare(b.label));

  treeCache = tree;
  return tree;
}

// ---------------------------------------------------------------------------
// Suchindex (lazy)
// ---------------------------------------------------------------------------

const SYNONYMS = {
  'bremse': ['brake'], 'bremsen': ['brake'], 'bremsanlage': ['brake system'],
  'bremsbelag': ['brake pad', 'disc pad'], 'bremsbeläge': ['brake pad', 'disc pad'],
  'bremsscheibe': ['disc plate', 'brake disc'], 'bremsscheiben': ['disc plate', 'brake disc'],
  'handbremse': ['parking brake'], 'feststellbremse': ['parking brake'],
  'scheibenbremse': ['disc brake'], 'trommelbremse': ['drum brake'],
  'bremsflüssigkeit': ['brake fluid'], 'bremsleitung': ['brake pipe', 'brake hose'],
  'bremslicht': ['brake light'], 'abs': ['abs', 'dynamic stability control'],
  'injektor': ['injector'], 'injektoren': ['injector'], 'einspritzdüse': ['injector'],
  'einspritzdüsen': ['injector'], 'einspritzleitung': ['injection pipe'],
  'einspritzpumpe': ['supply pump'], 'hochdruckpumpe': ['high pressure fuel pump'],
  'injektordichtung': ['injector', 'copper'],
  'kraftstoff': ['fuel'], 'benzin': ['fuel', 'gasoline'], 'diesel': ['diesel'],
  'kraftstofffilter': ['fuel filter'], 'dieselfilter': ['fuel filter'],
  'tank': ['fuel tank'], 'tankgeber': ['fuel gauge sender'],
  'öl': ['oil'], 'ölwechsel': ['oil replacement', 'oil filter'], 'ölsieb': ['oil strainer'],
  'ölwanne': ['oil pan'], 'ölpumpe': ['oil pump'], 'ölfilter': ['oil filter'],
  'öldruck': ['oil pressure'], 'ölstand': ['oil level'],
  'schmierung': ['lubrication'], 'schmiersystem': ['lubrication system'],
  'klima': ['air conditioning'], 'klimaanlage': ['air conditioning'],
  'klimakompressor': ['compressor'], 'kältemittel': ['refrigerant'],
  'trockner': ['receiver drier'], 'verdampfer': ['evaporator'], 'kondensator': ['condenser'],
  'heizung': ['heater'], 'wärmetauscher': ['heater core'],
  'innenraumfilter': ['air cleaner', 'air filter'], 'pollenfilter': ['air cleaner', 'air filter'],
  'luftfilter': ['air cleaner', 'air filter'], 'luftmassenmesser': ['mass air flow'],
  'drosselklappe': ['throttle'], 'ansaug': ['intake'],
  'kupplung': ['clutch'], 'kupplungsscheibe': ['clutch disc'],
  'getriebe': ['transmission', 'transaxle'], 'schaltgetriebe': ['manual transaxle'],
  'automatik': ['automatic transaxle'], 'automatikgetriebe': ['automatic transaxle'],
  'fahrwerk': ['suspension'], 'stoßdämpfer': ['shock absorber'], 'dämpfer': ['shock absorber'],
  'feder': ['spring'], 'federn': ['spring'], 'querlenker': ['control arm'],
  'querlenkerlager': ['control arm bushing'], 'achse': ['axle'], 'radlager': ['wheel bearing'],
  'achsschenkel': ['knuckle'], 'antriebswelle': ['drive shaft'], 'kardanwelle': ['propeller shaft'],
  'differential': ['differential'], 'allrad': ['4wd', 'four wheel drive'],
  'lenkung': ['steering'], 'lenkgetriebe': ['steering gear'], 'spurstange': ['tie rod'],
  'spurstangenkopf': ['tie rod', 'tie rod end'], 'servolenkung': ['electric power steering'],
  'lenkrad': ['steering wheel'], 'achsvermessung': ['wheel alignment'],
  'anlasser': ['starter'], 'lichtmaschine': ['generator'], 'generator': ['generator'],
  'glühkerze': ['glow plug'], 'glühkerzen': ['glow plug'], 'glühsteuergerät': ['glow plug control'],
  'zündkerze': ['spark plug'], 'zündkerzen': ['spark plug'],
  'batterie': ['battery'], 'sicherung': ['fuse'], 'sicherungen': ['fuse'], 'relais': ['relay'],
  'steuergerät': ['control module'], 'wegfahrsperre': ['immobilizer'],
  'steuerkette': ['timing chain'], 'kette': ['timing chain'],
  'zahnriemen': ['timing belt'], 'nockenwelle': ['camshaft'], 'kurbelwelle': ['crankshaft'],
  'kurbelwellensensor': ['crankshaft position sensor'], 'nockenwellensensor': ['camshaft position sensor'],
  'ventilspiel': ['valve clearance'], 'zylinderkopf': ['cylinder head'], 'kolben': ['piston'],
  'pleuel': ['connecting rod'], 'kurbelgehäuse': ['crankcase'], 'kompression': ['compression'],
  'turbolader': ['turbocharger'], 'turbo': ['turbocharger'], 'ladeluftkühler': ['intercooler'],
  'ladedruck': ['boost pressure'], 'abgas': ['exhaust'], 'auspuff': ['exhaust'],
  'partikelfilter': ['particulate filter'], 'dpf': ['particulate filter'],
  'agr': ['egr'], 'agr-ventil': ['egr valve'], 'lambdasonde': ['oxygen sensor'],
  'raildruck': ['fuel pressure'], 'rücklauf': ['return'],
  'schaltplan': ['wiring diagram'], 'schaltpläne': ['wiring diagram'], 'kabel': ['wiring'],
  'kabelbaum': ['wiring harness'], 'stecker': ['connector'], 'massepunkt': ['ground'],
  'kühlung': ['cooling'], 'kühler': ['radiator'], 'thermostat': ['thermostat'],
  'wasserpumpe': ['water pump'], 'kühlmittel': ['coolant'],
  'karosserie': ['body'], 'tür': ['door'], 'türen': ['door'], 'stoßstange': ['bumper'],
  'scheinwerfer': ['headlight'], 'nebelscheinwerfer': ['fog light'], 'licht': ['light'],
  'beleuchtung': ['lighting'], 'rückleuchte': ['rear combination light'], 'blinker': ['turn signal'],
  'spiegel': ['mirror'], 'scheibe': ['glass'], 'windschutzscheibe': ['windshield'],
  'wischer': ['wiper'], 'scheibenwischer': ['wiper'], 'fensterheber': ['power window'],
  'zentralverriegelung': ['door lock'], 'sitz': ['seat'], 'sitze': ['seat'],
  'reifendruck': ['tire pressure'], 'reifen': ['tire'], 'felge': ['wheel'],
  'drehmoment': ['torque'], 'anzug': ['tightening'],
  'fehlerspeicher': ['dtc'], 'fehlercode': ['dtc'], 'fehlzündung': ['misfire'],
  'ruckeln': ['hesitation'], 'leerlauf': ['idle'], 'geräusch': ['noise'],
  'unterdruckpumpe': ['vacuum pump'], 'airbag': ['air bag', 'airbag'],
  'gurtstraffer': ['seat belt pretensioner'], 'sicherheitsgurt': ['seat belt'],
  'i-stop': ['i-stop'], 'start-stopp': ['i-stop']
};

// Synonyme mit normalisierten Schlüsseln (öl -> oel), damit Umlaute treffen
const SYN_NORM = new Map();
for (const key of Object.keys(SYNONYMS)) SYN_NORM.set(normalize(key), SYNONYMS[key]);

// Grobe Kapitel-Zuordnung: deutsche Begriffe bevorzugen ihre Baugruppe
const GROUP_HINTS = {
  bremse: '04', bremsen: '04', bremsbelag: '04', bremsscheibe: '04', handbremse: '04', feststellbremse: '04',
  motor: '01', oel: '01', oelwechsel: '01', schmierung: '01', injektor: '01', kraftstoff: '01',
  steuerkette: '01', turbolader: '01', dpf: '01', agr: '01', kuehlung: '01', zylinderkopf: '01',
  fahrwerk: '02', radlager: '02', stossdaempfer: '02', querlenker: '02', achsvermessung: '02',
  antrieb: '03', antriebswelle: '03', differential: '03', allrad: '03', kardanwelle: '03',
  getriebe: '05', kupplung: '05', automatik: '05',
  lenkung: '06', spurstange: '06', spurstangenkopf: '06', servolenkung: '06',
  klima: '07', klimaanlage: '07', heizung: '07', waermetauscher: '07',
  airbag: '08', gurtstraffer: '08', sicherheitsgurt: '08',
  karosserie: '09', tuer: '09', scheinwerfer: '09', beleuchtung: '09', fensterheber: '09',
  can: '10', multiplex: '10'
};

function buildSearchIndex() {
  const t0 = Date.now();
  const df = new Map();
  docs = catalog.map((e, i) => {
    const numMatch = e.f.match(/(\d+)\.pdf$/);
    const kwTokens = (e.kw || '').split(' ').filter(Boolean);
    for (const t of new Set(kwTokens)) df.set(t, (df.get(t) || 0) + 1);
    return {
      i,
      f: e.f,
      sec: e.sec || '',
      t: e.t || '',
      grp: e.grp || '',
      type: e.type || '',
      num: numMatch ? parseInt(numMatch[1], 10) : -1,
      fNorm: pad(normalize(e.f)),
      sNorm: pad(normalize(e.sec)),
      tNorm: pad(normalize(e.t)),
      gNorm: pad(normalize(e.grp)),
      kNorm: pad(normalize(e.kw))
    };
  });
  buildSearchIndex.df = df;
  buildSearchIndex.vocab = [...df.keys()].filter(t => t.length >= 5);
  console.log(`Suchindex aufgebaut: ${docs.length} Dokumente, ${df.size} Begriffe, ${Date.now() - t0} ms.`);
}

function idfOf(term, N) {
  const df = buildSearchIndex.df;
  const d = df.get(term);
  if (!d) return 6;
  return Math.log(1 + N / (1 + d));
}

/** Levenshtein-Distanz <= 1 (schnelle Variante). */
function withinOneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  if (i < a.length || j < b.length) edits++;
  return edits <= 1;
}

/** Baut aus der Anfrage Suchbegriffe (Phrasen) und Einzelwörter. */
function expandQuery(rawQuery) {
  const q = normalize(rawQuery).trim();
  const tokens = q.split(/[^a-z0-9\-]+/).filter(t => t.length >= 2);
  const concepts = [];
  const seen = new Set();

  const pushConcept = (words) => {
    const key = words.join(' ');
    if (!key || seen.has(key)) return;
    seen.add(key);
    concepts.push(words);
  };

  for (const tok of tokens) {
    if (/^\d+$/.test(tok) || tok.includes('-')) { pushConcept([tok]); continue; }
    const syn = SYN_NORM.get(tok);
    if (syn) {
      for (const phrase of syn) pushConcept(phrase.split(' '));
    }
    pushConcept([tok]);
  }
  return { q, tokens, concepts };
}

// ---------------------------------------------------------------------------
// Fehlercodes (DTC) – Index Code → Dokumente (v1.9.0)
// ---------------------------------------------------------------------------

const DTC_RE = /\b([PBCU]\d{4})(?::(\d{2}))?\b/gi;

/** Alle Fehlercodes eines Dokuments (Titel und Keywords). */
function dtcCodesOf(entry) {
  const hay = `${entry.t || ''} ${entry.kw || ''}`;
  const codes = new Set();
  let m;
  DTC_RE.lastIndex = 0;
  while ((m = DTC_RE.exec(hay)) !== null) codes.add(m[1].toUpperCase());
  return [...codes];
}

let dtcCache = null;

/** Baut einmalig die Tabelle Code → Dokumente; wird beim Katalog-Laden verworfen. */
function buildDtcIndex() {
  if (dtcCache) return dtcCache;
  const map = new Map();
  for (const e of catalog) {
    for (const code of dtcCodesOf(e)) {
      if (!map.has(code)) map.set(code, []);
      map.get(code).push(e);
    }
  }
  dtcCache = map;
  return map;
}

/** Kurzinfo je Code für /api/dtc: Anzahl und häufigste Baugruppe. */
function dtcOverview() {
  const map = buildDtcIndex();
  const out = [];
  for (const [code, entries] of map) {
    const groups = new Map();
    for (const e of entries) groups.set(e.grp, (groups.get(e.grp) || 0) + 1);
    let system = '';
    let best = 0;
    for (const [g, n] of groups) if (n > best) { best = n; system = g; }
    out.push({ code, count: entries.length, system });
  }
  out.sort((a, b) => a.code.localeCompare(b.code));
  return out;
}

/**
 * Suche nach einem Fehlercode: Diagnoseblätter zuerst, danach Tabellen und
 * Technical-Guide-Seiten. Titel mit Code > Diagnoseabschnitt -02 > Werkstatt-
 * handbuch > "INSPECTION".
 */
function searchDtc(code, limit, offset) {
  const map = buildDtcIndex();
  const entries = map.get(code) || [];
  const take = Math.max(1, Math.min(200, limit || 60));
  const skip = Math.max(0, offset || 0);
  const t0 = process.hrtime.bigint();

  const hits = entries.map((e) => {
    const title = e.t || '';
    let score = 20;
    if (new RegExp(`\\b${code}\\b`, 'i').test(title)) score += 120;
    if (/DTC/i.test(title)) score += 30;
    if (/^\d{2}-02/.test(e.sec || '')) score += 40;
    if (e.type === 'workshop') score += 25;
    if (/INSPECTION/i.test(title)) score += 15;

    const kw = e.kw || '';
    const pos = kw.toUpperCase().indexOf(code);
    const snippet = pos >= 0
      ? (pos > 40 ? '…' : '') + kw.slice(Math.max(0, pos - 40), pos + code.length + 50).trim() + '…'
      : '';

    return { e, score, snippet };
  });

  hits.sort((a, b) => b.score - a.score || String(a.e.f).localeCompare(String(b.e.f)));
  const results = hits.slice(skip, skip + take).map((h) => ({
    f: h.e.f,
    sec: h.e.sec || '',
    t: h.e.t || '',
    grp: h.e.grp || '',
    type: h.e.type || '',
    score: h.score,
    snippet: h.snippet
  }));

  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return {
    query: code.toLowerCase(),
    terms: [code],
    results,
    total: hits.length,
    offset: skip,
    limit: take,
    took: Math.round(ms * 10) / 10,
    dtc: { code, total: hits.length }
  };
}

function search(rawQuery, limit, offset) {
  if (!docs) buildSearchIndex();
  const { q, tokens, concepts } = expandQuery(rawQuery || '');
  if (!q) return { query: '', terms: [], results: [], total: 0, took: 0, offset: 0, limit };

  // Fehlercode? Dann direkt die Diagnoseblätter liefern.
  const dtcMatch = q.replace(/\s+/g, '').match(/^([pbcu]\d{4})(?::(\d{2}))?$/);
  if (dtcMatch) return searchDtc(dtcMatch[1].toUpperCase(), limit, offset);

  const N = docs.length;
  const take = Math.max(1, Math.min(200, limit || 60));
  const skip = Math.max(0, offset || 0);
  const t0 = process.hrtime.bigint();

  const isSectionQuery = /^\d{2}-\d{2}[a-z]?(-\d+)?$/.test(q);
  const isNumberQuery = /^\d{1,4}$/.test(q);

  const hits = [];
  for (const d of docs) {
    let score = 0;
    let snippet = '';
    let matched = false;

    if (isSectionQuery) {
      const secOfDoc = normalize(d.sec);
      if (secOfDoc && secOfDoc.startsWith(q)) { score += 400; matched = true; }
      else {
        const prefix = q.split('-').slice(0, 2).join('-');
        if (secOfDoc && secOfDoc.startsWith(prefix)) { score += 120; matched = true; }
      }
    }
    if (isNumberQuery && d.num === parseInt(q, 10)) { score += 400; matched = true; }

    for (const words of concepts) {
      const phrase = words.join(' ');
      const padded = pad(phrase);
      const idf = idfOf(words[0], N);

      if (d.tNorm.includes(padded)) { score += 60 + 8 * idf; matched = true; }
      if (d.sNorm.includes(padded)) { score += 80; matched = true; }
      if (d.kNorm.includes(padded)) {
        score += 6 * idf;
        matched = true;
        if (!snippet) {
          const idx = d.kNorm.indexOf(padded);
          const start = Math.max(0, idx - 50);
          const end = Math.min(d.kNorm.length, idx + padded.length + 60);
          snippet = (start > 0 ? '…' : '') + d.kNorm.slice(start, end).trim() + (end < d.kNorm.length ? '…' : '');
        }
      }
      if (d.gNorm.includes(padded)) { score += 5; matched = true; }
      if (d.fNorm.includes(padded)) { score += 40; matched = true; }
    }

    const hint = GROUP_HINTS[tokens[0]];
    // Baugruppe vor Treffer aus anderen Dokumentfamilien: bei "Klima" soll das
    // HVAC-Kapitel führen, nicht eine Technical-Guide-Seite mit passendem Titel.
    if (matched && hint && d.grp.startsWith(hint)) score += 65;

    if (matched && score > 0) {
      if (d.type === 'workshop') score += 10;
      hits.push({ d, score, snippet });
    }
  }

  // Tippfehler-Fallback: nur wenn nichts gefunden wurde
  let fuzzyUsed = false;
  if (hits.length === 0 && tokens.length > 0) {
    const vocab = buildSearchIndex.vocab || [];
    const fuzzies = new Set();
    for (const tok of tokens) {
      if (tok.length < 5) continue;
      let found = 0;
      for (const v of vocab) {
        if (found >= 2) break;
        if (withinOneEdit(tok, v)) { fuzzies.add(v); found++; }
      }
    }
    if (fuzzies.size > 0) {
      fuzzyUsed = true;
      for (const d of docs) {
        let score = 0, snippet = '', matched = false;
        for (const v of fuzzies) {
          if (d.tNorm.includes(pad(v))) { score += 40; matched = true; }
          if (d.kNorm.includes(pad(v))) { score += 15; matched = true; if (!snippet) snippet = v; }
        }
        if (matched) hits.push({ d, score, snippet });
      }
    }
  }

  hits.sort((a, b) => b.score - a.score || (a.d.num - b.d.num) || a.d.f.localeCompare(b.d.f));

  const results = hits.slice(skip, skip + take).map(h => ({
    f: h.d.f,
    sec: h.d.sec,
    t: h.d.t,
    grp: h.d.grp,
    type: h.d.type,
    score: Math.round(h.score),
    snippet: h.snippet
  }));

  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const terms = [...new Set(concepts.flat())];
  return {
    query: q,
    terms,
    results,
    total: hits.length,
    offset: skip,
    limit: take,
    fuzzy: fuzzyUsed,
    took: Math.round(ms * 10) / 10
  };
}

// ---------------------------------------------------------------------------
// PDF-Links
// ---------------------------------------------------------------------------

const linkCache = new Map();

function extractPdfLinks(fileName) {
  if (linkCache.has(fileName)) return linkCache.get(fileName);

  const filePath = safeJoin(MANUAL_ROOT, fileName);
  if (!filePath || !fs.existsSync(filePath)) {
    return { mediaBox: [0, 0, 595.28, 841.89], links: [], meta: { sec: '', title: '' }, rotation: 0 };
  }

  const buf = fs.readFileSync(filePath);
  const str = buf.toString('latin1');

  const objs = {};
  const objRegex = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
  let m;
  while ((m = objRegex.exec(str)) !== null) objs[m[1] + ' ' + m[2] + ' R'] = m[3];

  let mediaBox = [0, 0, 595.276, 841.89];
  const mbMatch = str.match(/\/MediaBox\s*\[\s*([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s*\]/);
  if (mbMatch) mediaBox = [parseFloat(mbMatch[1]), parseFloat(mbMatch[2]), parseFloat(mbMatch[3]), parseFloat(mbMatch[4])];

  let rotation = 0;
  const rotMatch = str.match(/\/Rotate\s+(-?\d+)/);
  if (rotMatch) rotation = ((parseInt(rotMatch[1], 10) % 360) + 360) % 360;

  const linkRegex = /<<[\s\S]*?\/Subtype\s*\/Link[\s\S]*?>>/g;
  const links = [];
  while ((m = linkRegex.exec(str)) !== null) {
    const annot = m[0];
    const rectMatch = annot.match(/\/Rect\s*\[\s*([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s*\]/);
    if (!rectMatch) continue;
    const rect = [parseFloat(rectMatch[1]), parseFloat(rectMatch[2]), parseFloat(rectMatch[3]), parseFloat(rectMatch[4])];

    let target = null;
    const aRefMatch = annot.match(/\/A\s+(\d+\s+\d+\s+R)/);
    let actionStr = '';
    if (aRefMatch && objs[aRefMatch[1]]) actionStr = objs[aRefMatch[1]];
    else {
      const aInline = annot.match(/\/A\s*<<([\s\S]*?)>>/);
      if (aInline) actionStr = aInline[1];
    }

    const fileDirect = actionStr.match(/\/F\s*\(([^)]+\.pdf)\)/i);
    if (fileDirect) target = fileDirect[1];
    else {
      const fRefMatch = actionStr.match(/\/F\s+(\d+\s+\d+\s+R)/);
      if (fRefMatch && objs[fRefMatch[1]]) {
        const fName = objs[fRefMatch[1]].match(/\/F\s*\(([^)]+\.pdf)\)/i);
        if (fName) target = fName[1];
      }
    }

    if (target) {
      const catEntry = byFile.get(target);
      links.push({
        rect,
        target,
        title: catEntry ? (catEntry.t || catEntry.sec || target) : target
      });
    }
  }

  const meta = byFile.get(fileName) || { sec: '', t: '' };
  const result = {
    mediaBox,
    rotation,
    links,
    meta: { sec: meta.sec || '', title: meta.t || '' }
  };
  linkCache.set(fileName, result);
  return result;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
}

function handleRequest(req, res) {
  const started = process.hrtime.bigint();
  const parsedUrl = new URL(req.url, `http://${req.headers.host || ('localhost:' + CURRENT_PORT)}`);
  const pathname = parsedUrl.pathname;

  if (REQUEST_LOG) {
    res.on('finish', () => {
      const ms = Math.round(Number(process.hrtime.bigint() - started) / 1e6);
      const interesting = pathname.startsWith('/api/') || pathname.startsWith('/pdf/') || res.statusCode >= 400;
      if (!interesting) return;
      let url = req.url;
      try { url = decodeURIComponent(req.url); } catch (e) { /* roh lassen */ }
      console.log(`${req.method} ${url} ${res.statusCode} ${ms} ms`);
    });
  }

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { send(res, 405, 'Method Not Allowed'); return; }

  // Startseite
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': MIME['.html'], 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(path.join(PUBLIC_DIR, 'index.html')).pipe(res);
    return;
  }

  if (pathname === '/favicon.ico' || pathname === '/favicon.png') {
    const icon = path.join(PUBLIC_DIR, 'favicon.png');
    if (fs.existsSync(icon)) {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
      fs.createReadStream(icon).pipe(res);
      return;
    }
    res.writeHead(204);
    res.end();
    return;
  }

  // Statische Dateien
  if (pathname.startsWith('/vendor/') || pathname.startsWith('/public/')) {
    const rel = pathname.startsWith('/vendor/')
      ? path.join('vendor', pathname.slice('/vendor/'.length))
      : pathname.slice('/public/'.length);
    const target = safeJoin(PUBLIC_DIR, rel);
    const ext = target ? path.extname(target).toLowerCase() : '';
    if (target && MIME[ext] && fs.existsSync(target) && fs.statSync(target).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[ext], 'X-Content-Type-Options': 'nosniff' });
      fs.createReadStream(target).pipe(res);
      return;
    }
    send(res, 404, 'Not Found');
    return;
  }

  // PDF – mit Range-Unterstützung (206), damit PDF.js und Browser Teilbereiche laden können
  if (pathname.startsWith('/pdf/')) {
    const fileName = pathname.slice('/pdf/'.length);
    const filePath = safeJoin(MANUAL_ROOT, fileName);
    if (!filePath || !fs.existsSync(filePath) || path.extname(filePath).toLowerCase() !== '.pdf') {
      send(res, 404, 'File not found');
      return;
    }
    const stat = fs.statSync(filePath);
    const baseHeaders = {
      'Content-Type': 'application/pdf',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    };

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
      let start = match && match[1] ? parseInt(match[1], 10) : null;
      let end = match && match[2] ? parseInt(match[2], 10) : null;
      if (!match || (start === null && end === null)) {
        res.writeHead(416, { ...baseHeaders, 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return;
      }
      if (start === null) {
        // Suffix-Form "bytes=-500": die letzten 500 Bytes
        start = Math.max(0, stat.size - end);
        end = stat.size - 1;
      } else if (end === null || end >= stat.size) {
        end = stat.size - 1;
      }
      if (start >= stat.size || start > end) {
        res.writeHead(416, { ...baseHeaders, 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': end - start + 1
      });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, { ...baseHeaders, 'Content-Length': stat.size });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  if (pathname.startsWith('/api/links/')) {
    const fileName = pathname.slice('/api/links/'.length);
    try {
      sendJson(res, 200, extractPdfLinks(fileName));
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  if (pathname === '/api/search') {
    const q = parsedUrl.searchParams.get('q') || '';
    const limit = parseInt(parsedUrl.searchParams.get('limit'), 10) || 60;
    const offset = parseInt(parsedUrl.searchParams.get('offset'), 10) || 0;
    sendJson(res, 200, search(q, limit, offset));
    return;
  }

  if (pathname === '/api/chapters') {
    sendJson(res, 200, readJson(path.join(CONFIG_DIR, 'chapters.json'), []));
    return;
  }

  if (pathname === '/api/tree') {
    sendJson(res, 200, buildTree());
    return;
  }

  if (pathname === '/api/dtc') {
    const codes = dtcOverview();
    sendJson(res, 200, { count: codes.length, codes });
    return;
  }

  if (pathname === '/api/favorites') {
    sendJson(res, 200, readJson(path.join(CONFIG_DIR, 'packs.json'), []));
    return;
  }

  if (pathname === '/api/checklists') {
    sendJson(res, 200, readJson(path.join(CONFIG_DIR, 'checklists.json'), []));
    return;
  }

  if (pathname === '/api/status') {
    const manualOk = fs.existsSync(MANUAL_ROOT);
    const pdfCount = manualOk ? fs.readdirSync(MANUAL_ROOT).filter(f => f.toLowerCase().endsWith('.pdf')).length : 0;
    sendJson(res, 200, {
      status: 'ok',
      port: CURRENT_PORT,
      totalCatalogDocs: catalog.length,
      manualDir: MANUAL_ROOT,
      manualDirSource: MANUAL_SOURCE,
      manualDirOk: manualOk,
      pdfCount,
      docsWithoutIndex: Math.max(0, pdfCount - catalog.length),
      config: {
        chapters: readJson(path.join(CONFIG_DIR, 'chapters.json'), []).length,
        packs: readJson(path.join(CONFIG_DIR, 'packs.json'), []).length,
        checklists: readJson(path.join(CONFIG_DIR, 'checklists.json'), []).length
      }
    });
    return;
  }

  send(res, 404, 'Not Found');
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

loadCatalog();

/**
 * Startprüfung: Verzeichnis vorhanden und PDF-Anzahl plausibel.
 * false = der Server kann so nicht sinnvoll starten.
 */
function preflight() {
  console.log(`Handbuch-Verzeichnis: ${MANUAL_ROOT} (Quelle: ${MANUAL_SOURCE})`);

  if (!fs.existsSync(MANUAL_ROOT)) {
    console.error(
      '\n============================================================\n' +
      'FEHLER: Handbuch-Verzeichnis nicht gefunden\n' +
      `  ${MANUAL_ROOT}\n` +
      `  Quelle: ${MANUAL_SOURCE}\n\n` +
      'So beheben:\n' +
      '  1. PDFs nach data\\ kopieren (7.294 Dateien aus dem Handbuch-ZIP),\n' +
      '  2. MANUAL_DIR auf ein vorhandenes Verzeichnis setzen, oder\n' +
      '  3. "manualDir" in config/settings.json eintragen.\n' +
      '============================================================\n');
    return false;
  }

  const pdfCount = countPdfs(MANUAL_ROOT);
  if (catalog.length === 0) {
    console.warn('WARNUNG: Der Suchindex ist leer. Bitte "npm run index" ausführen.');
  } else if (pdfCount !== catalog.length) {
    console.warn(
      `WARNUNG: Im Verzeichnis liegen ${pdfCount} PDFs, der Index kennt ${catalog.length}.\n` +
      '         Fehlende oder überzählige Dateien liefern 404 – Index mit "npm run index" neu bauen.');
  } else {
    console.log(`Startprüfung OK: ${pdfCount} PDFs, Index deckt alle ab.`);
  }
  return true;
}

function startServer(port, maxAttempts) {
  const attempts = maxAttempts === undefined ? 10 : maxAttempts;
  const srv = http.createServer(handleRequest);

  srv.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempts > 0) {
      console.warn(`[Port ${port} belegt] Weiche auf Port ${port + 1} aus …`);
      startServer(port + 1, attempts - 1);
    } else {
      console.error('Server-Startfehler:', err);
    }
  });

  srv.once('listening', () => {
    CURRENT_PORT = port;
    console.log(`Mazda CX-5 Service Manual Viewer: http://localhost:${port}`);
    writePortFile(port);
    if (process.argv.includes('--open')) {
      require('child_process').exec(`start http://localhost:${port}`);
    }
  });

  srv.listen(port, '127.0.0.1');
  return srv;
}

if (require.main === module) {
  if (!preflight()) process.exit(1);
  startServer(START_PORT);
}

module.exports = {
  search,
  safeJoin,
  extractPdfLinks,
  loadCatalog,
  startServer,
  preflight,
  byFile,
  get catalog() { return catalog; },
  SYNONYMS
};
