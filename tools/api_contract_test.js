/**
 * api_contract_test.js – prüft die Schnittstellen, die das Frontend erwartet.
 *
 * Aufruf: node tools/api_contract_test.js [http://127.0.0.1:3300]
 */

const BASE = process.argv[2] || 'http://127.0.0.1:3300';
let pass = 0;
const fails = [];

function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fails.push(name + (detail ? ` (${detail})` : '')); console.log(`✗ ${name}${detail ? ' – ' + detail : ''}`); }
}

async function json(path) {
  const res = await fetch(BASE + path);
  return { status: res.status, body: await res.json() };
}

async function main() {
  // --- Status ---
  const st = await json('/api/status');
  ok('GET /api/status 200', st.status === 200);
  ok('Status meldet 7.294 Dokumente', st.body.totalCatalogDocs === 7294, String(st.body.totalCatalogDocs));
  ok('Handbuch-Verzeichnis vorhanden', st.body.manualDirOk === true);
  ok('Index deckt alle PDFs ab', st.body.docsWithoutIndex === 0, String(st.body.docsWithoutIndex));
  ok('Status enthält config-Zähler', st.body.config && st.body.config.chapters > 0 && st.body.config.packs > 0 && st.body.config.checklists > 0);

  // --- Kapitel ---
  const ch = await json('/api/chapters');
  ok('GET /api/chapters 200', ch.status === 200);
  ok('Kapitel sind ein Array', Array.isArray(ch.body));
  ok('mindestens 15 Kapitel', ch.body.length >= 15, String(ch.body.length));
  const chFields = ch.body.every(c => c.id && c.title && c.icon && c.startFile && c.description);
  ok('Kapitelfelder vollständig (id/title/icon/startFile/description)', chFields);
  const subs = ch.body.flatMap(c => c.subsections || []);
  ok('Unterkapitel haben title+file', subs.every(s => s.title && s.file), String(subs.length) + ' Unterkapitel');

  // --- Sektionsbaum (v1.8.0) ---
  const tree = await json('/api/tree');
  ok('GET /api/tree 200', tree.status === 200);
  ok('Baum ist ein Array', Array.isArray(tree.body));
  ok('Baum hat mindestens 12 Gruppen', tree.body.length >= 12, String(tree.body.length));
  const sections = tree.body.flatMap((g) => g.sections || []);
  ok('Sektionen haben code/count/docs', sections.every((s) => typeof s.code === 'string' && s.count === s.docs.length));
  const treeDocs = sections.reduce((n, s) => n + s.docs.length, 0);
  ok('Baum enthält alle 7.294 Dokumente', treeDocs === 7294, String(treeDocs));
  ok('Gruppen 10–12 vorhanden', ['10', '11', '12'].every((k) => tree.body.some((g) => g.label.startsWith(k + ' '))));

  // --- Textverweise (v1.17.0) ---
  const lookup = await json('/api/lookup?codes=01-14B-35,99-99-99');
  ok('GET /api/lookup 200', lookup.status === 200);
  ok('Verweis 01-14B-35 löst auf', Boolean(lookup.body['01-14B-35'] && lookup.body['01-14B-35'].f));
  ok('Unbekannter Verweis bleibt leer', !lookup.body['99-99-99']);
  ok('Verweis nennt Titel', typeof (lookup.body['01-14B-35'] || {}).t === 'string');

  // --- Packs ---
  const packs = await json('/api/favorites');
  ok('GET /api/favorites 200', packs.status === 200);
  ok('Packs sind ein Array', Array.isArray(packs.body));
  ok('Pack-Felder (category/items)', packs.body.every(p => p.category && Array.isArray(p.items)));
  const items = packs.body.flatMap(p => p.items);
  ok('Pack-Items haben file/sec/title', items.every(i => i.file && i.sec && i.title), String(items.length) + ' Items');

  // --- Checklisten ---
  const cl = await json('/api/checklists');
  ok('GET /api/checklists 200', cl.status === 200);
  ok('Checklisten sind ein Array', Array.isArray(cl.body));
  ok('Checklisten haben id/title/steps', cl.body.every(c => c.id && c.title && Array.isArray(c.steps) && c.steps.length > 0));
  ok('Checklisten-Schritte haben text/file', cl.body.flatMap(c => c.steps).every(s => s.text && s.file));

  // --- Suche ---
  const s = await json('/api/search?q=bremse&limit=5');
  ok('GET /api/search 200', s.status === 200);
  ok('Suchantwort hat results/total/terms/took', Array.isArray(s.body.results) && typeof s.body.total === 'number' && Array.isArray(s.body.terms) && typeof s.body.took === 'number');
  ok('limit wird eingehalten', s.body.results.length === 5, String(s.body.results.length));
  ok('Ergebnis-Felder vollständig', s.body.results.every(r => r.f && 'sec' in r && 't' in r && 'grp' in r && typeof r.score === 'number'));
  const s2 = await json('/api/search?q=bremse&limit=5&offset=5');
  ok('Paging: offset liefert andere Treffer', s2.body.results[0] && s2.body.results[0].f !== s.body.results[0].f);
  ok('Paging: total bleibt gleich', s2.body.total === s.body.total, `${s.body.total} vs ${s2.body.total}`);
  const empty = await json('/api/search?q=');
  ok('Leere Suche liefert leeres Ergebnis', Array.isArray(empty.body.results) && empty.body.results.length === 0);

  // --- Fehlercodes (v1.9.0) ---
  const dtcSearch = await json('/api/search?q=P0301');
  ok('Fehlercode liefert dtc-Block', dtcSearch.body.dtc && dtcSearch.body.dtc.code === 'P0301', JSON.stringify(dtcSearch.body.dtc));
  ok('Fehlercode liefert Treffer', dtcSearch.body.total >= 3, String(dtcSearch.body.total));
  ok('Fehlercode führt zu Diagnoseblatt', /^\d{2}-02/.test((dtcSearch.body.results[0] || {}).sec || ''), (dtcSearch.body.results[0] || {}).sec);
  const dtcList = await json('/api/dtc');
  ok('GET /api/dtc 200', dtcList.status === 200);
  ok('DTC-Liste hat über 200 Codes', dtcList.body.count > 200, String(dtcList.body.count));
  ok('DTC-Einträge haben code/count/system', dtcList.body.codes.every(c => c.code && c.count > 0 && c.system));

  // --- Links ---
  const l = await json('/api/links/mazda_cx5_workshop_manual1092.pdf');
  ok('GET /api/links 200', l.status === 200);
  ok('Links haben mediaBox[4]', Array.isArray(l.body.mediaBox) && l.body.mediaBox.length === 4);
  ok('Links haben rotation', typeof l.body.rotation === 'number');
  ok('Links haben rect/target/title', l.body.links.every(x => Array.isArray(x.rect) && x.rect.length === 4 && x.target && 'title' in x));
  ok('meta enthält sec+title', l.body.meta && 'sec' in l.body.meta && 'title' in l.body.meta);
  const rot = await json('/api/links/mazda_cx5_electrical_wiring_diagrams100.pdf');
  ok('Querformat meldet rotation=90', rot.body.rotation === 90, String(rot.body.rotation));

  // --- Statische Dateien ---
  for (const p of ['/', '/public/app.js', '/public/style.css', '/public/style-v14.css', '/vendor/pdf.min.js']) {
    const r = await fetch(BASE + p);
    ok(`GET ${p} 200`, r.status === 200, String(r.status));
  }
  const html = await (await fetch(BASE + '/')).text();
  ok('index.html bindet style-v14.css ein', html.includes('style-v14.css'));
  ok('index.html bindet app.js ein', html.includes('/public/app.js'));
  ok('index.html hat Checklisten-Tab', html.includes('data-tab="checklists"'));
  ok('index.html hat Druck-Dialog', html.includes('id="print-modal"'));
  ok('index.html hat checklist-body', html.includes('id="checklist-body"'));

  // --- Sicherheit ---
  for (const p of ['/pdf/..%2F..%2FWindows%2Fwin.ini', '/public/%2E%2E%2Fserver.js', '/pdf/../server.js']) {
    const r = await fetch(BASE + p);
    ok(`Traversal blockiert: ${p}`, r.status === 404, String(r.status));
  }
  const head = await fetch(BASE + '/pdf/mazda_cx5_workshop_manual1092.pdf', { headers: { Origin: 'http://evil.example' } });
  ok('Kein CORS-Wildcard mehr', !head.headers.get('access-control-allow-origin'));
  ok('nosniff gesetzt', head.headers.get('x-content-type-options') === 'nosniff');
  ok('PDF wird ausgeliefert', head.status === 200 && (head.headers.get('content-type') || '').includes('application/pdf'));
  await head.arrayBuffer();

  console.log(`\n${pass} Prüfungen bestanden, ${fails.length} fehlgeschlagen`);
  if (fails.length) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
}

main().catch(e => { console.error('Abbruch:', e.message); process.exit(1); });
