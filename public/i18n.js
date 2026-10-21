/**
 * i18n.js – Oberflächentexte Deutsch/Englisch (v1.11.0)
 *
 * Die Seitensprache steht in `localStorage.mazda_lang` (Standard: de).
 * Statische Texte tragen `data-i18n` (Text), `data-i18n-title` (Tooltip)
 * oder `data-i18n-placeholder`; dynamische Texte holen sich app.js über t().
 *
 * Ein Sprachwechsel lädt die Seite neu – damit sind auch alle aus JavaScript
 * gerenderten Listen (Kapitel, Treffer, Checklisten) sofort konsistent.
 */

const I18N = {
  de: {
    'app.title': 'Mazda CX-5 (2012–2013) Werkstatthandbuch Portal',
    'header.toggleSidebar': 'Seitenleiste ein-/ausklappen (S)',
    'header.back': 'Zurück (Alt + Links)',
    'header.forward': 'Vorwärts (Alt + Rechts)',
    'header.home': 'Kapitelübersicht 00 (Allgemein)',
    'header.bookmarkAdd': 'Lesezeichen setzen (B)',
    'header.bookmarkRemove': 'Lesezeichen entfernen (B)',
    'header.noteAdd': 'Notiz hinzufügen (N)',
    'header.noteEdit': 'Notiz bearbeiten (N)',
    'header.prevDoc': 'Vorheriges Dokument (←)',
    'header.nextDoc': 'Nächstes Dokument (→)',
    'header.jump': 'Dokumentnummer (z. B. 1092)',
    'header.zoomOut': 'Verkleinern (-)',
    'header.zoomIn': 'Vergrößern (+)',
    'header.fitWidth': 'Breite anpassen (W)',
    'header.links': 'Klickbare Bereiche im PDF hervorheben',
    'header.print': 'Drucken / Bereich exportieren (P)',
    'header.fullscreen': 'Werkstatt-Vollbild',
    'header.rawPdf': 'Original-PDF in neuem Tab öffnen',
    'header.shortcuts': 'Tastatur-Kürzel (?)',
    'header.lang': 'Sprache wählen',

    'sidebar.search': 'Suchen (Bremse, Öl, 1092, 01-14B …)',
    'tabs.chapters': '🗂️ Baugruppen',
    'tabs.favorites': '⭐ Favoriten',
    'tabs.checklists': '✅ Checklisten',

    'search.results': 'Suchergebnisse',
    'search.more': 'Weitere {n} von {total} laden',
    'search.empty': 'Keine Treffer.',
    'search.failed': 'Suche fehlgeschlagen',
    'search.fuzzy': 'Keine exakten Treffer – ähnliche Begriffe angezeigt',
    'dtc.found': 'Fehlercode {code}: {n} Dokumente – Diagnoseblätter zuerst',
    'dtc.unknown': 'Fehlercode {code} ist im Handbuch nicht dokumentiert',

    'chapters.heading': 'Baugruppen-Übersicht (00–12)',
    'tree.heading': 'Alle Sektionen (aus dem Index)',
    'tree.loading': 'wird geladen …',
    'tree.error': 'Kapitelbaum nicht verfügbar',

    'bookmarks.heading': '★ Meine Lesezeichen',
    'bookmarks.empty': 'Noch keine Lesezeichen. Stern (★) im Kopfbereich setzen.',
    'bookmarks.added': 'Lesezeichen gesetzt',
    'bookmarks.removed': 'Lesezeichen entfernt',

    'notes.heading': '📝 Meine Werkstatt-Notizen',
    'notes.empty': 'Noch keine Notizen. Stift (📝) im Kopfbereich öffnet das Notizfeld.',
    'notes.panel': 'Eigene Werkstatt-Notiz',
    'notes.placeholder': 'Teilenummern, Drehmomente, Besonderheiten … (wird beim Wechsel automatisch gesichert)',
    'notes.save': 'Speichern',
    'notes.delete': 'Löschen',
    'notes.saved': 'Notiz gespeichert',
    'notes.close': 'Schließen',

    'quick.title': '2.2D Injektor-Drehmomente',
    'quick.verified': 'Geprüft gegen Original',
    'torque.nut1': 'Mutter 1 – Voranzug:',
    'torque.nut1Loosen': 'Mutter 1 – Lösen:',
    'torque.nut2': 'Mutter 2 – Endzug:',
    'torque.pipes': 'Einspritzleitungen:',
    'torque.rail': 'Common Rail:',
    'torque.return': 'Rücklaufleitung:',
    'torque.src4': '01-14B-37, Schritt 4',
    'torque.src5': '01-14B-37, Schritt 5',
    'torque.src6': '01-14B-38, Schritt 6',
    'torque.src78': '01-14B-38, Schritte 7–8',
    'torque.src9': '01-14B-38, Schritt 9',
    'torque.src10': '01-14B-38, Schritt 10',
    'checklist.back': 'Zurück zur Liste',

    'loading.doc': 'Dokument wird geladen …',
    'loading.error': 'Fehler beim Laden von {file}',
    'jump.invalid': 'Bitte eine Dokumentnummer eingeben',
    'paging.unavailable': 'Blättern ist für dieses Dokument nicht möglich',

    'checklist.empty': 'Keine Checklisten hinterlegt.',
    'checklist.reset': 'Zurücksetzen',
    'checklist.openPage': 'Seite öffnen',

    'print.title': 'Drucken / Bereich exportieren',
    'print.text': 'Die Seiten werden als Bildfolge in ein Druckfenster gerendert (max. 20 Seiten).',
    'print.from': 'Von',
    'print.to': 'Bis',
    'print.cancel': 'Abbrechen',
    'print.start': 'Drucken',
    'print.invalid': 'Bitte gültige Nummern eingeben.',
    'print.max': 'Maximal 20 Seiten auf einmal.',
    'print.preparing': 'Seiten werden vorbereitet …',
    'print.opening': 'Druckdialog wird geöffnet …',
    'print.blocked': 'Popup blockiert – bitte erlauben.',
    'print.windowTitle': 'Mazda CX-5 – Ausdruck',
    'print.progress': 'Rendere {n} von {total} …',

    'shortcuts.title': 'Tastatur-Kürzel',
    'shortcuts.nav': 'Navigation & Blättern',
    'shortcuts.view': 'Ansicht',
    'shortcuts.workshop': 'Werkstatt',
    'shortcuts.nextDoc': 'Nächstes / vorheriges Dokument',
    'shortcuts.history': 'Verlauf zurück / vor',
    'shortcuts.sidebar': 'Seitenleiste ein-/ausklappen',
    'shortcuts.zoom': 'Vergrößern / verkleinern',
    'shortcuts.fit': 'Breite anpassen',
    'shortcuts.bookmark': 'Lesezeichen setzen / löschen',
    'shortcuts.note': 'Notiz öffnen',
    'shortcuts.print': 'Drucken / Bereich exportieren',
    'shortcuts.search': 'Suche fokussieren',
    'shortcuts.help': 'Diese Übersicht',
    'shortcuts.close': 'Dialoge schließen',
    'shortcuts.hint': 'Auf Tablet: nach links/rechts wischen blättert.',
    'shortcuts.ok': 'Verstanden'
  },

  en: {
    'app.title': 'Mazda CX-5 (2012–2013) Service Manual Portal',
    'header.toggleSidebar': 'Toggle sidebar (S)',
    'header.back': 'Back (Alt + Left)',
    'header.forward': 'Forward (Alt + Right)',
    'header.home': 'Chapter overview 00 (General)',
    'header.bookmarkAdd': 'Add bookmark (B)',
    'header.bookmarkRemove': 'Remove bookmark (B)',
    'header.noteAdd': 'Add note (N)',
    'header.noteEdit': 'Edit note (N)',
    'header.prevDoc': 'Previous document (←)',
    'header.nextDoc': 'Next document (→)',
    'header.jump': 'Document number (e.g. 1092)',
    'header.zoomOut': 'Zoom out (-)',
    'header.zoomIn': 'Zoom in (+)',
    'header.fitWidth': 'Fit width (W)',
    'header.links': 'Highlight clickable areas in the PDF',
    'header.print': 'Print / export range (P)',
    'header.fullscreen': 'Workshop fullscreen',
    'header.rawPdf': 'Open original PDF in a new tab',
    'header.shortcuts': 'Keyboard shortcuts (?)',
    'header.lang': 'Choose language',

    'sidebar.search': 'Search (brake, oil, 1092, 01-14B …)',
    'tabs.chapters': '🗂️ Assemblies',
    'tabs.favorites': '⭐ Favorites',
    'tabs.checklists': '✅ Checklists',

    'search.results': 'Search results',
    'search.more': 'Load {n} more of {total}',
    'search.empty': 'No matches.',
    'search.failed': 'Search failed',
    'search.fuzzy': 'No exact matches – showing similar terms',
    'dtc.found': 'Fault code {code}: {n} documents – diagnostic sheets first',
    'dtc.unknown': 'Fault code {code} is not documented in this manual',

    'chapters.heading': 'Assembly overview (00–12)',
    'tree.heading': 'All sections (from the index)',
    'tree.loading': 'loading …',
    'tree.error': 'Section tree not available',

    'bookmarks.heading': '★ My bookmarks',
    'bookmarks.empty': 'No bookmarks yet. Use the star (★) in the header.',
    'bookmarks.added': 'Bookmark added',
    'bookmarks.removed': 'Bookmark removed',

    'notes.heading': '📝 My workshop notes',
    'notes.empty': 'No notes yet. The pen (📝) in the header opens the note panel.',
    'notes.panel': 'Workshop note',
    'notes.placeholder': 'Part numbers, torque values, notes … (saved automatically when switching)',
    'notes.save': 'Save',
    'notes.delete': 'Delete',
    'notes.saved': 'Note saved',
    'notes.close': 'Close',

    'quick.title': '2.2D injector torque values',
    'quick.verified': 'Verified against the original',
    'torque.nut1': 'Nut 1 – pre-torque:',
    'torque.nut1Loosen': 'Nut 1 – loosen:',
    'torque.nut2': 'Nut 2 – final torque:',
    'torque.pipes': 'Injection pipes:',
    'torque.rail': 'Common rail:',
    'torque.return': 'Return pipe:',
    'torque.src4': '01-14B-37, step 4',
    'torque.src5': '01-14B-37, step 5',
    'torque.src6': '01-14B-38, step 6',
    'torque.src78': '01-14B-38, steps 7–8',
    'torque.src9': '01-14B-38, step 9',
    'torque.src10': '01-14B-38, step 10',
    'checklist.back': 'Back to list',

    'loading.doc': 'Loading document …',
    'loading.error': 'Failed to load {file}',
    'jump.invalid': 'Please enter a document number',
    'paging.unavailable': 'Paging is not available for this document',

    'checklist.empty': 'No checklists available.',
    'checklist.reset': 'Reset',
    'checklist.openPage': 'Open page',

    'print.title': 'Print / export range',
    'print.text': 'Pages are rendered as an image sequence into a print window (max. 20 pages).',
    'print.from': 'From',
    'print.to': 'To',
    'print.cancel': 'Cancel',
    'print.start': 'Print',
    'print.invalid': 'Please enter valid numbers.',
    'print.max': 'Maximum 20 pages at a time.',
    'print.preparing': 'Preparing pages …',
    'print.opening': 'Opening print dialog …',
    'print.blocked': 'Popup blocked – please allow it.',
    'print.windowTitle': 'Mazda CX-5 – Print',
    'print.progress': 'Rendering {n} of {total} …',

    'shortcuts.title': 'Keyboard shortcuts',
    'shortcuts.nav': 'Navigation & paging',
    'shortcuts.view': 'View',
    'shortcuts.workshop': 'Workshop',
    'shortcuts.nextDoc': 'Next / previous document',
    'shortcuts.history': 'History back / forward',
    'shortcuts.sidebar': 'Toggle sidebar',
    'shortcuts.zoom': 'Zoom in / out',
    'shortcuts.fit': 'Fit width',
    'shortcuts.bookmark': 'Add / remove bookmark',
    'shortcuts.note': 'Open note',
    'shortcuts.print': 'Print / export range',
    'shortcuts.search': 'Focus search',
    'shortcuts.help': 'This overview',
    'shortcuts.close': 'Close dialogs',
    'shortcuts.hint': 'On a tablet: swipe left/right to page.',
    'shortcuts.ok': 'Got it',

    'chapter.00': '00 General & maintenance',
    'chapter.01': '01 Engine (2.2D & 2.0G)',
    'chapter.02': '02 Chassis & suspension',
    'chapter.03': '03 Driveline & AWD',
    'chapter.04': '04 Brakes & control systems',
    'chapter.05': '05 Transmission',
    'chapter.06': '06 Steering',
    'chapter.07': '07 Heating & air conditioning (HVAC)',
    'chapter.08': '08 Airbag & restraints',
    'chapter.09': '09 Body, lighting & electrics',
    'chapter.can': '10 Multiplex / CAN & diagnostic buses',
    'chapter.istop': '11 i-stop & start-stop system',
    'chapter.sst': 'Special service tools',
    'chapter.wiring': 'Electrical wiring diagrams',
    'chapter.body': 'Body repair (bodyshop manual)',
    'chapter.tech': 'Technical guide',

    'chapterDesc.00': 'Vehicle identification, service intervals, lubricants, fill quantities, lifting and towing points',
    'chapterDesc.01': 'Complete mechanicals: timing chain, camshafts, cylinder head, valves',
    'chapterDesc.02': 'Struts, control arms, stabilisers, wheel alignment, wheel bearings',
    'chapterDesc.03': 'Drive shafts, propeller shaft, rear differential, all-wheel drive',
    'chapterDesc.04': 'Front and rear brakes, discs, pads, parking brake',
    'chapterDesc.05': '6-speed manual (D66M-R) and 6-speed automatic transaxle',
    'chapterDesc.06': 'Electric power steering (EPS), steering gear, tie rods',
    'chapterDesc.07': 'A/C compressor, condenser, evaporator, blower motor',
    'chapterDesc.08': 'Driver and passenger airbags, side airbags, belt tensioners, crash sensors',
    'chapterDesc.09': 'Headlights, rear lights, doors, window regulators, central locking',
    'chapterDesc.can': 'CAN bus, control unit networking, communication DTCs',
    'chapterDesc.istop': 'i-stop function, battery current sensor, starter-generator, relays',
    'chapterDesc.sst': 'Overview of the Mazda special service tools with part numbers',
    'chapterDesc.wiring': '277 diagrams, harness routing, connector pinouts and ground points',
    'chapterDesc.body': '161 body documents, panel gaps, welded seams, body dimensions',
    'chapterDesc.tech': '1,790 documents on system structure, sensors and function',

    'group.00': '00 General & maintenance',
    'group.01': '01 Engine',
    'group.02': '02 Suspension',
    'group.03': '03 Driveline / Axle',
    'group.04': '04 Brakes',
    'group.05': '05 Transmission',
    'group.06': '06 Steering',
    'group.07': '07 HVAC',
    'group.08': '08 Restraints',
    'group.09': '09 Body & electrics',
    'group.10': '10 Multiplex / CAN',
    'group.11': '11 i-stop & start-stop',
    'group.12': '12 Personalisation',
    'group.wiring': 'Electrical wiring diagrams',
    'group.body': 'Body repair (bodyshop manual)',
    'group.tech': 'Technical guide',
    'group.misc': 'General'
  }
};

