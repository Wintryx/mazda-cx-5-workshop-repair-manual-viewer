/**
 * titles.js – Titel aus dem PDF-Layout statt aus dem reinen Textstrom (v1.6.0)
 *
 * Warum: Der bisherige Ansatz liest den Text ohne Position. Kopfzeile,
 * Querverweis und Überschrift landen dadurch in derselben Zeichenkette, und
 * die Heuristik rät (z. B. "BEFORE SERVICE PRECAUTION" statt
 * "FUEL INJECTOR REMOVAL/INSTALLATION").
 *
 * PDF.js liefert je Textstück `transform` (x/y) und `height`. Daraus werden
 * Zeilen gebaut, Kopf- und Fußband verworfen und die Überschrift über
 * Position, Schriftgröße und Verfahrens-Schlüsselwörter bestimmt.
 *
 * Der Browser-Build aus public/vendor läuft auch in Node, wenn das
 * Worker-Bundle vorher als `globalThis.pdfjsWorker` geladen wird.
 */

const path = require('path');

const VENDOR = path.join(__dirname, '..', 'public', 'vendor');

let pdfjs = null;

function loadPdfjs() {
  if (pdfjs) return pdfjs;
  // Worker-Bundle zuerst: sonst sucht der Fake-Worker nach ./pdf.worker.js
  if (!globalThis.pdfjsWorker) {
    globalThis.pdfjsWorker = require(path.join(VENDOR, 'pdf.worker.min.js'));
  }
  pdfjs = require(path.join(VENDOR, 'pdf.min.js'));
  return pdfjs;
}

// Kopf-/Fußband der Mazda-Seiten (A4 hoch, 842 pt): Kopfzeile bei y≈775,
// Fußzeile ab y≈814, Sektionscode unten bei y≈40.
const HEADER_Y = 762;
const FOOTER_Y = 60;

// Überschriften enden mit einem Verfahrensbegriff, optional "[Modell]" dahinter.
const TITLE_TAIL = new RegExp(
  '(' + [
    'REMOVAL\\s*\\/\\s*INSTALLATION', 'INSTALLATION', 'REMOVAL', 'INSPECTION',
    'DISASSEMBLY', 'ASSEMBLY', 'LOCATION INDEX', 'SERVICE', 'PROCEDURE',
    'SPECIFICATIONS?', 'TECHNICAL DATA', 'WARNINGS?', 'PRECAUTION',
    'DIAGNOSTIC PROCEDURE'
  ].join('|') + ')\\s*(?:NOTE|PROCEDURE)?\\s*(?:\\[[^\\]]*\\])?\\s*$',
  'i'
);

/** Fasst Textstücke zu Zeilen zusammen (Toleranz 2 pt). */
function buildLines(items) {
  const lines = [];
  for (const it of items) {
    if (typeof it.str !== 'string' || !it.str.trim()) continue;
    const y = it.transform[5];
    const x = it.transform[4];
    let line = lines.find((l) => Math.abs(l.y - y) <= 2);
    if (!line) {
      line = { y, h: 0, parts: [] };
      lines.push(line);
    }
    line.h = Math.max(line.h, it.height || 0);
    line.parts.push({ x, w: it.width || 0, s: it.str });
  }
  for (const l of lines) {
    l.parts.sort((a, b) => a.x - b.x);
    let text = '';
    let prev = null;
    for (const p of l.parts) {
      // Lücke zwischen zwei Textläufen → Leerzeichen (sonst klebt "AIR CONDITIONERi-stop" zusammen)
      if (prev && p.x - (prev.x + prev.w) > 1) text += ' ';
      text += p.s;
      prev = p;
    }
    l.text = text.replace(/\s+/g, ' ').trim();
    l.x = l.parts.length ? l.parts[0].x : 0;
    l.parts = null;
  }
  lines.sort((a, b) => b.y - a.y);
  return lines;
}

function letterRatio(text) {
  const letters = (text.match(/[A-Za-zÄÖÜäöüß]/g) || []).length;
  return text.length ? letters / text.length : 0;
}

function upperRatio(text) {
  const letters = (text.match(/[A-Za-zÄÖÜäöüß]/g) || []);
  if (!letters.length) return 0;
  const upper = letters.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  return upper / letters.length;
}

/**
 * Gemeinsame Plausibilitätsprüfung für Überschriften-Kandidaten.
 * Filtert Flowchart-Zeilen, Punktierungs-Lineale, Textfragmente und
 * unbalancierte Klammern (abgeschnittene Zeilen).
 */
function plausibleTitle(t) {
  if (!t || t.length < 8) return false;
  if (/^end of sie/i.test(t)) return false;
  if (/(^|\s)(Yes|No)(?=[A-Z\s]|$)/.test(t)) return false;       // Flowchart "Yes/No"
  if (/\.\s*\.\s*\./.test(t)) return false;                       // ". . . . ."
  if (/\.{3,}/.test(t)) return false;                             // "....."
  if (/\)\s*\.?\s*$/.test(t) && /\]\s*\)/.test(t)) return false;  // "...2.2].)"
  const openSq = (t.match(/\[/g) || []).length;
  const closeSq = (t.match(/\]/g) || []).length;
  if (openSq !== closeSq) return false;
  const openPa = (t.match(/\(/g) || []).length;
  const closePa = (t.match(/\)/g) || []).length;
  if (openPa !== closePa) return false;
  return true;
}

