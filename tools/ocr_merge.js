/**
 * ocr_merge.js – führt die OCR-Ergebnisse zu config/ocr_text.json zusammen.
 *
 * Aufruf: node tools/ocr_merge.js [results.json] [config/ocr_text.json]
 *
 * Die Datei ist bewusst versioniert: build_index.js liest sie beim Aufbau des
 * Index und braucht für einen Rebuild keine erneute OCR. Kopf- und Fußzeilen
 * werden entfernt, aus der ersten Zeile wird nach Möglichkeit der Seitentitel
 * abgeleitet (die Zeichnungstitel stehen dort vor der ersten Beschriftung).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const resultsFile = process.argv[2] || path.join(require('os').tmpdir(), 'mazda-ocr', 'results.json');
const outFile = process.argv[3] || path.join(ROOT, 'config', 'ocr_text.json');

const BOILER = [
  /BACK TO CHAPTER INDEX/gi,
  /TO MODEL INDEX/gi,
  /MAZDA CX5 (WORKSHOP REPAIR MANUAL|ELECTRICAL WIRING DIAGRAMS|TECHNICAL GUIDE|BODYSHOP MANUAL)/gi
];

function clean(text) {
  let t = String(text || '');
  for (const re of BOILER) t = t.replace(re, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

/** "ELECTRONIC 4WD CONTROL SYSTEM [GRAY] c-14 …" -> "ELECTRONIC 4WD CONTROL SYSTEM" */
function titleFromLines(lines) {
  for (const raw of lines || []) {
    const first = clean(raw);
    if (!first || first.length < 10) continue;
    const cut = first.split(/\s+(?=\[|[A-Z]?\d{3,4}-\d{2,3}\b|[Cc]-\d{1,2}\b)/)[0].trim();
    if (cut.length < 10 || cut.length > 70) continue;
    if (!/[A-Za-z]{4}/.test(cut)) continue;
    if (!/^[A-Z0-9]/.test(cut)) continue;
    if (!/[A-Za-z]{3}/.test(cut.replace(/[^A-Za-z]/g, ' '))) continue;
    return cut;
  }
  return '';
}

const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8').replace(/^\uFEFF/, ''));
const out = {};
let chars = 0;

for (const r of results) {
  const text = clean((r.lines || []).join(' '));
  if (text.length < 25) continue;                    // reine Kopf-/Fußzeile
  out[r.file] = { t: text.slice(0, 1200), title: titleFromLines(r.lines) };
  chars += text.length;
}

const sorted = {};
for (const key of Object.keys(out).sort()) sorted[key] = out[key];

fs.writeFileSync(outFile, JSON.stringify(sorted));
const pages = Object.keys(sorted).length;
console.log(`${pages} Seiten mit OCR-Text, Ø ${Math.round(chars / Math.max(1, pages))} Zeichen`);
console.log(`Datei: ${outFile} (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`);
for (const [f, v] of Object.entries(sorted).slice(0, 3)) {
  console.log(`  ${f} | ${v.title || '(kein Titel)'} | ${v.t.slice(0, 60)}`);
}
