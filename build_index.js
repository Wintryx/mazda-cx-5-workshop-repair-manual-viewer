// build_index.js – erzeugt public/search_index.json
//
// Aufruf:  node build_index.js   (oder: npm run index)
// Pfad:    MANUAL_DIR → config/settings.json → data\   (siehe lib/paths.js)
//
// v1.4.0:
//  - Sektionscodes normalisiert (0x85/0x96/0x97 -> '-'), dadurch keine kaputten Codes mehr
//  - Titel: Kandidaten werden relativ zum Sektionscode gesucht (dort steht die echte Überschrift)
//  - Dateityp anhand des Namens, Gruppe anhand der Familie (Tech Guide/Bodyshop bleiben zusammen)
//  - Gruppen 10/11/12 (Multiplex, i-stop, Personalisierung) korrekt zugeordnet
//  - Build-Report am Ende (Abdeckung, Dauer, Größe)

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const { MANUAL_DIR, MANUAL_SOURCE } = require('./lib/paths');
const OUT_FILE = path.join(__dirname, 'public', 'search_index.json');

const GROUPS = {
  '00': '00 Allgemein / Wartung',
  '01': '01 Motor (Engine)',
  '02': '02 Fahrwerk (Suspension)',
  '03': '03 Antriebsstrang (Driveline / Axle)',
  '04': '04 Bremsen (Brakes)',
  '05': '05 Getriebe (Transmission)',
  '06': '06 Lenkung (Steering)',
  '07': '07 Klima & Heizung (HVAC)',
  '08': '08 Airbag & Gurte (Restraints)',
  '09': '09 Karosserie & Elektrik (Body & Electrics)',
  '10': '10 Multiplex / CAN (Kommunikation)',
  '11': '11 i-stop & Start-Stopp',
  '12': '12 Personalisierung'
};

const STRONG_KEYWORDS = /(REMOVAL\/INSTALLATION|INSTALLATION|REMOVAL|INSPECTION|DISASSEMBLY|ASSEMBLY|LOCATION INDEX|PRECAUTION|DIAGNOSTIC PROCEDURE|PROCEDURE|SPECIFICATION|TECHNICAL DATA|DTC INSPECTION)/i;
// Schwache Marker liefern v. a. im Technical Guide Titel ("… operation", "… system")
const WEAK_KEYWORDS = /(SYSTEM|OVERVIEW|FUNCTION|OPERATION|NOTE|OUTLINE)/i;
const ANY_KEYWORD = new RegExp(`${STRONG_KEYWORDS.source}|${WEAK_KEYWORDS.source}`, 'i');

console.log('Generating Mazda CX-5 search index …');
const startTime = Date.now();

if (!fs.existsSync(MANUAL_DIR)) {
  console.error(`FEHLER: Handbuch-Verzeichnis nicht gefunden:\n  ${MANUAL_DIR}\n  Quelle: ${MANUAL_SOURCE}\n\n` +
    'Bitte die PDFs nach data\\ kopieren oder den Pfad über MANUAL_DIR bzw.\n' +
    '"manualDir" in config/settings.json setzen.');
  process.exit(1);
}

const files = fs.readdirSync(MANUAL_DIR).filter(f => f.toLowerCase().endsWith('.pdf')).sort();
console.log(`Scanning ${files.length} PDF files in ${MANUAL_DIR}`);

