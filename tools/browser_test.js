// Playwright-Test gegen den laufenden Viewer (echtes Chrome, Kanal "chrome").
// Aufruf: node mazda.spec.js http://127.0.0.1:3416/
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:3416/';
const SHOTS = path.join(require('os').tmpdir(), 'mazda-playwright-shots');
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fails.push(name + (detail ? ` – ${detail}` : '')); console.log(`✗ ${name}${detail ? ' – ' + detail : ''}`); }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'de-DE' });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push('console: ' + m.text()); });

  // ---------- 1) Laden ----------
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('#loading-overlay.hidden', { state: 'attached', timeout: 20000 });

  const canvas = await page.evaluate(() => {
    const c = document.getElementById('pdf-canvas');
    return { w: c.width, h: c.height };
  });
  check('PDF gerendert (Canvas)', canvas.w > 100 && canvas.h > 100, `${canvas.w}×${canvas.h}`);
  check('TextLayer gefüllt', await page.locator('#text-layer span').count() > 50);
  check('Hotspots vorhanden', await page.locator('.hotspot-link').count() > 0);
  check('Kapitelbaum 16 Karten', await page.locator('.chapter-card').count() === 16);

  // Sektionsbaum aus dem Index (v1.8.0)
  await page.waitForSelector('#section-tree .tree-group', { timeout: 15000 });
  check('Sektionsbaum geladen', await page.locator('#section-tree .tree-group').count() > 10);
  await page.locator('#section-tree .tree-head').first().click();
  const sectionCount = await page.locator('#section-tree .tree-section').count();
  check('Gruppe klappt Sektionen auf', sectionCount > 0, String(sectionCount));
  await page.locator('#section-tree .tree-head-sub').first().click();
  const treeDocs = await page.locator('#section-tree .tree-doc').count();
  check('Sektion zeigt Dokumente', treeDocs > 0, String(treeDocs));

  await page.screenshot({ path: path.join(SHOTS, '01-start.png') });

  // ---------- 2) Hotspot-Navigation ----------
  const before = await page.locator('#doc-name-badge').textContent();
  await page.locator('.hotspot-link').first().click();
  await page.waitForFunction((prev) => document.getElementById('doc-name-badge').textContent !== prev, before, { timeout: 15000 });
  const after = await page.locator('#doc-name-badge').textContent();
  check('Klick auf PDF-Hotspot wechselt Dokument', after !== before, `${before} → ${after}`);
  check('URL-Hash folgt dem Dokument', page.url().includes(after.trim()));

  // ---------- 3) Zoom & Breite ----------
  await page.click('#btn-zoom-in');
  await page.waitForTimeout(400);
  const zoom = (await page.locator('#zoom-level-text').textContent()).trim();
  check('Zoom vergrößert', parseInt(zoom, 10) > 125, zoom);
  await page.click('#btn-fit-width');
  await page.waitForTimeout(600);
  const fitted = await page.evaluate(() => {
    const c = document.getElementById('pdf-canvas');
    const v = document.getElementById('viewer-container');
    return { canvas: parseFloat(c.style.width), viewport: v.clientWidth };
  });
  check('„Breite anpassen" passt in den Viewer', fitted.canvas <= fitted.viewport, `${fitted.canvas} ≤ ${fitted.viewport}`);

  // ---------- 4) Suche ----------
  await page.fill('#sidebar-search-input', 'bremse');
  await page.waitForFunction(() => document.querySelectorAll('#search-results-list .nav-item').length > 0, null, { timeout: 15000 });
  const res1 = await page.locator('#search-results-list .nav-item').count();
  const total = await page.locator('#search-count').textContent();
  check('Suche liefert Treffer', res1 > 0, `${res1} von ${total}`);
  check('„Weitere laden" sichtbar', await page.locator('#search-more').isVisible());
  await page.click('#search-more');
  await page.waitForTimeout(900);
  const res2 = await page.locator('#search-results-list .nav-item').count();
  check('Nachladen ergänzt Treffer', res2 > res1, `${res1} → ${res2}`);

  // ---------- 5) Lesezeichen: Löschen darf nicht navigieren ----------
  const docBefore = await page.locator('#doc-name-badge').textContent();
  await page.click('#btn-bookmark');
  await page.click('[data-tab="repairs"]');
  await page.waitForTimeout(300);
  await page.locator('.btn-delete-bookmark').first().click();
  await page.waitForTimeout(600);
  const docAfter = await page.locator('#doc-name-badge').textContent();
  check('Lesezeichen löschen navigiert nicht', docBefore === docAfter, `${docBefore} → ${docAfter}`);
  check('Lesezeichen entfernt', (await page.locator('#bookmarks-count').textContent()) === '0');

  // ---------- 6) Notiz-Autosave ----------
  await page.click('#btn-note');
  await page.fill('#notes-textarea', 'Testnotiz: Kupferringe erneuern');
  await page.click('#btn-next-page');
  await page.waitForTimeout(1500);
  await page.click('#btn-prev-page');
  await page.waitForTimeout(1500);
  const noteBack = await page.evaluate(() => (JSON.parse(localStorage.getItem('mazda_notes') || '{}')));
  check('Notiz beim Dokumentwechsel gesichert', Object.keys(noteBack).length > 0, Object.keys(noteBack).join(','));
  await page.click('#btn-note');
  await page.waitForTimeout(200);

  // ---------- 7) Checklisten ----------
  await page.click('[data-tab="checklists"]');
  await page.waitForTimeout(400);
  check('drei Checklisten', await page.locator('.checklist-card').count() === 3);
  await page.locator('.checklist-card').first().click();
  await page.waitForTimeout(400);
  check('Checkliste öffnet', await page.locator('#checklist-detail').isVisible());
  check('Kopf mit Zurück-Button bleibt', await page.locator('#btn-checklist-back').isVisible());
  await page.locator('.checklist-step input[type=checkbox]').first().check();
  await page.waitForTimeout(300);
  const stored = await page.evaluate(() => localStorage.getItem('mazda_checklists'));
  check('Schritt gespeichert', stored !== null && stored.includes('0'));
  await page.click('#btn-checklist-back');
  await page.waitForTimeout(300);
  check('Zurück zur Liste', await page.locator('.checklist-card').count() === 3);
  await page.screenshot({ path: path.join(SHOTS, '02-checklisten.png') });

  // ---------- 8) Druckdialog ----------
  await page.click('#btn-print');
  await page.waitForTimeout(300);
  check('Druckdialog öffnet', await page.locator('#print-modal').isVisible());
  await page.click('#btn-print-cancel');
  await page.waitForTimeout(200);
  check('Druckdialog schließt', await page.locator('#print-modal').isHidden());

  // ---------- 9) Gedrehter Schaltplan ----------
  await page.evaluate(() => { location.hash = '#mazda_cx5_electrical_wiring_diagrams100.pdf'; });
  await page.waitForFunction(() => (document.getElementById('doc-name-badge') || {}).textContent?.includes('wiring_diagrams100'), null, { timeout: 15000 });
  await page.waitForSelector('#loading-overlay.hidden', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(800);
  const geo = await page.evaluate(() => {
    const wrap = document.getElementById('page-wrapper');
    const w = wrap.getBoundingClientRect();
    const spots = [...document.querySelectorAll('.hotspot-link')].map((s) => {
      const r = s.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // Mittelpunkt muss auf der Seite liegen (Ränder dürfen minimal überstehen)
      return { inside: cx >= w.left && cx <= w.right && cy >= w.top && cy <= w.bottom };
    });
    return {
      w: parseFloat(wrap.style.width), h: parseFloat(wrap.style.height),
      spots: spots.length, inside: spots.every((s) => s.inside)
    };
  });
  check('Schaltplan liegt quer', geo.w > geo.h, `${geo.w}×${geo.h}`);
  check('alle Hotspots liegen auf der Seite', geo.inside === true, `${geo.spots} Hotspots`);
  await page.screenshot({ path: path.join(SHOTS, '03-schaltplan.png') });

  // ---------- 10) Tablet-Ansicht ----------
  const tablet = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: false, locale: 'de-DE' });
  const tp = await tablet.newPage();
  const tabletErrors = [];
  tp.on('pageerror', (e) => tabletErrors.push(e.message));
  await tp.goto(BASE, { waitUntil: 'load' });
  await tp.waitForSelector('#loading-overlay.hidden', { state: 'attached', timeout: 20000 });
  const beforeLeft = await tp.evaluate(() => Math.round(document.getElementById('app-sidebar').getBoundingClientRect().left));
  await tp.click('#btn-toggle-sidebar');
  await tp.waitForTimeout(700);
  const tabletState = await tp.evaluate(() => ({
    afterLeft: Math.round(document.getElementById('app-sidebar').getBoundingClientRect().left),
    headerVisible: document.querySelector('.app-header').getBoundingClientRect().height > 0,
    canvas: document.getElementById('pdf-canvas').width
  }));
  tabletState.beforeLeft = beforeLeft;
  check('Tablet: Seite rendert', tabletState.canvas > 100, String(tabletState.canvas));
  check('Tablet: Sidebar lässt sich ausblenden', tabletState.afterLeft < tabletState.beforeLeft, `${tabletState.beforeLeft} → ${tabletState.afterLeft}`);
  check('Tablet: keine JS-Fehler', tabletErrors.length === 0, tabletErrors.join(' | '));
  await tp.screenshot({ path: path.join(SHOTS, '04-tablet.png') });
  await tablet.close();

  // ---------- 10b) Fehlercode-Suche (v1.9.0) ----------
  await page.fill('#sidebar-search-input', 'P0301');
  await page.waitForSelector('#dtc-hint:not(.hidden)', { timeout: 10000 });
  const dtcText = (await page.textContent('#dtc-hint')) || '';
  check('Fehlercode-Hinweis erscheint', /P0301/.test(dtcText), dtcText.trim());
  const firstBadge = ((await page.textContent('#search-results-list .nav-item-badge')) || '').trim();
  check('Fehlercode führt zum Diagnoseblatt', /^01-02/.test(firstBadge), firstBadge);

  // ---------- 10c) Sprachumschaltung (v1.12.0) ----------
  await page.evaluate(() => { window.__noReload = true; });
  await page.click('#btn-lang');
  await page.waitForSelector('#lang-menu:not(.hidden)', { timeout: 5000 });
  await page.click('#lang-menu [data-lang="en"]');
  await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 10000 });
  const enTab = ((await page.textContent('.sidebar-tabs .tab-btn span')) || '').trim();
  check('Sprachwechsel auf Englisch', enTab.includes('Assemblies'), enTab);
  check('Fenstertitel auf Englisch', (await page.title()).includes('Service Manual Portal'));
  check('Sprachwechsel ohne Neuladen', await page.evaluate(() => window.__noReload === true));
  const enChapter = ((await page.textContent('.chapter-title')) || '').trim();
  check('Kapitel auf Englisch', /General|Engine|Chassis|Driveline/.test(enChapter), enChapter);
  const enGroup = ((await page.textContent('#section-tree .tree-group .tree-name')) || '').trim();
  check('Sektionsbaum auf Englisch', /General|Engine|Suspension/.test(enGroup), enGroup);
  await page.click('[data-tab="repairs"]');
  const enPack = ((await page.textContent('.pack .section-header span')) || '').trim();
  check('Reparatur-Packs auf Englisch', /injectors|Brake service|Oil change/.test(enPack), enPack);
  await page.click('[data-tab="checklists"]');
  const enChecklist = ((await page.textContent('.checklist-card-title')) || '').trim();
  check('Checklisten auf Englisch', /Replace injectors|Front brakes|Oil change/.test(enChecklist), enChecklist);
  await page.click('#btn-lang');
  await page.click('#lang-menu [data-lang="de"]');
  await page.waitForFunction(() => document.documentElement.lang === 'de', null, { timeout: 10000 });

  // ---------- 11) Konsole ----------
  check('keine Konsolen-/Seitenfehler', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  await browser.close();
  console.log(`\n${pass} bestanden, ${fails.length} fehlgeschlagen`);
  if (fails.length) { fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
})().catch((e) => { console.error('ABBRUCH:', e.message); process.exit(1); });
