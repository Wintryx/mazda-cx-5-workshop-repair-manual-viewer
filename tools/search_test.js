/**
 * search_test.js – Regressionstests für die Suche.
 *
 * Aufruf: node tools/search_test.js [http://127.0.0.1:3300]
 */

const BASE = process.argv[2] || 'http://127.0.0.1:3300';

const CASES = [
  { q: 'klima', maxTotal: 400, topSec: /^07-/, why: 'Klima darf nicht 65 % des Bestands treffen' },
  { q: 'öl', maxTotal: 1300, topSec: null, forbid: /coil spring/i, why: 'oil != coil spring' },
  { q: 'ölwechsel', maxTotal: 300, topSec: null, why: 'sollte auf Ölwechsel-Seiten führen' },
  { q: 'luftfilter', minTotal: 1, topSec: null, why: 'Wörterbuch-Lücke war 0 Treffer' },
  { q: 'bremse', minTotal: 20, topSec: /^04-/, why: 'Bremsen-Kapitel zuerst' },
  { q: 'bremsbelag', minTotal: 1, topSec: null, why: 'Umlaut-/Kompositum-Suche' },
  { q: '1092', topFile: 'mazda_cx5_workshop_manual1092.pdf', why: 'Dokumentnummer' },
  { q: '01-14B', topSec: /^01-14B/, why: 'Sektionssuche' },
  { q: 'steuerkette', minTotal: 5, topSec: /^01-10[AB]/, why: 'Timing Chain (G oder D)' },
  { q: 'radlager', minTotal: 1, topSec: null, why: 'wheel bearing' },
  { q: 'dpf', minTotal: 3, maxTotal: 600, topSec: null, why: 'Partikelfilter' },
  { q: 'turbolader', minTotal: 3, topSec: null, why: 'Turbolader' },
  { q: 'spurstangenkopf', minTotal: 1, topSec: null, why: 'neuer Wörterbuch-Eintrag' },
  { q: 'drosselklappe', minTotal: 1, topSec: null, why: 'neuer Wörterbuch-Eintrag' },
  { q: 'zzzzzz', maxTotal: 0, why: 'kein Treffer bei Unsinn' }
];

async function main() {
  let pass = 0;
  let fail = 0;

  for (const c of CASES) {
    const url = `${BASE}/api/search?q=${encodeURIComponent(c.q)}&limit=10`;
    let data;
    try {
      data = await (await fetch(url)).json();
    } catch (e) {
      console.log(`✗ ${c.q}: Server nicht erreichbar (${e.message})`);
      fail++;
      continue;
    }
    const total = data.total || 0;
    const top = (data.results || [])[0] || {};
    const problems = [];

    if (c.minTotal !== undefined && total < c.minTotal) problems.push(`total ${total} < ${c.minTotal}`);
    if (c.maxTotal !== undefined && total > c.maxTotal) problems.push(`total ${total} > ${c.maxTotal}`);
    if (c.topFile && top.f !== c.topFile) problems.push(`top ${top.f} ≠ ${c.topFile}`);
    if (c.topSec && !(top.sec || '').match(c.topSec)) problems.push(`top-sec ${top.sec || '—'} passt nicht`);
    if (c.forbid && c.forbid.test(top.t || '')) problems.push(`top-titel verboten: ${top.t}`);

    if (problems.length === 0) {
      pass++;
      console.log(`✓ ${c.q.padEnd(16)} total=${String(total).padStart(4)}  ${String(data.took).padStart(5)} ms  ${(top.t || top.f || '').slice(0, 55)}`);
    } else {
      fail++;
      console.log(`✗ ${c.q.padEnd(16)} ${problems.join(' · ')}`);
      console.log(`   top: ${top.sec || '—'} | ${(top.t || '').slice(0, 70)}`);
    }
  }

  console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
