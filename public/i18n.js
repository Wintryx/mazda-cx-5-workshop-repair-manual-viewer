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
    'header.lang': 'Auf Englisch umschalten',
    'lang.button': 'EN',

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
    'header.lang': 'Switch to German',
    'lang.button': 'DE',

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
    'shortcuts.ok': 'Got it'
  }
};

const LANG_KEY = 'mazda_lang';

function currentLang() {
  const stored = localStorage.getItem(LANG_KEY);
  return stored === 'en' || stored === 'de' ? stored : 'de';
}

/** Text für einen Schlüssel, optional mit Platzhaltern {name}. */
function t(key, vars) {
  const lang = currentLang();
  let text = (I18N[lang] && I18N[lang][key]) || (I18N.de[key]) || key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
    }
  }
  return text;
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
  const toggle = document.getElementById('btn-lang');
  if (toggle) {
    toggle.textContent = t('lang.button');
    toggle.title = t('header.lang');
  }
}

/** Wechselt die Sprache und lädt die Seite neu (rendert alle Listen frisch). */
function toggleLanguage() {
  localStorage.setItem(LANG_KEY, currentLang() === 'de' ? 'en' : 'de');
  location.reload();
}

document.addEventListener('DOMContentLoaded', applyStaticTexts);
