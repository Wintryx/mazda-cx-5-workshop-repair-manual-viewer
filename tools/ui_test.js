// End-to-End-Prüfung der Viewer-Oberfläche über das DevTools Protocol.
//
// Voraussetzung: Edge/Chrome mit --remote-debugging-port=9223 starten, z. B.
//   & 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' --headless=new --no-sandbox 
//     --remote-debugging-port=9223 --user-data-dir=C:\Users\ARNEWI~1\AppData\Local\Temp\edgecdp about:blank
// Dann: node tools/ui_test.js http://127.0.0.1:3300/
//
// Prüft Laden, Kapitel, Checklisten (inkl. Zurück), Suche mit Nachladen, Live-Highlight,
// gedrehte Schaltplanseite (Hotspot-Geometrie) und Konsolenfehler.
// Prüft: Laden, Kapitel, Checklisten (inkl. Zurück-Navigation), Suche mit Nachladen,
//        gedrehte Schaltplanseite (Hotspot-Geometrie), Konsolenfehler.
const fs = require('fs');
const path = require('path');

const CDP = 'http://127.0.0.1:9223';
const BASE = process.argv[2] || 'http://127.0.0.1:3413/';
const OUT_DIR = require('os').tmpdir();

let pass = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fails.push(name + (detail ? ` – ${detail}` : '')); console.log(`✗ ${name}${detail ? ' – ' + detail : ''}`); }
}

