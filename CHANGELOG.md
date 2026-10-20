# Changelog – Mazda CX-5 Service Manual Viewer

Alle wichtigen Änderungen und Meilensteine an diesem Projekt werden in dieser Datei fortlaufend dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

---

## [1.7.0] - 2026-10-20

### Volltext & Suchbarkeit (P1)
- **PDF.js-Volltext als Rückfallebene** (TODO 2.4): 1.007 Seiten lieferten keinen Text, weil der eigene
  Stream-Extraktor nur literale `(…)Tj`-Strings liest und an den Hex-Strings dieser Dateien scheitert —
  nicht, wie seit v1.4.0 angenommen, weil es reine Bildseiten wären. `tools/titles.js` liefert jetzt
  Titel **und** Seitentext in einem PDF.js-Durchlauf; `build_index.js` nutzt den Text, sobald
  `extractText()` leer bleibt.
- **Keywords 6.285 → 7.041 (86,2 % → 96,5 %)**, Sektionscodes 6.221 → 6.302, Titel 5.256 → 5.357 (73,4 %).
- **Kopf-/Fußzeilen-Filter:** „BACK TO CHAPTER INDEX", „TO MODEL INDEX" und „MAZDA CX5 …" werden vor der
  Keyword-Bildung entfernt — sonst hätten die verbleibenden Zeichnungsseiten nur Boilerplate-Keywords.
