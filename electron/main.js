/**
 * main.js – Electron-Hülle für den Mazda CX-5 Service Manual Viewer (v1.10.0)
 *
 * Der Viewer bleibt eine normale Web-App: Diese Datei sucht einen freien Port,
 * setzt MANUAL_DIR auf `data\` neben der EXE, startet den bestehenden Server im
 * selben Prozess und zeigt ihn in einem Fenster. Kein Node auf dem Zielrechner
 * nötig, Chromium bringt Electron mit.
 *
 * Test ohne Fenster:  Mazda CX-5 Viewer.exe --smoke
 *   startet den Server, fragt /api/status ab und beendet sich mit Code 0/1.
 */

const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const http = require('node:http');

// Chromium lehnt unbekannte --Schalter vor dem App-Start ab ("bad option"),
// deshalb primär über eine Umgebungsvariable.
const SMOKE = process.env.MAZDA_SMOKE === '1' || process.argv.includes('--smoke');
const TITLE = 'Mazda CX-5 Service Manual Viewer';

// Die EXE hat unter Windows keine Konsole: Fehler landen in einer Logdatei.
function logError(stage, err) {
  const line = `${new Date().toISOString()} ${stage}: ${err && err.stack ? err.stack : String(err)}\n`;
  const targets = [];
  try { targets.push(path.join(app.getPath('userData'), 'error.log')); } catch (e) { /* vor ready */ }
  targets.push(path.join(require('node:os').tmpdir(), 'mazda-viewer-error.log'));
  for (const file of targets) {
    try { fs.appendFileSync(file, line); return; } catch (e) { /* nächster Pfad */ }
  }
}

let server = null;
let win = null;
let baseUrl = '';

/** Datenverzeichnis: neben der EXE (gepackt) bzw. im Projektordner (Entwicklung). */
function resolveDataDir() {
  if (app.isPackaged) return path.join(path.dirname(process.execPath), 'data');
  return path.join(app.getAppPath(), 'data');
}

/** Freien Port auf 127.0.0.1 ermitteln. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function request(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => req.destroy(new Error('Zeitüberschreitung')));
    req.on('error', reject);
  });
}

async function waitForServer(attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await request(`${baseUrl}/api/status`, 1000);
      if (res.status === 200) return JSON.parse(res.body);
    } catch (e) {
      // noch nicht bereit
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

async function startViewer() {
  const dataDir = resolveDataDir();
  process.env.MANUAL_DIR = dataDir;
  process.env.PORT = String(await freePort());
  baseUrl = `http://127.0.0.1:${process.env.PORT}`;

  // Server im selben Prozess – require startet ihn nicht von allein
  const { startServer } = require('../server.js');
  server = startServer(Number(process.env.PORT), 0);

  const status = await waitForServer();
  if (!status) {
    dialog.showErrorBox(TITLE, `Der lokale Server ist nicht gestartet.\n\n${baseUrl}`);
    app.exit(1);
    return;
  }

  if (SMOKE) {
    const report = {
      ok: status.manualDirOk === true,
      port: status.port,
      manualDir: status.manualDir,
      pdfs: status.pdfCount,
      catalog: status.totalCatalogDocs
    };
    console.log(JSON.stringify(report));
    // GUI-Anwendungen haben unter Windows keine Konsole – Ergebnis zusätzlich ablegen
    try {
      fs.writeFileSync(path.join(require('node:os').tmpdir(), 'mazda-viewer-smoke.json'), JSON.stringify(report), 'utf8');
    } catch (e) { /* egal */ }
    app.exit(report.ok ? 0 : 1);
    return;
  }

  if (!fs.existsSync(dataDir)) {
    dialog.showErrorBox(
      TITLE,
      'Handbuch-Verzeichnis nicht gefunden:\n\n' + dataDir +
      '\n\nBitte den Ordner "data" mit den 7.294 PDFs neben die EXE legen.'
    );
    app.exit(1);
    return;
  }

  createWindow(status);
}

function createWindow(status) {
  win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b1020',
    title: TITLE,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  Menu.setApplicationMenu(null);
  win.setMenuBarVisibility(false);

  // "Original-PDF in neuem Tab" oder fremde Links gehen an den Standardbrowser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(baseUrl)) {
      shell.openExternal(url);
    } else if (/^https?:/i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.loadURL(baseUrl);
  win.on('closed', () => { win = null; });
}

function shutdown(code = 0) {
  if (server) {
    try { server.close(); } catch (e) { /* egal */ }
    server = null;
  }
  app.exit(code);
}

// Nur eine Instanz; ein zweiter Start holt das vorhandene Fenster nach vorn.
if (!app.requestSingleInstanceLock()) {
  app.exit(0);
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(startViewer).catch((err) => {
    logError('Start', err);
    dialog.showErrorBox(TITLE, 'Start fehlgeschlagen:\n\n' + (err && err.message ? err.message : String(err)));
    shutdown(1);
  });

  process.on('uncaughtException', (err) => {
    logError('Uncaught', err);
  });

  app.on('window-all-closed', () => shutdown(0));
  app.on('before-quit', () => {
    if (server) {
      try { server.close(); } catch (e) { /* egal */ }
      server = null;
    }
  });
}
