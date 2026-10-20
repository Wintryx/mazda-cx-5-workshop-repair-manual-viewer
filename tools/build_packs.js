/**
 * build_packs.js – erzeugt config/packs.json aus dem Suchindex.
 *
 * Die Reparatur-Packs werden NICHT mehr von Hand gepflegt, sondern aus
 * Sektion + Titel-Muster abgeleitet. Dadurch kann kein Pack-Eintrag mehr
 * auf die falsche Seite zeigen.
 *
 * Bewertung: Titel mit Kernbegriff (z. B. "INJECTOR REMOVAL") vor Titeln mit
 * Randbegriff vor reinen Volltext-Treffern – so landen echte Anleitungen oben
 * und nicht die Übersichts-/TOC-Seiten.
 *
 * Aufruf: node tools/build_packs.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'public', 'search_index.json');
const OUT = path.join(ROOT, 'config', 'packs.json');

const PACKS = [
  {
    category: '🔧 Diesel-Injektoren (2.2 Skyactiv-D)',
    sections: ['01-14B'],
    core: /INJECTOR|INJECTION PIPE/i,
    match: /FUEL SYSTEM|FUEL LINE/i,
    max: 8,
    priority: [
      { file: 'mazda_cx5_workshop_manual1092.pdf', title: 'Injektor Aus-/Einbau (Kraftstoffsystem 2.2D)' },
      { file: 'mazda_cx5_workshop_manual1094.pdf', title: 'Montageanleitung Injektor (Anzugschema)' },
      { file: 'mazda_cx5_workshop_manual1095.pdf', title: 'Klammer-Drehmomente (Anzugschema Teil 2)' },
      { file: 'mazda_cx5_workshop_manual1096.pdf', title: 'Injektor elektrisch prüfen (Widerstand)' },
      { file: 'mazda_cx5_workshop_manual1090.pdf', title: 'Einspritzleitungen ausbauen' }
    ]
  },
  {
    category: '🛑 Bremsen-Service (Vorder- & Hinterachse)',
    sections: ['04-11', '04-12'],
    core: /PAD|DISC|CALIPER|PARKING BRAKE/i,
    match: /BRAKE/i,
    max: 8,
    priority: [
      { file: 'mazda_cx5_workshop_manual1695.pdf', title: 'Vorderradbremse: Belag & Scheibe aus-/einbauen' },
      { file: 'mazda_cx5_workshop_manual1696.pdf', title: 'Montagehinweise Bremsbelag' },
      { file: 'mazda_cx5_workshop_manual1693.pdf', title: 'Bremsscheibe: Seitenschlag prüfen' },
      { file: 'mazda_cx5_workshop_manual1694.pdf', title: 'Bremsscheibe: Dicke prüfen' },
      { file: 'mazda_cx5_workshop_manual1707.pdf', title: 'Feststellbremse: Prüfen & Einstellen' },
      { file: 'mazda_cx5_workshop_manual1675.pdf', title: 'Bremsflüssigkeit prüfen' }
    ]
  },
  {
    category: '🛢️ Ölwechsel, Ölsieb & Schmiersystem (2.2D)',
    sections: ['01-11B'],
    core: /OIL (REPLACEMENT|FILTER|LEVEL|PRESSURE)|STRAINER/i,
    match: /OIL|LUBRICATION/i,
    max: 7,
    priority: [
      { file: 'mazda_cx5_workshop_manual843.pdf', title: 'Motorölwechsel (Füllmenge & Spezifikation)' },
      { file: 'mazda_cx5_workshop_manual844.pdf', title: 'Ölfilter wechseln (Anzugpunkt)' },
      { file: 'mazda_cx5_workshop_manual840.pdf', title: 'Ölstand prüfen' },
      { file: 'mazda_cx5_workshop_manual842.pdf', title: 'Ölsieb prüfen / montieren' },
      { file: 'mazda_cx5_workshop_manual846.pdf', title: 'Öldruck prüfen' }
    ]
  },
  {
    category: '⚙️ Steuerkette, Nockenwellen & Ventile (2.2D)',
    sections: ['01-10B'],
    core: /TIMING CHAIN|CAMSHAFT|VALVE/i,
    match: /CYLINDER HEAD|ROCKER|ENGINE/i,
    max: 8,
    priority: [
      { file: 'mazda_cx5_workshop_manual720.pdf', title: 'Steuerkette aus-/einbauen (Steuerzeiten)' }
    ]
  },
  {
    category: '💨 Turbolader, DPF & AGR (2.2D)',
    sections: ['01-13B', '01-15B', '01-16B'],
    core: /TURBOCHARGER|PARTICULATE|EGR|INTERCOOLER/i,
    match: /INTAKE|EXHAUST|EMISSION/i,
    max: 8,
    priority: [
      { file: 'mazda_cx5_workshop_manual955.pdf', title: 'Turbolader aus-/einbauen' },
      { file: 'mazda_cx5_workshop_manual1128.pdf', title: 'Abgasanlage & DPF: Übersicht' },
      { file: 'mazda_cx5_workshop_manual1162.pdf', title: 'Emissionssystem (AGR): Übersicht' }
    ]
  },
  {
    category: '❄️ Klima & Heizung (HVAC)',
    sections: ['07-11', '07-40', '07-10'],
    core: /COMPRESSOR|REFRIGERANT|BLOWER|EVAPORATOR|CONDENSER|HEATER/i,
    match: /AIR CONDITION|HVAC/i,
    max: 7
  },
  {
    category: '🛞 Fahrwerk & Radlager',
    sections: ['02-13', '02-14', '02-11'],
    core: /SHOCK ABSORBER|COIL SPRING|WHEEL BEARING|ALIGNMENT|CONTROL ARM/i,
    match: /SUSPENSION/i,
    max: 7
  }
];

function main() {
  if (!fs.existsSync(INDEX)) {
    console.error(`Suchindex fehlt: ${INDEX}\nBitte zuerst "node build_index.js" ausführen.`);
    process.exit(1);
  }
  const catalog = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
  const workshop = catalog.filter(e => e.type === 'workshop' && e.sec);

  const packs = [];
  for (const def of PACKS) {
    const scored = [];
    for (const e of workshop) {
      if (!def.sections.some(s => e.sec.startsWith(s))) continue;
      const title = e.t || '';
      let score = 0;
      if (def.core.test(title)) score += 3;
      else if (def.match.test(title)) score += 2;
      else if (def.match.test(e.kw || '') || def.core.test(e.kw || '')) score += 1;
      if (score > 0) scored.push({ e, score });
    }

    const byName = new Map(catalog.map(e => [e.f, e]));
    const items = [];
    const used = new Set();

    // 1. Kuratierte Kernseiten (geprüft: Datei existiert und Sektion passt)
    for (const pr of (def.priority || [])) {
      const e = byName.get(pr.file);
      if (!e) { console.warn(`WARNUNG: Priority-Datei fehlt: ${pr.file}`); continue; }
      if (!def.sections.some(s => e.sec.startsWith(s))) {
        console.warn(`WARNUNG: ${pr.file} (${e.sec}) liegt nicht in ${def.sections.join(', ')}`);
        continue;
      }
      items.push({ file: e.f, sec: e.sec, title: pr.title });
      used.add(e.f);
    }

    // 2. Automatisch nach Relevanz ergänzen
    const rest = scored
      .filter(s => !used.has(s.e.f))
      .sort((a, b) =>
        b.score - a.score ||
        a.e.sec.localeCompare(b.e.sec, undefined, { numeric: true }) ||
        a.e.f.localeCompare(b.e.f));
    for (const { e } of rest) {
      if (items.length >= def.max) break;
      items.push({
        file: e.f,
        sec: e.sec,
        title: e.t || `${e.sec} – ${e.f.replace(/^mazda_cx5_workshop_manual/, 'Dokument ').replace(/\.pdf$/, '')}`
      });
      used.add(e.f);
    }

    if (items.length === 0) console.warn(`WARNUNG: Pack "${def.category}" hat keine Treffer.`);
    packs.push({ category: def.category, items });
  }

  fs.writeFileSync(OUT, JSON.stringify(packs, null, 2), 'utf8');
  console.log(`Packs geschrieben: ${OUT}`);
  for (const p of packs) {
    console.log(`\n${p.category} (${p.items.length})`);
    for (const i of p.items) console.log(`  ${i.sec.padEnd(10)} ${i.file}  ${i.title.slice(0, 62)}`);
  }
}

main();
