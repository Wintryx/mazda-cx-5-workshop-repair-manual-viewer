/**
 * run_tests.js – führt "npm test" ohne manuelle Vorbereitung aus.
 *
 *   1. Index und Konfiguration validieren  (tools/validate.js)
 *   2. Server auf einem freien Port starten (server.js, PORT=<frei>)
 *   3. API-Vertrag und Suche prüfen        (tools/api_contract_test.js, tools/search_test.js)
 *   4. Server beenden
 *
 * Aufruf:  npm test        (Exit-Code 1, sobald ein Block fehlschlägt)
 * Hinweis: Der Server läuft auf einem Port zwischen 3480 und 3539, damit ein
 *          bereits laufender Viewer auf 3300 ungestört bleibt.
 */

const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NODE = process.execPath;
const FIRST_PORT = 3480;
const PORT_ATTEMPTS = 10;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn(NODE, args, { cwd: ROOT, stdio: 'inherit' });
    child.on('error', () => resolve(1));
    child.on('exit', (code) => resolve(code === null ? 1 : code));
  });
}

/** Sucht den Port, auf dem der frisch gestartete Server antwortet. */
async function findServerPort() {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    for (let i = 0; i < PORT_ATTEMPTS; i++) {
      const port = FIRST_PORT + i;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/status`, { signal: AbortSignal.timeout(1000) });
        if (res.ok) {
          const body = await res.json();
          if (body && body.status === 'ok') return port;
        }
      } catch (e) {
        // Port noch nicht belegt – weiter warten
      }
    }
    await sleep(250);
  }
  return 0;
}

async function main() {
  let failures = 0;

  console.log('\n=== 1/3  Validierung (Index & Konfiguration) ===');
  if (await runNode([path.join('tools', 'validate.js')]) !== 0) failures++;

  console.log('\n=== 2/3  Server starten ===');
  const server = spawn(NODE, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(FIRST_PORT), MAZDA_PORT_FILE: '0' },
    stdio: 'ignore'
  });
  let exited = false;
  server.on('exit', () => { exited = true; });

  const port = await findServerPort();
  if (!port) {
    console.error(`\nFEHLER: Server auf Port ${FIRST_PORT}–${FIRST_PORT + PORT_ATTEMPTS - 1} nicht erreichbar.`);
    console.error('Ursache zeigt "npm start" (z. B. fehlendes Handbuch-Verzeichnis data\\).');
    if (!exited) server.kill();
    process.exit(1);
  }
  const base = `http://127.0.0.1:${port}`;
  console.log(`Server läuft auf ${base}`);

  console.log('\n=== 3/3  API- und Suchtests ===');
  if (await runNode([path.join('tools', 'api_contract_test.js'), base]) !== 0) failures++;
  if (await runNode([path.join('tools', 'search_test.js'), base]) !== 0) failures++;

  if (!exited) server.kill();
  await sleep(300);

  console.log(failures === 0
    ? '\nERGEBNIS: alle Tests grün.'
    : `\nERGEBNIS: ${failures} Testblock/‑blöcke fehlgeschlagen.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
