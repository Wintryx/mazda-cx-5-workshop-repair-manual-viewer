/**
 * validate.js – prüft Index und kuratierte Konfiguration gegeneinander.
 *
 * Aufruf: node tools/validate.js
 * Exit-Code 1 bei Fehlern (geeignet für npm test / CI).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { MANUAL_DIR, MANUAL_SOURCE } = require('../lib/paths');
const INDEX = path.join(ROOT, 'public', 'search_index.json');
const CONFIG = path.join(ROOT, 'config');

const errors = [];
const warnings = [];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    errors.push(`${path.basename(file)}: nicht lesbar (${e.message})`);
    return null;
  }
}

const catalog = readJson(INDEX);
const chapters = readJson(path.join(CONFIG, 'chapters.json')) || [];
const packs = readJson(path.join(CONFIG, 'packs.json')) || [];
const checklists = readJson(path.join(CONFIG, 'checklists.json')) || [];

if (!catalog) {
  console.error('Abbruch: Suchindex fehlt. Bitte "node build_index.js" ausführen.');
  process.exit(1);
}

const byFile = new Map(catalog.map(e => [e.f, e]));

// 1. Index-Integrität
const secRe = /^\d{2}-\d{2}[A-Z]?-\d+$/;
let badSec = 0;
for (const e of catalog) {
  if (e.sec && !secRe.test(e.sec)) { badSec++; if (badSec <= 5) errors.push(`Ungültiger Sektionscode: ${e.f} -> "${e.sec}"`); }
}
if (badSec > 5) errors.push(`… und ${badSec - 5} weitere ungültige Sektionscodes`);

// 2. Anzahl PDFs vs. Index
if (fs.existsSync(MANUAL_DIR)) {
  const pdfs = fs.readdirSync(MANUAL_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  if (pdfs.length !== catalog.length) {
    errors.push(`Index enthält ${catalog.length} Dokumente, im Verzeichnis liegen ${pdfs.length} PDFs`);
  }
  const missingOnDisk = catalog.filter(e => !fs.existsSync(path.join(MANUAL_DIR, e.f)));
  if (missingOnDisk.length) errors.push(`${missingOnDisk.length} Dokumente aus dem Index fehlen auf der Platte (z. B. ${missingOnDisk[0].f})`);
} else {
  warnings.push(`Handbuch-Verzeichnis nicht gefunden: ${MANUAL_DIR} (Plattenprüfung übersprungen)`);
}

// 3. Kapitel
let chapterRefs = 0;
for (const c of chapters) {
  const refs = [{ file: c.startFile, label: `Kapitel "${c.id}"` }];
  for (const s of (c.subsections || [])) refs.push({ file: s.file, label: `Kapitel "${c.id}" / ${s.title}` });
  for (const r of refs) {
    chapterRefs++;
    if (!byFile.has(r.file)) errors.push(`${r.label}: Datei nicht im Index (${r.file})`);
    if (!fs.existsSync(path.join(MANUAL_DIR, r.file))) errors.push(`${r.label}: Datei fehlt auf der Platte (${r.file})`);
  }
}

// 4. Packs: Datei existiert und Sektion passt
let packRefs = 0;
const seen = new Set();
for (const p of packs) {
  if (!Array.isArray(p.items) || p.items.length === 0) errors.push(`Pack "${p.category}" ist leer`);
  for (const it of p.items) {
    packRefs++;
    const e = byFile.get(it.file);
    if (!e) { errors.push(`Pack "${p.category}": Datei nicht im Index (${it.file})`); continue; }
    if (!fs.existsSync(path.join(MANUAL_DIR, it.file))) errors.push(`Pack "${p.category}": Datei fehlt (${it.file})`);
    if (it.sec && e.sec !== it.sec) errors.push(`Pack "${p.category}": Sektion ${it.sec} ≠ Index ${e.sec} (${it.file})`);
    const key = `${p.category}|${it.file}`;
    if (seen.has(key)) warnings.push(`Pack "${p.category}": doppelter Eintrag ${it.file}`);
    seen.add(key);
  }
}

// 5. Checklisten
let checkRefs = 0;
for (const c of checklists) {
  if (!Array.isArray(c.steps) || c.steps.length === 0) errors.push(`Checkliste "${c.id}" hat keine Schritte`);
  for (const s of c.steps) {
    checkRefs++;
    if (!byFile.has(s.file)) errors.push(`Checkliste "${c.id}": Datei nicht im Index (${s.file})`);
    else if (!fs.existsSync(path.join(MANUAL_DIR, s.file))) errors.push(`Checkliste "${c.id}": Datei fehlt (${s.file})`);
  }
}

// 6. Abdeckungsstatistik
const withTitle = catalog.filter(e => e.t).length;
const withSec = catalog.filter(e => e.sec).length;
const withKw = catalog.filter(e => e.kw).length;

console.log('================ VALIDIERUNG ================');
console.log(`Handbuch-Verzeichnis: ${MANUAL_DIR} (Quelle: ${MANUAL_SOURCE})`);
console.log(`Dokumente           : ${catalog.length}`);
console.log(`Sektionscode gültig : ${withSec - badSec} / ${withSec} (${badSec} ungültig)`);
console.log(`Titel               : ${withTitle} (${(withTitle / catalog.length * 100).toFixed(1)} %)`);
console.log(`Keywords            : ${withKw} (${(withKw / catalog.length * 100).toFixed(1)} %)`);
console.log(`Kapitel-Referenzen  : ${chapterRefs}`);
console.log(`Pack-Referenzen     : ${packRefs}`);
console.log(`Checklisten-Schritte: ${checkRefs}`);
if (warnings.length) {
  console.log(`\nHinweise (${warnings.length}):`);
  warnings.slice(0, 10).forEach(w => console.log(`  ⚠ ${w}`));
}
if (errors.length) {
  console.log(`\nFEHLER (${errors.length}):`);
  errors.slice(0, 25).forEach(e => console.log(`  ✗ ${e}`));
  console.log('\nErgebnis: FEHLGESCHLAGEN');
  process.exit(1);
}
console.log('\nErgebnis: OK – alle Verweise lösen auf, alle Sektionen sind gültig.');
