/**
 * smoke.test.js – schneller Funktionstest mit node:test (v1.13.0, TODO 5.5).
 *
 * Aufruf:  npm run test:smoke     (bzw. "node --test test/")
 * Startet einen eigenen Server auf Port 3560–3599, prüft die wichtigsten
 * Endpunkte und die Index-Invarianten und beendet den Server wieder.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PORT = 3560 + Math.floor(Math.random() * 40);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = path.join(ROOT, 'data');

let server;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), LOG_REQUESTS: '0', MAZDA_PORT_FILE: '0' },
    stdio: 'ignore'
  });

  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/status`);
      if (res.ok) return;
    } catch (e) {
      // noch nicht bereit
    }
    await sleep(200);
  }
  throw new Error(`Server auf Port ${PORT} nicht erreichbar`);
});

after(() => {
  if (server) server.kill();
});

test('Status meldet Katalog und Datenverzeichnis', async () => {
  const data = await (await fetch(`${BASE}/api/status`)).json();
  assert.equal(data.status, 'ok');
  assert.equal(data.totalCatalogDocs, 7294);
  assert.equal(data.manualDirOk, true);
  assert.equal(data.pdfCount, 7294);
});

test('Suche liefert Treffer', async () => {
  const data = await (await fetch(`${BASE}/api/search?q=bremse&limit=5`)).json();
  assert.ok(data.total > 20, `nur ${data.total} Treffer`);
  assert.equal(data.results.length, 5);
});

test('Fehlercode führt zum Diagnoseblatt', async () => {
  const data = await (await fetch(`${BASE}/api/search?q=P0301`)).json();
  assert.ok(data.dtc && data.dtc.total >= 3);
  assert.match(data.results[0].sec, /^\d{2}-02/);
});

test('Link-Extraktion parst eine Referenzseite', async () => {
  const data = await (await fetch(`${BASE}/api/links/mazda_cx5_workshop_manual1092.pdf`)).json();
  assert.equal(data.mediaBox.length, 4);
  assert.ok(Array.isArray(data.links));
  assert.ok('rotation' in data);
});

test('Sektionsbaum enthält alle Dokumente', async () => {
  const tree = await (await fetch(`${BASE}/api/tree`)).json();
  const docs = tree.reduce(
    (sum, group) => sum + group.sections.reduce((n, section) => n + section.docs.length, 0),
    0
  );
  assert.equal(docs, 7294);
});

test('Index ist konsistent', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'search_index.json'), 'utf8'));
  assert.equal(catalog.length, 7294);

  const secRe = /^\d{2}-\d{2}[A-Z]?-\d+$/;
  const bad = catalog.filter((entry) => entry.sec && !secRe.test(entry.sec));
  assert.equal(bad.length, 0, `${bad.length} ungültige Sektionscodes`);

  assert.ok(fs.existsSync(DATA_DIR), 'data/ fehlt');
  const missing = catalog.filter((entry) => !fs.existsSync(path.join(DATA_DIR, entry.f)));
  assert.equal(missing.length, 0, `${missing.length} PDFs fehlen`);
});

test('Traversal-Varianten werden blockiert', async () => {
  for (const url of ['/pdf/..%2F..%2FWindows%2Fwin.ini', '/public/%2E%2E%2Fserver.js', '/pdf/../server.js']) {
    const res = await fetch(BASE + url);
    assert.ok([403, 404].includes(res.status), `${url} lieferte ${res.status}`);
  }
});

test('Range-Request liefert 206 mit Teilinhalt', async () => {
  const res = await fetch(`${BASE}/pdf/front_page.pdf`, { headers: { Range: 'bytes=0-99' } });
  assert.equal(res.status, 206);
  assert.ok((res.headers.get('content-range') || '').startsWith('bytes 0-99/'));
  assert.equal(res.headers.get('accept-ranges'), 'bytes');
  const body = await res.arrayBuffer();
  assert.equal(body.byteLength, 100);
});

test('Unbrauchbarer Range liefert 416', async () => {
  const res = await fetch(`${BASE}/pdf/front_page.pdf`, { headers: { Range: 'bytes=999999999-' } });
  assert.equal(res.status, 416);
  assert.equal(res.headers.get('content-range'), 'bytes */' + fs.statSync(path.join(DATA_DIR, 'front_page.pdf')).size);
});

test('Favicon wird als PNG ausgeliefert', async () => {
  const res = await fetch(`${BASE}/favicon.ico`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.ok((await res.arrayBuffer()).byteLength > 1000);
});