const LANG_KEY = 'mazda_lang';
const LANG_META = { de: { code: 'DE', name: 'Deutsch' }, en: { code: 'EN', name: 'English' } };

function currentLang() {
  const stored = localStorage.getItem(LANG_KEY);
  return stored === 'en' || stored === 'de' ? stored : 'de';
}

/** Text für einen Schlüssel, optional mit Platzhaltern {name} und Rückfalltext. */
function t(key, vars, fallback) {  const lang = currentLang();
  const dict = I18N[lang] || I18N.de;
  let text = dict[key];
  if (text === undefined) text = I18N.de[key];
  if (text === undefined) text = fallback !== undefined ? fallback : key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
    }
  }
  return text;
}

/** Wählt die deutsche oder englische Fassung eines Datenfelds (z. B. Pack-Titel). */
function pickText(de, en) {
  return currentLang() === 'en' && en ? en : de;
}

/** Setzt alle statischen Texte, Tooltips und Platzhalter. */
function applyStaticTexts() {
  const lang = currentLang();
  document.documentElement.lang = lang;
  document.title = t('app.title');

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((node) => {
    node.title = t(node.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  updateLangSwitch();
}

/** Zeigt Flagge und Kürzel der aktiven Sprache und markiert den Menüeintrag. */
function updateLangSwitch() {
  const button = document.getElementById('btn-lang');
  const menu = document.getElementById('lang-menu');
  if (!button || !menu) return;

  const lang = currentLang();
  const active = menu.querySelector(`[data-lang="${lang}"]`);
  const flag = document.getElementById('lang-flag');
  const code = document.getElementById('lang-code');

  if (flag && active) flag.innerHTML = active.querySelector('.flag').outerHTML;
  if (code) code.textContent = LANG_META[lang].code;
  button.title = t('header.lang');
  button.setAttribute('aria-label', t('header.lang'));

  menu.querySelectorAll('[data-lang]').forEach((item) => {
    const selected = item.dataset.lang === lang;
    item.classList.toggle('active', selected);
    item.setAttribute('aria-selected', String(selected));
  });
}

/** Wechselt die Sprache ohne Neuladen; app.js rendert seine Listen neu. */
function setLanguage(lang) {
  if (!I18N[lang] || lang === currentLang()) return;
  localStorage.setItem(LANG_KEY, lang);
  applyStaticTexts();
  document.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
}

function closeLangMenu() {
  const menu = document.getElementById('lang-menu');
  const button = document.getElementById('btn-lang');
  if (menu) menu.classList.add('hidden');
  if (button) button.setAttribute('aria-expanded', 'false');
}

function setupLangSwitch() {
  const button = document.getElementById('btn-lang');
  const menu = document.getElementById('lang-menu');
  if (!button || !menu) return;

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = menu.classList.toggle('hidden');
    button.setAttribute('aria-expanded', String(!open));
  });

  menu.querySelectorAll('[data-lang]').forEach((item) => {
    item.addEventListener('click', (event) => {
      event.stopPropagation();
      setLanguage(item.dataset.lang);
      closeLangMenu();
    });
  });

  document.addEventListener('click', closeLangMenu);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeLangMenu();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupLangSwitch();
  applyStaticTexts();
});