async function main() {
  const list = await (await fetch(CDP + '/json/list')).json();
  const page = list.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let nextId = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else events.push(msg);
  };
  const send = (method, params) => new Promise((res) => {
    const id = ++nextId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return { __error: r.result.exceptionDetails.text };
    return r.result.result.value;
  };

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });

  // 1) Startseite
  await send('Page.navigate', { url: BASE });
  await wait(8000);

  const basic = JSON.parse(await evaluate(`JSON.stringify({
    loadingHidden: document.getElementById('loading-overlay').classList.contains('hidden'),
    canvasW: document.getElementById('pdf-canvas').width,
    canvasH: document.getElementById('pdf-canvas').height,
    textSpans: document.querySelectorAll('#text-layer span').length,
    hotspots: document.querySelectorAll('.hotspot-link').length,
    chapters: document.querySelectorAll('.chapter-card').length,
    tabs: document.querySelectorAll('.tab-btn').length,
    sec: document.getElementById('doc-sec-badge').textContent
  })`));
  check('Seite lädt ohne Overlay', basic.loadingHidden === true);
  check('PDF-Canvas gerendert', basic.canvasW > 100 && basic.canvasH > 100, `${basic.canvasW}×${basic.canvasH}`);
  check('TextLayer gefüllt (Copy-Paste)', basic.textSpans > 50, String(basic.textSpans));
  check('Hotspots vorhanden', basic.hotspots > 0, String(basic.hotspots));
  check('Kapitelbaum geladen (16)', basic.chapters === 16, String(basic.chapters));
  check('drei Tabs vorhanden', basic.tabs === 3, String(basic.tabs));

  await send('Page.captureScreenshot', { format: 'png' }).then((s) => fs.writeFileSync(path.join(OUT_DIR, 'ui-1-start.png'), Buffer.from(s.result.data, 'base64')));

  // 2) Checklisten: öffnen, abhaken, zurück
  await evaluate(`document.querySelector('[data-tab="checklists"]').click()`);
  await wait(400);
  const cards = await evaluate(`document.querySelectorAll('.checklist-card').length`);
  check('Checklisten-Karten sichtbar', cards === 3, String(cards));

  await evaluate(`document.querySelector('.checklist-card').click()`);
  await wait(400);
  const detail = JSON.parse(await evaluate(`JSON.stringify({
    detailVisible: !document.getElementById('checklist-detail').classList.contains('hidden'),
    steps: document.querySelectorAll('.checklist-step').length,
    title: document.getElementById('checklist-title').textContent,
    backButton: !!document.getElementById('btn-checklist-back'),
    body: !!document.getElementById('checklist-body')
  })`));
  check('Checkliste öffnet Detailansicht', detail.detailVisible === true);
  check('Kopf (Titel + Zurück-Button) bleibt erhalten', detail.backButton && detail.body && detail.title.length > 3, detail.title);
  check('Schritte gerendert', detail.steps >= 5, String(detail.steps));

  const toggledRaw = await evaluate(`(() => {
    const cb = document.querySelector('.checklist-step input[type=checkbox]');
    const before = cb.checked;
    cb.click();
    return JSON.stringify({ before, checked: cb.checked, stored: localStorage.getItem('mazda_checklists'), visible: cb.offsetParent !== null });
  })()`);
  const toggled = JSON.parse(toggledRaw);
  check('Schritt abhakbar und gespeichert', toggled.checked === true && toggled.stored !== null, toggledRaw);

  await evaluate(`document.getElementById('btn-checklist-back').click()`);
  await wait(400);
  const back = JSON.parse(await evaluate(`JSON.stringify({
    listVisible: document.querySelectorAll('.checklist-card').length,
    detailHidden: document.getElementById('checklist-detail').classList.contains('hidden'),
    progress: (document.querySelector('.checklist-card .badge-count')||{}).textContent
  })`));
  check('Zurück-Navigation funktioniert', back.listVisible === 3 && back.detailHidden === true, JSON.stringify(back));
  check('Fortschritt wird angezeigt', /\d+\/\d+/.test(back.progress || ''), back.progress);

  await send('Page.captureScreenshot', { format: 'png' }).then((s) => fs.writeFileSync(path.join(OUT_DIR, 'ui-2-checklists.png'), Buffer.from(s.result.data, 'base64')));

  // 3) Suche inkl. Nachladen
  await evaluate(`(() => {
    const input = document.getElementById('sidebar-search-input');
    input.focus();
    input.value = 'bremse';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await wait(1200);
  const search1 = JSON.parse(await evaluate(`JSON.stringify({
    results: document.querySelectorAll('#search-results-list .nav-item').length,
    total: document.getElementById('search-count').textContent,
    moreVisible: !document.getElementById('search-more').classList.contains('hidden'),
    highlighted: document.querySelectorAll('.search-highlight').length
  })`));
  check('Suche liefert Treffer', search1.results > 0, String(search1.results));
  check('Gesamtzahl angezeigt', Number(search1.total) > 100, search1.total);
  check('„Weitere laden" sichtbar', search1.moreVisible === true);

  await evaluate(`document.getElementById('search-more').click()`);
  await wait(1200);
  const search2 = await evaluate(`document.querySelectorAll('#search-results-list .nav-item').length`);
  check('Nachladen erweitert die Liste', search2 > search1.results, `${search1.results} → ${search2}`);

  // Live-Highlight mit einem Begriff, der auf der geöffneten Seite (Injektor) steht
  await evaluate(`(() => {
    const input = document.getElementById('sidebar-search-input');
    input.value = 'injektor';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await wait(1200);
  const hl = await evaluate(`document.querySelectorAll('#text-layer span.search-highlight').length`);
  check('Live-Highlight im Dokument', hl > 0, String(hl));

  await send('Page.captureScreenshot', { format: 'png' }).then((s) => fs.writeFileSync(path.join(OUT_DIR, 'ui-3-suche.png'), Buffer.from(s.result.data, 'base64')));

  // 4) Gedrehter Schaltplan (254 Seiten mit /Rotate 90)
  await evaluate(`location.hash = '#mazda_cx5_electrical_wiring_diagrams100.pdf'`);
  await wait(7000);
  const rot = JSON.parse(await evaluate(`(() => {
    const canvas = document.getElementById('pdf-canvas');
    const wrap = document.getElementById('page-wrapper');
    const spots = [...document.querySelectorAll('.hotspot-link')].slice(0, 6).map(s => ({
      l: parseFloat(s.style.left), t: parseFloat(s.style.top),
      w: parseFloat(s.style.width), h: parseFloat(s.style.height)
    }));
    const wrapW = parseFloat(wrap.style.width), wrapH = parseFloat(wrap.style.height);
    const inside = spots.every(s => s.l >= -1 && s.t >= -1 && s.l + s.w <= wrapW + 1 && s.t + s.h <= wrapH + 1);
    return JSON.stringify({
      canvasW: canvas.width, canvasH: canvas.height, wrapW, wrapH,
      spots: spots.length, inside, file: (document.getElementById('doc-name-badge')||{}).textContent
    });
  })()`));
  check('Schaltplan geladen', (rot.file || '').includes('wiring_diagrams100'), rot.file);
  check('Querformat wird korrekt dargestellt (Breite > Höhe)', rot.wrapW > rot.wrapH, `${rot.wrapW}×${rot.wrapH}`);
  check('Hotspots liegen innerhalb der Seite', rot.inside === true, JSON.stringify(rot.spots && rot.spots[0]));
  check('Hotspots vorhanden', rot.spots > 0, String(rot.spots));

  await send('Page.captureScreenshot', { format: 'png' }).then((s) => fs.writeFileSync(path.join(OUT_DIR, 'ui-4-schaltplan.png'), Buffer.from(s.result.data, 'base64')));

  // 5) Konsolenfehler
  const problems = events.filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'));
  check('keine Konsolenfehler', problems.length === 0, problems.slice(0, 3).map(p => JSON.stringify(p.params).slice(0, 120)).join(' | '));

  console.log(`\n${pass} bestanden, ${fails.length} fehlgeschlagen`);
  if (fails.length) { fails.forEach(f => console.log('  ✗ ' + f)); }
  ws.close();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