/** Bewertet eine Zeile als Überschrift; je höher, desto wahrscheinlicher. */
function scoreLine(line, bodyFont) {
  const t = line.text;

  if (!TITLE_TAIL.test(t)) return -99;
  if (t.length > 95) return -99;
  if (!plausibleTitle(t)) return -99;
  if (/^[0-9*•(]/.test(t)) return -99;
  if (/\d{2}-\d{2}[A-Z]?[-\s]?\d{1,3}/.test(t)) return -99;  // Sektionscode
  if (letterRatio(t) < 0.5) return -99;

  let score = 4;                                              // Verfahrensbegriff am Zeilenende

  if (line.x <= 75) score += 2;
  else if (line.x <= 110) score += 1;
  else score -= 2;                                            // eingerückt = Fließtext

  if (line.y >= 700) score += 3;
  else if (line.y >= 600) score += 1;

  if (bodyFont && line.h >= bodyFont * 1.25) score += 3;
  else if (bodyFont && line.h >= bodyFont * 1.05) score += 1;

  if (upperRatio(t) > 0.6) score += 1;
  if (t.length <= 70) score += 1;
  if (/^[a-z]/.test(t)) score -= 3;

  return score;
}

/** Mittlere Schriftgröße des Fließtexts (häufigster gerundeter height-Wert). */
function bodyFontSize(lines) {
  const counts = new Map();
  for (const l of lines) {
    if (l.y >= HEADER_Y || l.y <= FOOTER_Y) continue;
    const key = Math.round(l.h * 2) / 2;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = 0;
  let bestCount = -1;
  for (const [size, count] of counts) {
    if (count > bestCount) { best = size; bestCount = count; }
  }
  return best;
}

/**
 * Ersatz-Überschrift: die oberste Zeile im Kopfbereich, wenn kein
 * Verfahrensbegriff gefunden wurde (typisch für den Technical Guide:
 * "Operation", "AIR CONDITIONER i-stop CONTROL [MANUAL AIR CONDITIONER]").
 */
function topHeading(lines) {
  for (const l of lines) {
    if (l.y < 700 || l.y >= HEADER_Y) continue;
    if (l.x > 90) continue;
    const t = l.text;
    if (t.length > 90) continue;
    if (/[.:;,]$/.test(t)) continue;
    if (/^([0-9]{1,2}[.)]|[*•(x]\s)/.test(t)) continue;
    if (/^[a-zäöü]/.test(t)) continue;
    if (letterRatio(t) < 0.6) continue;
    if (!plausibleTitle(t)) continue;
    if (/\d{2}-\d{2}[A-Z]?[-\s]?\d{1,3}/.test(t)) continue;
    if (t.split(/\s+/).length > 12) continue;
    // Tabellenköpfe und Satzfragmente sind keine Überschriften
    if (/^(No\.|Nr\.|Item|Description|Condition|Table|Fig\.|Figure)\b/i.test(t)) continue;
    if (/^(With|Without|If|When|The|This|For|In|On|At|To|Do|Refer|See|Note|Caution|Warning|Yes|No)\b/i.test(t)) continue;
    if (l.h < 9) continue;
    return t;
  }
  return '';
}

/**
 * Liest die Überschrift einer Seite aus dem Layout.
 * @returns {Promise<string>} leer, wenn keine sichere Überschrift gefunden wurde
 */
async function layoutTitle(filePath) {
  const pdfjsLib = loadPdfjs();
  const fs = require('fs');
  const data = new Uint8Array(fs.readFileSync(filePath));

  let doc = null;
  try {
    doc = await pdfjsLib.getDocument({
      data,
      disableFontFace: true,
      isEvalSupported: false,
      useSystemFonts: false,
      verbosity: 0
    }).promise;

    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const lines = buildLines(content.items);
    if (!lines.length) return '';

    const body = bodyFontSize(lines);
    let best = null;
    for (const line of lines) {
      if (line.y >= HEADER_Y || line.y <= FOOTER_Y) continue;
      const score = scoreLine(line, body);
      if (score < 0) continue;                       // kein Überschriften-Kandidat
      if (!best || score > best.score) best = { score, line };
    }
    // Ein Verfahrensbegriff am Zeilenende ist das stärkere Signal als die
    // oberste Zeile – sonst gewinnt z. B. "Sub side" gegen "TWC INSTALLATION".
    if (best) return best.line.text;
    return topHeading(lines);
  } catch (e) {
    return '';
  } finally {
    if (doc) { try { await doc.destroy(); } catch (e) { /* egal */ } }
  }
}

module.exports = { layoutTitle, buildLines, scoreLine, bodyFontSize, HEADER_Y, FOOTER_Y };
