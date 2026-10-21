/**
 * ocr_clean.js – entfernt Streugut aus den OCR-Texten.
 *
 * Die Windows-OCR liest auf den Zeichnungsseiten auch Linien und
 * Beschriftungsfragmente und liefert dann Wörter wie "igi", "ooc" oder
 * "cord-". Für die Suche sind sie nutzlos, für den Index nur Ballast.
 *
 * Regel: ein Token bleibt, wenn es
 *   - im Wortschatz der Textseiten vorkommt (public/search_index.json),
 *   - eine Ziffer enthält (Codes wie "c-14", "0318-103"), oder
 *   - mindestens 8 Zeichen lang ist.
 * Alles andere gilt als Fragment und fliegt raus.
 *
 * Aufruf: node tools/ocr_clean.js [config/ocr_text.json]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX_FILE = path.join(ROOT, 'public', 'search_index.json');
const TOKEN = /[a-z0-9][a-z0-9-]{2,24}/g;
const WORD = /^[a-z0-9][a-z0-9-]{2,24}$/;

/** Wortschatz aus allen Seiten mit echtem Textlayer. */
function buildVocab(indexFile = INDEX_FILE, skipFiles = new Set()) {
  const vocab = new Set();
  let catalog = [];
  try {
    catalog = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  } catch (e) {
    return vocab;
  }
  for (const entry of catalog) {
    if (skipFiles.has(entry.f)) continue;
    for (const token of (entry.kw || '').match(TOKEN) || []) vocab.add(token);
  }
  return vocab;
}

/** Filtert einen OCR-Text. Ohne brauchbaren Wortschatz bleibt er unverändert. */
function filterText(text, vocab) {
  const source = String(text || '');
  if (!vocab || vocab.size < 1000) return source;
  const kept = [];
  for (const word of source.split(/\s+/)) {
    const low = word.toLowerCase();
    if (!WORD.test(low)) continue;
    if (vocab.has(low) || /\d/.test(low) || low.length >= 8) kept.push(word);
  }
  return kept.join(' ');
}

function cleanFile(file) {
  const ocr = JSON.parse(fs.readFileSync(file, 'utf8'));
  const vocab = buildVocab(INDEX_FILE, new Set(Object.keys(ocr)));

  let before = 0;
  let after = 0;
  for (const value of Object.values(ocr)) {
    const oldText = String(value.t || '');
    before += oldText.length;
    value.t = filterText(oldText, vocab);
    after += value.t.length;
  }

  const sorted = {};
  for (const key of Object.keys(ocr).sort()) sorted[key] = ocr[key];
  fs.writeFileSync(file, JSON.stringify(sorted));

  const pages = Object.keys(sorted).length;
  console.log(`${pages} Seiten bereinigt`);
  console.log(`Textmenge: ${before} → ${after} Zeichen (${(100 - (after / before) * 100).toFixed(1)} % weniger)`);
  console.log(`Wortschatz: ${vocab.size} Tokens | Datei: ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}

if (require.main === module) {
  cleanFile(process.argv[2] || path.join(ROOT, 'config', 'ocr_text.json'));
}

module.exports = { buildVocab, filterText, cleanFile };
