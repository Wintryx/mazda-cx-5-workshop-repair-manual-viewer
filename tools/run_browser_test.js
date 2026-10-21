/**
 * run_browser_test.js – "npm run test:browser" ohne manuelle Vorbereitung.
 *
 * Startet den Viewer auf einem freien Port (3480–3539), führt
 * tools/browser_test.js mit Playwright gegen diesen Server aus und beendet ihn
 * wieder. Ein bereits laufender Viewer bleibt unberührt.
 *
 * Voraussetzungen: `npm install` (devDependency playwright) und ein
 * installiertes Google Chrome – der Test startet Chrome über `channel: 'chrome'`,
 * es werden also keine Playwright-Browser heruntergeladen.
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
        // noch nicht belegt
      }
    }
    await sleep(250);
  }
  return 0;
}

async function main() {
  try {
    require.resolve('playwright');
  } catch (err) {
    console.error('\nPlaywright ist nicht installiert.');
    console.error('Bitte einmalig "npm install" ausführen (devDependencies) und Google Chrome bereithalten.\n');
    process.exit(1);
  }

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
    if (!exited) server.kill();
    process.exit(1);
  }

  const base = `http://127.0.0.1:${port}/`;
  console.log(`Viewer läuft auf ${base}`);
  const code = await runNode([path.join('tools', 'browser_test.js'), base]);

  if (!exited) server.kill();
  await sleep(300);
  process.exit(code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