/** Liest die Textoperatoren aus allen (deflate-)Streams einer Seite. */
function extractText(buf) {
  const str = buf.toString('latin1');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  let full = '';
  while ((match = streamRegex.exec(str)) !== null) {
    const raw = buf.subarray(match.index + match[0].indexOf('\n') + 1, match.index + match[0].lastIndexOf('endstream'));
    let dec;
    try {
      dec = zlib.inflateSync(raw).toString('latin1');
    } catch (e) {
      continue; // Bildstream, bereits dekomprimiert oder kein zlib
    }
    const blocks = dec.match(/BT[\s\S]*?ET/g) || [];
    for (const b of blocks) {
      const tokenRegex = /\((.*?)\)\s*Tj|\[(.*?)\]\s*TJ/g;
      let tm;
      while ((tm = tokenRegex.exec(b)) !== null) {
        if (tm[1] !== undefined) full += ' ' + tm[1];
        else if (tm[2] !== undefined) full += ' ' + [...tm[2].matchAll(/\((.*?)\)/g)].map(x => x[1]).join('');
      }
    }
  }
  // Steuerzeichen aus PDF-WinAnsi (z. B. 0x85 = Gedankenstrich) vereinheitlichen
  return full
    .replace(/[\u0080-\u009f\u00ad]/g, '-')
    .replace(/\\[0-7]{3}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Abschnittscode wie 01-14B-35 inkl. Position im Text. */
function findSection(text) {
  // Häufigster Sektionscode gewinnt (Kopf- und Fußzeile wiederholen ihn),
  // Querverweise im Text kommen meist nur einmal vor.
  const re = /\b(\d{2})-(\d{2})([A-Z]?)\s*-?\s*(\d{1,3})\b/g;
  const counts = new Map();
  let best = null;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (Number(m[1]) > 20) continue;
    const sec = `${m[1]}-${m[2]}${m[3]}-${m[4]}`;
    const count = (counts.get(sec) || 0) + 1;
    counts.set(sec, count);
    if (!best || count > best.count) {
      best = { sec, count, index: m.index, end: m.index + m[0].length };
    }
  }
  return best || { sec: '', index: -1, end: -1 };
}

function cleanTitle(raw) {
  let s = raw.replace(/\s+/g, ' ').trim();
  s = s.replace(/^[^A-Za-z"]{1,6}/, '');                        // "2] ", "2052 " …
  s = s.replace(/^[A-Z]{1,2}-?\d{1,2}\s+/, '');                 // "A-2 " …
  s = s.replace(/\b(id0\d{5,}|ac5[a-z0-9]{6,})\b/gi, '');       // Mazda-IDs
  s = s.replace(/\b\d{2}-\d{2}[A-Z]?\s*-?\s*\d{1,3}\b/g, ' ');  // Sektionscodes mittendrin
  s = s.replace(/^((?:\S+\s+){1,3})\1/i, '$1');                 // "TORQUE BOX TORQUE BOX …"
  s = s.replace(/\s*(\.\s*){2,}.*$/, '');                       // Punktierungs-Lineale
  s = s.replace(/[\s.]+$/, '');
  s = s.replace(/\s+\d{1,3}(\s+\d{1,3})*$/, '');                // Seitenzahlen am Ende
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > 110) s = s.slice(0, 110).replace(/\s+\S*$/, '');
  if (!/[A-Za-z]{3}/.test(s)) return '';
  return s;
}

function scoreTitle(s) {
  let score = 0;
  if (/^[A-Z]/.test(s)) score += 3;
  if (/^[a-z]/.test(s)) score -= 4;             // "nal malfunction …" -> Tabellenzelle
  const strongEnd = new RegExp(`(?:${STRONG_KEYWORDS.source})\\s*(\\[[^\\]]*\\])?$`, 'i');
  const anyEnd = new RegExp(`(?:${ANY_KEYWORD.source})\\s*(\\[[^\\]]*\\])?$`, 'i');
  if (strongEnd.test(s)) score += 6;
  else if (anyEnd.test(s)) score += 3;
  if (/[0-9]{2}-[0-9]{2}/.test(s)) score -= 3;  // eingebetteter Sektionscode -> Kopfzeile
  if (/\b\d{2,3}\b/.test(s)) score -= 1;
  if (/\b(SKYACTIV|MAZDA|DIESEL|GASOLINE)\b/i.test(s)) score += 1;
  if (/\[/.test(s)) score += 1;
  if (s.length > 95) score -= 2;
  if (/^(SEE|IF|WHEN|THE|AND|OR|NOTE)\b/i.test(s)) score -= 3;
  if (/^(BEFORE|AFTER) SERVICE\\b/i.test(s)) score -= 4;
  return score;
}

function collectCandidates(text, keywordRe) {
  const out = [];
  const re = new RegExp(
    `[A-Z0-9][A-Z0-9 \\/\\-\\.\\[\\]\\(\\)]{4,100}(?:${keywordRe.source})[A-Z0-9 \\/\\-\\.\\[\\]\\(\\)]{0,35}`,
    'gi'
  );
  let m;
  while ((m = re.exec(text)) !== null) {
    const t = cleanTitle(m[0]);
    if (t) out.push(t);
    if (m[0].length === 0) re.lastIndex++;
    if (out.length > 16) break;
  }
  return out;
}

function bestOf(candidates, min) {
  if (!candidates || candidates.length === 0) return '';
  let best = '';
  let bestScore = -999;
  for (const c of candidates) {
    const s = scoreTitle(c);
    if (s > bestScore) { best = c; bestScore = s; }
  }
  return bestScore >= min ? best : '';
}

function extractTitle(text, sectionEnd) {
  // Kandidaten direkt hinter dem Sektionscode zuerst, dann der gesamte Seitentext.
  const nearText = sectionEnd >= 0 ? text.slice(sectionEnd, sectionEnd + 320) : '';
  const strong = bestOf(
    collectCandidates(nearText, STRONG_KEYWORDS).concat(collectCandidates(text, STRONG_KEYWORDS)), 2);
  if (strong) return strong;
  const weak = bestOf(
    collectCandidates(nearText, WEAK_KEYWORDS).concat(collectCandidates(text, WEAK_KEYWORDS)), 4);
  return weak;
}

function extractKeywords(text) {
  const tokens = text.toLowerCase().match(/[a-z0-9][a-z0-9\-]{2,24}/g) || [];
  const seen = new Set();
  const out = [];
  let chars = 0;
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    chars += t.length + 1;
    if (chars > 1200) break;
  }
  return out.join(' ');
}

function detectType(file) {
  if (file === 'front_page.pdf') return 'root';
  if (file.startsWith('mazda_cx5_electrical_wiring_diagrams')) return 'wiring';
  if (file.startsWith('mazda_cx5_bodyshop_manual')) return 'bodyshop';
  if (file.startsWith('mazda_cx5_technical_guide_manual')) return 'technical';
  // alles andere (workshop_manual* und electrical_wiring_manual*) ist Werkstatthandbuch
  return 'workshop';
}

function resolveGroup(type, sec) {
  if (type === 'wiring') return 'Elektrische Schaltpläne';
  if (type === 'bodyshop') return 'Karosserie-Handbuch';
  if (type === 'technical') return 'Technischer Leitfaden';
  if (type === 'root') return 'Allgemein';
  const m = sec.match(/^(\d{2})-/);
  return (m && GROUPS[m[1]]) || 'Allgemein';
}

function build() {
  const catalog = [];
  let noText = 0;
  let noTitle = 0;
  let badSec = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(MANUAL_DIR, file);
    try {
      const buf = fs.readFileSync(filePath);
      const text = extractText(buf);
      const section = findSection(text);
      const title = extractTitle(text, section.end);
      const kw = extractKeywords(text);
      const type = detectType(file);

      if (!text) noText++;
      if (!title) noTitle++;
      if (section.sec && !/^\d{2}-\d{2}[A-Z]?-\d+$/.test(section.sec)) badSec++;

      catalog.push({ f: file, sec: section.sec, t: title, grp: resolveGroup(type, section.sec), type, kw });
    } catch (e) {
      catalog.push({ f: file, sec: '', t: '', grp: 'Allgemein', type: detectType(file), kw: '' });
    }

    if ((i + 1) % 1000 === 0 || i === files.length - 1) {
      console.log(`Progress: ${i + 1} / ${files.length} files (${Math.round(((i + 1) / files.length) * 100)}%)`);
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(catalog));
  const sizeMb = (fs.statSync(OUT_FILE).size / (1024 * 1024)).toFixed(2);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  const byGroup = {};
  const byType = {};
  for (const e of catalog) {
    byGroup[e.grp] = (byGroup[e.grp] || 0) + 1;
    byType[e.type] = (byType[e.type] || 0) + 1;
  }
  const secCount = catalog.filter(e => e.sec).length;
  const kwCount = catalog.filter(e => e.kw).length;

  console.log('\n================ BUILD REPORT ================');
  console.log(`Dokumente          : ${catalog.length}`);
  console.log(`Dauer              : ${duration} s`);
  console.log(`Index-Größe        : ${sizeMb} MB`);
  console.log(`Sektionscode       : ${secCount} (${(secCount / catalog.length * 100).toFixed(1)} %), ungültig: ${badSec}`);
  console.log(`Titel              : ${catalog.length - noTitle} (${((catalog.length - noTitle) / catalog.length * 100).toFixed(1)} %)`);
  console.log(`Keywords           : ${kwCount} (${(kwCount / catalog.length * 100).toFixed(1)} %)`);
  console.log(`Ohne Text (Bild)   : ${noText}`);
  console.log('\nGruppen:');
  Object.entries(byGroup).sort().forEach(([g, n]) => console.log(`  ${String(n).padStart(5)}  ${g}`));
  console.log('\nDateitypen:');
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`  ${String(n).padStart(5)}  ${t}`));
  console.log('=============================================');
  console.log(`Saved: ${OUT_FILE}`);
}

if (require.main === module) build();

module.exports = { extractText, findSection, extractTitle, extractKeywords, detectType, resolveGroup, MANUAL_DIR };