- **OCR der Zeichnungsseiten** (TODO 2.4): Die 251 verbleibenden Seiten sind Schaltplan- und
  Karosseriezeichnungen, deren Beschriftungen als **Vektorpfade** gezeichnet sind — sie stehen in keinem
  Textstrom, werden aber beim Rendern sichtbar. Erste Messung am eingebetteten Rasterbild ergab 0 Zeichen;
  der Fehler war, das Rendering nicht zu prüfen.
  - Pipeline: `tools/ocr_pages.py` (PyMuPDF, 200 dpi) → `tools/ocr_batch.ps1` (Windows-OCR, de-DE) →
    `tools/ocr_merge.js` → `config/ocr_text.json` (203 KB, versioniert, damit ein Rebuild keine erneute
    OCR braucht)
  - **253 Seiten** erkannt, Ø 756 Zeichen; Titel aus der ersten OCR-Zeile („ELECTRONIC 4WD CONTROL SYSTEM",
    „AUTOMATIC TRANSAXLE CONTROL SYSTEM")
  - OCR-Text ist naturgemäß fehlerbehaftet („BAITERY", „[CRAY]") — für Stichworte reicht es, für Zitate nicht
- **Endstand:** Keywords **7.292 (100 %)**, Titel **5.608 (76,9 %)**, Sektionscodes 6.302, keine Seite
  ohne Text mehr.
- **Suche:** „4WD" findet 264 Dokumente, „Solenoid" 273 — vorher nur über die Kapitelstruktur erreichbar.
- **Ranking:** Mit dem neuen Volltext zog die Technical-Guide-Seite bei „Klima" erneut am HVAC-Kapitel
  vorbei — Gruppen-Boost 55 → 65 (`server.js`), Suchtests wieder 15/15.
- Index 4,30 MB (< 6 MB), Build 139 s.

### Verifiziert
- `npm run validate` → OK (7.294 Dokumente, 0 ungültige Sektionscodes, 53 Pack-Verweise)
- `npm test` → 47 API- und 15 Suchprüfungen grün
- OCR-Gegenprobe: erzeugtes Textbild wird korrekt gelesen; gerenderte Schaltplanseite liefert
  „4WD SOLENOID", „4WD CONTROL MODULE", „DIFFERENTIAL OIL TEMPERATURE SENSOR"

---

## [1.6.0] - 2026-10-20

### Titel & Suche (P1)
- **Titel aus dem PDF-Layout** (TODO 2.2): Neu `tools/titles.js`. PDF.js liefert über
  `getTextContent()` je Textstück Position (`transform`) und Höhe; daraus werden Zeilen gebaut.
  - Kopfband (y ≥ 762) und Fußband (y ≤ 60) werden verworfen — Kopfzeile und Sektionscode können
    nicht mehr als Titel enden (vorher z. B. „BEFORE SERVICE PRECAUTION" auf `…1092.pdf`).
  - Überschrift = Zeile mit Verfahrensbegriff am Ende (REMOVAL/INSTALLATION, INSPECTION,
    LOCATION INDEX …), bewertet nach Einzug, Höhe im Blatt und Schriftgröße.
  - Fallback für Technical-Guide-Seiten: oberste Zeile im Kopfbereich („Operation", „Structural View").
  - Letzter Fallback bleibt die alte Text-Heuristik.
  - Qualitätsfilter: 8–95 Zeichen, balancierte Klammern, keine Punktierungs-Lineale, keine
    Flowchart-Zeilen („Yes/No"), keine Sektionscodes.
- **Abdeckung:** 3.664 → **5.256 Titel (50,2 % → 72,1 %)**. Stichprobe über 304 Seiten:
  50,0 % → 69,7 %; Workshop 65,3 % → 83,3 %, Technical Guide 12,5 % → 54,3 %,
  Bodyshop 27,3 % → 62,1 %. `…1092.pdf` und `…955.pdf` tragen jetzt ihren echten Titel,
  `…1094.pdf` und `…1573.pdf` erstmals einen.
- **Ranking angepasst:** Mit den besseren Titeln zog ein Technical-Guide-Dokument bei „Klima" vor
  das HVAC-Kapitel — der Gruppen-Boost für deutsche Alltagsbegriffe steigt von 45 auf 55 (`server.js`).
- **Index:** 5.256 Titel, 3,88 MB, Build 155 s. Keine neue Abhängigkeit: Der vorhandene
  PDF.js-Build aus `public/vendor` läuft in Node, wenn das Worker-Bundle vorab als
  `globalThis.pdfjsWorker` geladen wird.

---

## [1.5.1] - 2026-10-20

### Korrektheit (P1)
- **Injektor-Drehmomente belegt** (TODO 1.4): Die Karte „2.2D Injektor-Drehmomente" ist Zeile für Zeile
  gegen die Originalseiten geprüft; jede Zeile verlinkt ihre Quelle.
  - Mutter 1 – Voranzug 1,8–2,2 N·m, Lösen −30° bis −150° (`01-14B-37`, Schritte 4–5)
  - Mutter 2 – Endzug 1,8–2,2 N·m + **177–183°** statt „+ 180°" ohne Toleranz (`01-14B-38`, Schritt 6)
  - Einspritzleitungen 32–42 N·m (`01-14B-38`, Schritte 7–8; in `01-14B-34` bestätigt)
  - Rücklaufleitung Injektorseite 22–26 N·m (`01-14B-38`, Schritt 10) — die zuvor offene Seite ist belegt
  - **Ergänzt:** Common Rail 20–26 N·m (`01-14B-38`, Schritt 9), wird beim Injektortausch gelöst und wieder angezogen
  - Nicht übernommen: Klammer der Pumpenseite 4,2–5,2 N·m (`01-14B-34`) — gehört nicht zum Injektortausch
- **Quellenlinks** in der Karte springen auf die Seite (`data-file`); `.inline-link[data-file]` wird jetzt
  im Delegated Click-Handler von `public/app.js` behandelt (vorher ohne Funktion).
- Darstellung: die Quellenangabe steht klein unter dem Wert und rechtsbündig, damit die 280 px breite
  Karte in der Seitenleiste nicht überläuft (`public/style-v14.css`).

---

## [1.5.0] - 2026-10-20

Projekt-Hygiene (Paket A): Das Projekt ist jetzt ohne `C:\Temp`, ohne Handarbeit und ohne laufenden
Server testbar — Voraussetzung für Rechnerwechsel und für die nächsten inhaltlichen Pakete.

### Daten & Pfade
- **PDFs im Projekt**: 7.294 Dateien (451 MB) liegen unter `data\`; der `C:\Temp`-Pfad ist aus
  `server.js`, `build_index.js` und `tools/validate.js` verschwunden.
- **`lib/paths.js`** löst das Handbuch-Verzeichnis an einer Stelle auf: `MANUAL_DIR` →
  `config/settings.json` (`manualDir`) → `data\`. Alle drei Einstiegspunkte nutzen den Resolver.
- **`config/settings.json`** neu, mit `{ "manualDir": "data" }` als Standard.
- **Startprüfung**: fehlendes Verzeichnis beendet den Server mit einer Anleitung und Exit-Code 1
  (statt einer 404-Serie); PDF-Anzahl ≠ Index-Länge erzeugt eine Warnung mit Handlungsanweisung.
- **`/api/status`** nennt zusätzlich `manualDirSource` (welche der drei Quellen gegriffen hat).

### Projektstruktur
- **`package.json`** mit Scripts `start`, `start:open`, `index`, `packs`, `validate`, `test`,
  `test:api`, `test:browser`; `engines.node >= 18`; keine Laufzeit-Abhängigkeiten.
- **`npm test` ohne Vorbereitung**: `tools/run_tests.js` validiert Index und Konfiguration, startet
  den Server selbst auf Port 3480–3539, führt API-Vertrag (47 Prüfungen) und Suchtests (15) aus und
  beendet ihn wieder. Ein bereits laufender Viewer auf 3300 bleibt unberührt.
- **`README.md`** neu: Start, Datenherkunft, Aufbau, Bedienung, Pfad-/Port-Konfiguration, Tests,
  bekannte Grenzen, Rechtehinweis.
- **`START_VIEWER.bat`**: prüft Node.js und bricht mit verständlicher Meldung und Exit-Code 1 ab;
  zeigt nach dem Beenden den zuletzt genutzten Port aus `.active_port`.
- **Git**: Repository auf `main` mit `.gitignore` (PDFs, `_backup/`, `.active_port`, `node_modules/`,
  Logs) und erstem Commit; `public/search_index.json` ist versioniert, `data/` nicht.

### Verifiziert
- `npm run validate` → OK (7.294 Dokumente, 0 ungültige Sektionscodes, 53 Pack-Verweise)
- `npm test` → 47 API-Prüfungen + 15 Suchtests grün, Server gegen `data\`
- `START_VIEWER.bat` ohne Node im `PATH` → klare Meldung, Exit-Code 1

---

## [1.4.0] - 2026-10-20

### Sicherheit (P0)
- **Path-Traversal geschlossen**: `/pdf/` und `/public/` lösen Pfade nur noch über `safeJoin()` auf; `..%2F`, `%2e%2e`, UNC und NUL-Bytes liefern 404.
- **CORS-Wildcard entfernt** (`Access-Control-Allow-Origin: *`), dadurch ist die Dateiauslieferung nicht mehr aus fremden Webseiten lesbar.
- Sicherheits-Header `X-Content-Type-Options: nosniff` und `Referrer-Policy: no-referrer`; Endungs-Whitelist für statische Dateien.

### Korrektheit (P1)
- **Reparatur-Packs generiert** (`tools/build_packs.js` → `config/packs.json`): Sektion + Titel-Muster, ergänzt um geprüfte Kernseiten. Die 19 falschen Linkziele (u. a. „Bremsbeläge" → DSC-Diagnose) sind beseitigt.
- **Kapitel korrigiert** (`config/chapters.json`): 00 → echter TOC, DTC-Karte → Multiplex/CAN, SST-Karte → Spezialwerkzeuge (00-00-2), Bremsen-Unterseiten richtig verlinkt; Gruppen 10–12 ergänzt.
- **Sektionscodes repariert**: 0x85/0x96/0x97 werden normalisiert; statt 1.201 ungültiger Codes jetzt **0**. Häufigster Code einer Seite gewinnt (Querverweise zählen nicht mehr).
- **Titel-Extraktion überarbeitet**: Kandidatenbewertung, Artefakt-Bereinigung (IDs, Punktierungs-Lineale, doppelte Wortfolgen) – 50,2 % statt 46,8 %, aber ohne die alten Schnipsel.
- **Dateifamilien richtig einsortiert**: die 91 `electrical_wiring_manual*`-Dateien (Mechanikseiten 00-00/01-10) sind jetzt Werkstatthandbuch statt „Schaltpläne".
- **Build-Report** am Ende von `build_index.js`; `MANUAL_DIR` per Umgebungsvariable.
- **`tools/validate.js`**: prüft Index, Kapitel, Packs und Checklisten gegeneinander (Exit-Code für CI).

### Suche (P2)
- **Neue Such-Engine**: Wortgrenzen über gepolsterte Token statt Teilstring, IDF-Gewichtung, Phrasen-Synonyme (normalisiert, „ö" → „oe"), Gruppen-Boost, Paging (`limit`/`offset`/`total`) und Tippfehler-Fallback.
- **Wirkung** (gemessen): „Klima" 4.719 → 195 Treffer, „Luftfilter" 0 → 75, „Ölwechsel" 12 präzise Treffer, „Öl" ohne `coil spring`-Rauschen.
- Wörterbuch um ~30 Begriffe erweitert (Luftfilter, Achsvermessung, Spurstangenkopf, Kurbelwellensensor, Raildruck, Wärmetauscher …).
- **`tools/search_test.js`**: 15 Regressionstests gegen den laufenden Server (15/15 grün).
- **Seite schrumpft nicht mehr im Flex-Container** (`flex: 0 0 auto`): nach Zoom bzw. „Breite anpassen" saßen Hotspots sonst verschoben, weil die Seite zwar skaliert, aber auf Containergröße gestaucht wurde.
- **`tools/browser_test.js`**: 27 End-to-End-Prüfungen mit Playwright in echtem Chrome (optional, benötigt `playwright`).
- **`tools/api_contract_test.js`**: 47 Prüfungen der Schnittstellen, die das Frontend erwartet (Felder, Paging, Rotation, Traversal-Schutz).
- **`tools/ui_test.js`**: 23 End-to-End-Prüfungen im echten Browser (Checklisten, Suche, Live-Highlight, Hotspots auf gedrehten Schaltplänen, Konsolenfehler).

### Viewer & Bedienung (P2)
- **Verdrehte Schaltpläne**: Hotspots werden über `viewport.convertToViewportRectangle()` platziert – korrekt auf allen 254 Seiten mit `/Rotate 90`; „Breite anpassen" nutzt die Viewport-Breite.
- **Bugfixes**: Prefetch nutzt jetzt `link.target`; Lesezeichen-Löschen navigiert nicht mehr mit; Sprungfeld funktioniert auch auf `front_page.pdf`; LRU-Cache ruft `destroy()` auf; Klicks während des Renderns werden gequeued statt verworfen; Notizen werden beim Dokumentwechsel automatisch gesichert; Nutzertexte werden escaped.
- **Neu**: Live-Highlight beim Tippen, „weitere Treffer laden", Checklisten (Injektoren, Bremsen vorn, Ölwechsel) mit Fortschritt, Druck/Export eines Seitenbereichs, Werkstatt-Vollbild, Touch-Wischen, Tablet-Media-Queries (Touch-Ziele ≥ 44 px).

---
## [1.3.0] - 2026-10-20

### Hinzugefügt (Pre-Caching, Tastatur-Hilfe & Port-Fallback)
- **Pre-Caching der Nachbarseiten (Zero-Latency Paging)**:
  - Automatisches Vorladen des nächsten und vorherigen PDFs sowie wichtiger Querverweise direkt nach dem Rendern der aktuellen Seite.
  - Implementierung eines LRU-RAM-Caches (`docCache`, max. 16 Dokumente) im Frontend.
  - Sequentielles Blättern (<kbd>←</kbd> / <kbd>→</kbd> oder Pager) erfolgt in ca. 10 Millisekunden ohne sichtbaren Ladebalken.
- **Tastatur-Hilfe (Modal Dialog)**:
  - Neues modales Hilfefenster im Frosted-Glass Dark-Design, aufrufbar per Taste <kbd>?</kbd> (oder <kbd>Shift</kbd> + <kbd>/</kbd>) sowie über den neuen Header-Button `?`.
  - Übersichtliche Unterteilung in *Navigation & Blättern*, *Ansicht & Zoom* sowie *Werkstatt & Suche*.
  - Gestylte Tastatur-Kappen (`<kbd>`) und Schließen per <kbd>Esc</kbd> oder Klick auf den Hintergrund / Button.
- **Automatischer Port-Fallback (`server.js`)**:
  - Falls Port 3300 belegt ist (`EADDRINUSE`), weicht der Server automatisch auf den nächsten freien Port (3301, 3302...) aus.
  - Speichert den jeweils aktiven Port in `.active_port`.
  - Neues `--open` Flag und Status-Endpoint `/api/status`.
  - Anpassung der [`START_VIEWER.bat`](file:///c:/Projekte/Tools/mazda-manual-viewer/START_VIEWER.bat) zum nahtlosen Starten und automatischen Öffnen des Browsers auf dem ermittelten Port.

---

## [1.2.0] - 2026-10-20

### Hinzugefügt (Textauswahl, Notizen, Lesezeichen & Highlighting)
- **Textauswahl & Copy-Paste (PDF.js TextLayer)**:
  - Vollständiger transparenter TextLayer über dem Canvas gerendert (`--scale-factor` synchronisiert).
  - Sämtliche Texte im Handbuch (Drehmomente, Prüfschritte, Teilenummern, Warnhinweise) können mit der Maus markiert und kopiert werden.
  - Native Auswahl-Optik mit Sky-Blue Hintergrund (`rgba(56, 189, 248, 0.45)`).
- **Eigene Lesezeichen & Werkstatt-Notizen (LocalStorage)**:
  - **Stern-Symbol (★)** im Header: Jedes beliebige Dokument kann mit einem Klick zur Favoriten-Liste hinzugefügt oder entfernt werden.
  - **Notizfeld (📝)** pro Dokument: Schiebbares Notiz-Drawer zum Erfassen von Anmerkungen, Erfahrungswerten und Ersatzteilnummern.
  - **Roter Indikator-Dot**: Zeigt im Header sofort an, wenn für das aktuelle Dokument eine Notiz hinterlegt ist.
  - **Neuer Sidebar-Tab `⭐ Favoriten & Notizen`**: Listet alle gespeicherten Lesezeichen und Notizen mit Datumsstempel und Direktlink auf.
  - Vollständig persistent im Browser (`localStorage.setItem('mazda_bookmarks')` & `localStorage.setItem('mazda_notes')`).
- **Suchbegriff-Hervorhebung (Highlighting & Relevanz-Ranking)**:
  - **In der Trefferliste**: Suchbegriffe und deren Synonyme werden in Titeln und Text-Snippets mit `<mark class="search-match">` leuchtend hervorgehoben.
  - **Im PDF-Dokument**: Fundstellen im TextLayer erhalten automatisch einen goldenen Highlight-Rahmen (`span.search-highlight`).
  - **Zweisprachige Synonym-Hervorhebung**: Suchbegriffe (z. B. *"Injektor"*) markieren auch die englischen Entsprechungen (*"Injector"*, *"Fuel"*) direkt auf der Seite.
  - **Relevanz-Ranking**: Treffer in Abschnittscodes und Titeln werden vor reinem Volltext priorisiert.
  - **Textauszug / Snippet**: Zeigt bei Volltext-Treffern den relevanten Kontextsatz im Suchergebnis an.

---

## [1.1.0] - 2026-10-20

### Hinzugefügt (Universal Portal & Global Index)
- **Vollständiger Mazda-Baugruppenbaum (Gruppen 00 bis 09 + Spezialkataloge)**:
  - Integration der offiziellen Mazda-Kapitelhierarchie in der linken Seitenleiste:
    - **00:** Allgemein & Wartungsplan
    - **01:** Motor (2.2D & 2.0G – Mechanik, Steuerkette, Ölkreislauf, Kühlung, Turbolader, Kraftstoff, DPF, Elektrik, PCM)
    - **02:** Fahrwerk & Radaufhängung (Querlenker, Dämpfer, Federn, Achsvermessung)
    - **03:** Antriebsstrang & Allrad (Antriebswellen, Differential, Kardanwelle, AWD)
    - **04:** Bremsen & Regelsysteme (Vorder-/Hinterachse, Beläge, Scheiben, Handbremse, ABS/DSC)
    - **05:** Getriebe (6-Gang Schaltgetriebe C66M-R & 6-Stufen Automatik FW6A/GW6A)
    - **06:** Lenkung (Elektrische Servolenkung, Lenkgetriebe, Spurstangen)
    - **07:** Heizung & Klimaanlage (HVAC, Kompressor, Kondensator, Gebläse)
    - **08:** Airbag & Rückhaltesysteme (Crashsensoren, Gurtstraffer)
    - **09:** Karosserie, Beleuchtung & Bordnetz (Scheinwerfer, Türen, Fensterheber, Sicherungskästen)
    - **OBD2/DTC:** Vollständige Fehlercode-Tabelle
    - **SST:** Spezialwerkzeuge mit Mazda-Teilenummern
    - **Schaltpläne:** 277 elektrische Wiring-Diagrams
    - **Karosserie:** Bodyshop-Manual für Richt- und Spaltmaße
    - **Technical Guide:** 1.790 Funktions- und Systembeschreibungen
- **Vollständiger Offline-Suchindex (`public/search_index.json`)**:
  - Alle **7.294 PDF-Dateien** vorindiziert (1,02 MB) mit Dateinamen, Abschnittscodes, bereinigten Titeln und Baugruppenzuordnung.
  - Lädt beim Serverstart direkt in den RAM für Suchantwortzeiten unter 5 Millisekunden.
- **Intelligente zweisprachige Suche (Deutsch ⇄ Englisch)**:
  - Automatisches Synonym-Mapping (z. B. Suche nach *"Bremse"* findet *"BRAKE/DISC"*, *"Öl"* findet *"OIL/LUBRICATION"*, *"Fahrwerk"* findet *"SUSPENSION"*, *"Klima"* findet *"HEATER/HVAC"* etc.).
- **Tabs in der Seitenleiste**:
  - `🗂️ Baugruppen`: Vollständiger, aufklappbarer Kapitelbaum für alle Arbeiten am Fahrzeug.
  - `⭐ Reparaturen`: Themenbezogene Schnellzugriff-Pakete (Injektoren, Bremsen-Service, Ölservice & Ölsieb, Steuerkette & Nockenwellen, DPF & Turbo).
  - `🔍 Suche`: Live-Ergebnisliste beim Tippen im Suchfeld.
- **Erweiterte Link-Tooltips**:
  - Beim Überfahren eines Links im PDF wird nun neben dem Zieldateinamen auch der lesbare Titel des Zielkapitels angezeigt.

---

## [1.0.0] - 2026-10-20

### Hinzugefügt (Initial Release)
- **Leichtgewichtiger nativer Node.js Backend-Server (`server.js`)**:
  - Null externe npm-Abhängigkeiten (nutzt ausschließlich Node.js Core-Module wie `http`, `fs`, `path`, `zlib`).
  - Schnelles Streaming aller 7.294 Werkstatt-PDFs aus `C:\Temp\Mazda CX5 2.2D Manual\Mazda CX5 2012-2013 service_manual`.
  - **On-the-fly Link-Extraktion (`/api/links/:file`)**: Liest PDF-Annotations (`/Subtype /Link`) und extrahiert `GoToR`-Aktionen samt Ziel-PDF und Koordinaten in wenigen Millisekunden mit In-Memory-Caching.
  - Bereinigte Titel- und Abschnittsextraktion (filtert PostScript/CIDInit-Header aus).
- **Interaktives Frontend (`public/index.html`, `public/style.css`, `public/app.js`)**:
  - Modernes Automotive Dark-Theme (Obsidian-Hintergrund `#0b0f19`, Mazda Soul-Red `#e11d48` und Sky-Blue `#38bdf8` Akzente).
  - **Interaktiver Hotspot-Overlay**: Legt klickbare Boxen exakt über alle im Handbuch verlinkten Stellen (z. B. `BACK TO CHAPTER INDEX`, `TO MODEL INDEX`, Bauteil-Links wie `See 01-14B-37`).
  - Nahtloser Dokumentenwechsel per Klick ohne Neuladen der Seite.
  - Hover-Tooltips mit Anzeige des Ziel-Dateinamens.
  - Toggle-Schalter ("Links markieren"), um klickbare Bereiche visuell hervorzuheben oder auszublenden.
  - Vollständiger Browser-Verlauf (Zurück / Vorwärts) mit synchronisiertem URL-Hash (`#dateiname.pdf`).
  - Blätter-Funktion für sequenzielle Dokumente (Vorherige / Nächste Seite) und Direkteingabe der Dokumentnummer.
  - Zoom-Steuerung (Vergrößern, Verkleinern, Breite anpassen, Prozentanzeige).
  - Tastatur-Shortcuts (<kbd>←</kbd> / <kbd>→</kbd> zum Blättern, <kbd>Alt</kbd> + <kbd>←</kbd> / <kbd>→</kbd> für Verlauf, <kbd>+</kbd> / <kbd>-</kbd> für Zoom).
- **Injektor 2.2 Skyactiv-D Fokus**:
  - Permanenter Spickzettel für alle Anzugsdrehmomente (Voranzug 1,8–2,2 Nm, Lösewinkel -30° bis -150°, Endzug 1,8–2,2 Nm + 180° Drehwinkel, Einspritzleitungen 32–42 Nm, Rücklaufleitung 22–26 Nm).
  - Favoriten-Leiste mit 11 kuratierten Direkteinstiegen für die Injektor-Instandsetzung (`1092`, `1093`, `1094`, `1095`, `1096`, etc.).
- **Offline-Fähigkeit & Starter**:
  - Lokale Einbindung von Mozilla `PDF.js` (`pdf.min.js` und `pdf.worker.min.js` im Ordner `/public/vendor/`).
  - Windows Batch-Starter `START_VIEWER.bat` zum Starten per Doppelklick und automatischem Browseraufruf.
