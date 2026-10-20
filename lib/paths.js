/**
 * paths.js – zentrale Auflösung des Handbuch-Verzeichnisses (seit v1.5.0)
 *
 * Reihenfolge:
 *   1. Umgebungsvariable MANUAL_DIR (absolut oder relativ zum Arbeitsverzeichnis)
 *   2. config/settings.json → "manualDir" (relativ zum Projektordner)
 *   3. data\ im Projektordner (Standard)
 *
 * Damit läuft ein kopierter Projektordner ohne Codeänderung; C:\Temp wird
 * nicht mehr benötigt. server.js, build_index.js und tools/validate.js
 * benutzen ausschließlich diesen Resolver, damit es nur eine Wahrheit gibt.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SETTINGS_FILE = path.join(ROOT, 'config', 'settings.json');
const DEFAULT_DIR = path.join(ROOT, 'data');

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch (e) {
    if (fs.existsSync(SETTINGS_FILE)) {
      console.warn(`config/settings.json nicht lesbar (${e.message}) – es gilt der Standard data\\.`);
    }
    return {};
  }
}

/** Liefert { dir, source } – dir ist immer ein absoluter Pfad. */
function resolveManualDir() {
  const env = String(process.env.MANUAL_DIR || '').trim();
  if (env) return { dir: path.resolve(env), source: 'MANUAL_DIR' };

  const settings = readSettings();
  const configured = typeof settings.manualDir === 'string' ? settings.manualDir.trim() : '';
  if (configured) return { dir: path.resolve(ROOT, configured), source: 'config/settings.json' };

  return { dir: DEFAULT_DIR, source: 'data/' };
}

const resolved = resolveManualDir();
const MANUAL_DIR = resolved.dir;
const MANUAL_SOURCE = resolved.source;

/** Zählt die PDFs im Handbuchverzeichnis; 0, wenn es fehlt oder unlesbar ist. */
function countPdfs(dir) {
  try {
    return fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.pdf')).length;
  } catch (e) {
    return 0;
  }
}

module.exports = { ROOT, MANUAL_DIR, MANUAL_SOURCE, SETTINGS_FILE, DEFAULT_DIR, resolveManualDir, countPdfs };
