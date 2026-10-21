# Roadmap & TODOs – Mazda CX-5 Service Manual Viewer

**Stand:** v1.9.0 · 20.10.2026
**Grundlage:** vollständige Code- und Datenanalyse (7.294 PDFs, alle API-Endpunkte, Index-Auswertung, Testinstanz auf Port 3399)

Diese Liste enthält alle offenen Punkte, um den Viewer sicher, korrekt und am Werkstattarbeitsplatz (Tablet/Laptop am Auto) universell nutzbar zu machen. Abgehakte Punkte wandern nach unten in die Versionshistorie.

**Legende:** 🔴 Blocker · 🟠 hoch · 🟡 mittel · 🔵 niedrig
**Format je Punkt:** Problem → Datei/Zeile → Maßnahme → *Fertig, wenn …* (abgehakte Punkte beschreiben den ursprünglichen Befund und wie er behoben wurde)

> **v1.4.0 umgesetzt:** P0 vollständig, P1 (außer 1.4, 2.2, 2.4) und P2 vollständig. Verifiziert mit `tools/validate.js` (OK) und `tools/search_test.js` (15/15).
>
> **v1.5.0 umgesetzt:** Paket A (Projekt-Hygiene: 5.1–5.4, 5.7). Verifiziert mit `npm test` (47 API- + 15 Suchprüfungen) gegen `data\`.
>
> **v1.5.1 umgesetzt:** Paket B (1.4 – Injektor-Drehmomente gegen die Originalseiten belegt und verlinkt).
>
> **v1.6.0 umgesetzt:** Paket C (2.2 – Titel aus dem PDF-Layout, 50,2 % → 72,1 %).
>
> **v1.7.0 umgesetzt:** Paket D (2.4 – Volltext über PDF.js nachgezogen; OCR der Zeichnungsseiten).
>
> **v1.8.0 umgesetzt:** 6.1 Sektionsbaum, 6.2 Gruppen 10–12, 5.9 Playwright-Test ohne Vorbereitung.
>
> **v1.9.0 umgesetzt:** 6.3 Fehlercode-Suche (P0301 → Diagnoseblatt) inkl. `/api/dtc`.

---

## 🎯 Nächste Schritte (v1.10.0)

Die vier großen Pakete **A–D**, der Kapitelbaum und die Fehlercode-Suche sind erledigt (siehe unten).
Offen, nach Nutzen sortiert:

| Punkt | Inhalt | Aufwand | Bringt |
|---|---|---|---|
| **7.1** | Windows-EXE mit Electron (ohne Node lauffähig) | ~1 Tag | Weitergabe an Werkstatt-PC ohne Installation |
| **5.5** | Smoke-Test mit `node --test` | ~1 h | schnellere Rückmeldung als die jetzigen Skripte |
| **5.6** | `.active_port` beim Beenden aufräumen | ~15 min | keine irreführende Datei |
| **5.8** | Range-Requests (206), Request-Log | ~1 h | sauberes HTTP und Fehlersuche |
| **6.5** | Zweites Handbuch (L8/LF/L3) | ~3 h | Motorenreihe L |
| **6.6** | Reparaturprotokoll | ~4 h | Historie für Wiederverkauf |

---

## 🔴 P0 – Sicherheit (vor der nächsten Nutzung erledigen)

### [x] 0.1 Path-Traversal im `/pdf/`-Handler schließen
`decodeURIComponent()` + `path.join()` ohne Prüfung erlauben den Zugriff auf beliebige lokale Dateien (`..%2F` wird vom URL-Parser nicht normalisiert).

- **Ort:** [`server.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/server.js)
- **Belegt:** `GET /pdf/..%2F..%2F..%2F..%2FWindows%2Fwin.ini` → 200 mit 92 Bytes; `…/server.js` → 200 mit 22.755 Bytes
- **Maßnahme:** zentrale `safeJoin(root, rel)`-Funktion (`path.resolve` + `path.relative`, `..`/absolut → 403), Pfad **vor** `existsSync` prüfen
- **Fertig, wenn:** alle Traversal-Varianten (`..%2F`, `%2e%2e%2f`, doppelt kodiert, `\`, UNC) 403/404 liefern und normale PDFs weiter 200

### [x] 0.2 `/public/`-Zweig identisch härten
- **Ort:** [`server.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/server.js)
- Aktuell nur deshalb unkritisch, weil hier nicht dekodiert wird. Gleiche `safeJoin`-Prüfung + Positivliste der erlaubten Dateiendungen (`.html/.js/.css/.json/.png/.svg`)
- **Fertig, wenn:** `/public/%2E%2E%2Fserver.js` weiterhin 404 liefert **und** die Prüfung nicht vom Dekodierungsverhalten abhängt

### [x] 0.3 CORS-Wildcard entfernen, Header härten
- **Ort:** [`server.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/server.js)
- `Access-Control-Allow-Origin: *` auf **allen** Antworten macht 0.1 aus jeder nebenbei geöffneten Webseite ausnutzbar (lokales Auslesen per `fetch`). Der Viewer ist Same-Origin → Header ersatzlos streichen
- Zusätzlich: `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'self' 'unsafe-inline'` (Inline-Styles im HTML beachten), `Referrer-Policy: no-referrer`
- **Fertig, wenn:** Response-Header geprüft sind und der Viewer unverändert funktioniert

### [x] 0.4 Optional: Positivliste statt Pfadprüfung
- Nur Dateinamen ausliefern, die im Index stehen (`byFile.has(name)`); alles andere 404
- Vorteil: schließt auch künftige Pfad-Fehler aus, Kosten: eine Map-Suche pro Request (siehe 2.5)

---

## 🔴 P1 – Inhaltliche Korrektheit (Werkstattrisiko)

### [x] 1.1 Reparatur-Packs: 19 von 32 Links zeigen auf falsche Seiten
Die kuratierten Sets in `/api/favorites` wurden nie gegen den Index geprüft. Nur der Injektor-Pack ist durchgehend korrekt.

| Eintrag (Anspruch) | Datei heutig | Tatsächlicher Inhalt | Korrekte Datei |
|---|---|---|---|
| Vorderradbremse Beläge/Scheiben `04-11-3` | `…1573.pdf` | **04-02A-6 DSC-Diagnose** | Belag `…1696/1697.pdf` (04-11-28/29)<br>Scheibe `…1693/1694.pdf` (04-11-25/26) |
| Hinterradbremse `04-12-3` | `…1580.pdf` | **04-02A-13 DSC, C0040** | `…1707/1708.pdf` (04-12-1) |
| Bremsflüssigkeit `04-10-3` | `…1570.pdf` | **04-02A-3 ABS-Schaltplan** | Prüfung `…1675.pdf` (04-11-4); Wechsel-/Entlüftungsseite noch verifizieren |
| Schmiersystem 2.2D `01-11B-1` | `…869.pdf` | **01-12A-1 Kühlsystem (2.0G!)** | `…840.pdf` (01-11B-1), Ölstand `…842.pdf` (01-11B-3) |
| Steuerkette `01-10B-1` | `…822.pdf` | **01-11A-1 Schmiersystem 2.0G** | `…720.pdf` (01-10B-16) |
| Turbolader `01-13B-7` | `…930.pdf` | **Air-Cleaner-Deckel** | `…955.pdf` (01-13B-32) |
| Ladeluftkühler `01-13B-12` | `…935.pdf` | **Air-Hose-Montage** | im Index verifizieren |
| DPF `01-16B-3` | `…1130.pdf` | **01-15B-2 Abgasanlage** | `…1128.pdf` (01-15B-1) |
| AGR-System `01-17B-1` | `…1162.pdf` | **01-16B-1 Emissionssystem** | `…1168.pdf` (01-16B-7) |

- **Ort:** [`server.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/server.js)
- **Maßnahme:** Packs künftig **generieren** (`tools/build_packs.js`: Sektion + Titel-Regex → Datei), nicht mehr von Hand pflegen
- **Fertig, wenn:** jedes Pack-Item eine existierende Datei nennt, deren Sektionscode zum Anspruch passt und deren Titel das Verfahren enthält (Prüfung siehe 1.3)

### [x] 1.2 Drei Kapitelkarten zeigen das Falsche
- **Ort:** [`server.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/server.js)
- **„00 Allgemein"** → `…6.pdf` ist die VIN-Seite (00-00-4); echter TOC ist `…3.pdf`
- **„Fehlercodes & Diagnose (DTC Index)"** → `…4687.pdf` ist der Multiplex-TOC (10-02). Eine globale DTC-Tabelle existiert **nicht** (nur 1 von 7.294 Seiten nennt eine „DTC table": `…2606.pdf`). Entweder Karte umbenennen in „Multiplex/CAN & Diagnosebusse" oder eine generierte DTC-Übersicht bauen (siehe 6.3)
- **„Spezialwerkzeuge (SST)"** → `…4921.pdf` ist der i-stop-TOC (11). Echte SST-Seiten: `00-00-2` in `mazda_cx5_electrical_wiring_manual6.pdf`, `00-00-7` in `mazda_cx5_electrical_wiring_manual11.pdf`
- **Fertig, wenn:** jede Karte auf eine Seite zeigt, deren Volltext das Kartenversprechen enthält

### [x] 1.3 Automatischer Abgleich (`tools/validate.js`)
- Prüft bei jedem Start bzw. als `npm run validate`:
  1. jede in `chapters`/`favorites` genannte Datei existiert
  2. Sektionscode der Datei passt zum Anspruch
  3. Index-Länge == Anzahl PDFs im Datenverzeichnis
  4. alle `sec`-Werte matchen `^\d{2}-\d{2}[A-Z]?-\d+$`
  5. jede Sektion hat einen TOC-Kandidaten
- **Fertig, wenn:** der Check mit Exit-Code 0 läuft und die heutigen 19 Fehler als Fehler meldet

---

## 🟠 P1 – Index & Datenqualität

### [x] 2.1 Sektionscodes reparieren (1.201 von 6.221 betroffen)
- **Ort:** [`build_index.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/build_index.js)
- Ursache: Im PDF steht `0x85` (Gedankenstrich), der Code ersetzt aber das *literale* `\205` → `"01-14A\x8516"` statt `"01-14A-16"`
- **Maßnahme:** `full.replace(/[\u0080-\u009f\u00ad]/g, '-')` vor dem Match, dann strikt `(\d{2})-(\d{2})([A-Z]?) - (\d{1,3})` zusammensetzen; Trefferquote im Build-Log ausgeben
- **Fertig, wenn:** 0 fehlerhafte Codes und `01-10A-16` usw. per Suche auffindbar

### [x] 2.2 Titel aus dem PDF-Layout *(v1.6.0: 50,2 % → 72,1 %)*
- **Ort:** [`build_index.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/build_index.js), neu: [`tools/titles.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/tools/titles.js)
- **Ist-Zustand v1.4.0:** 3.664 Titel (50,2 %); die Heuristik riet, weil der Text ohne Position extrahiert wurde (auf `…1092.pdf` stand „BEFORE SERVICE PRECAUTION" statt „FUEL INJECTOR REMOVAL/INSTALLATION")
- **Lösung:** `getTextContent()` liefert `transform` (x/y) und `height`; daraus werden Zeilen gebaut
  1. Kopfband (y ≥ 762) und Fußband (y ≤ 60) werden verworfen — Kopfzeile und Sektionscode können so nicht mehr als Titel enden
  2. Überschrift = Zeile mit Verfahrensbegriff am Ende (REMOVAL/INSTALLATION, INSPECTION, LOCATION INDEX …), bewertet nach Einzug (x), Höhe (y) und Schriftgröße; bei Gleichstand gewinnt die obere Zeile
  3. Fallback für Technical-Guide-Seiten: oberste Zeile im Kopfbereich („Operation", „Structural View"), mit Filter gegen Tabellenköpfe und Satzfragmente
  4. Letzter Fallback bleibt die alte Text-Heuristik, damit nichts verloren geht
  5. Qualitätsfilter: 8–95 Zeichen, balancierte Klammern, keine Punktierungs-Lineale, keine Flowchart-Zeilen („Yes/No"), keine Sektionscodes
- **Ergebnis:** 5.256 Titel (72,1 %), überwiegend aus dem Layout; Stichprobe ohne Kopfzeilen; `…1092.pdf` und `…955.pdf` tragen jetzt ihren echten Titel, `…1094.pdf` und `…1573.pdf` erstmals einen
- **Nebenbefund:** Mit den besseren Titeln zog ein Technical-Guide-Treffer bei „Klima" am Kapitel 07 vorbei → Gruppen-Boost von 45 auf 55 erhöht, damit die Baugruppe bei Alltagsbegriffen vorn bleibt (`server.js`)

### [x] 2.3 91 Dateien im falschen Kapitel
- **Ort:** [`build_index.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/build_index.js)
- `mazda_cx5_electrical_wiring_manual1…91.pdf` enthält **keine Schaltpläne**, sondern Mechanikseiten (`00-00`, `01-10`, `01-60`) — die Typ-Erkennung prüft nur das Präfix
- **Maßnahme:** Typ anhand des Sektionscodes bestimmen, nicht anhand des Dateinamens
- **Fertig, wenn:** Kapitel „Schaltpläne" exakt 277 Dokumente zeigt und die 91 Seiten unter 01/00 einsortiert sind

### [x] 2.4 Volltext-Lücken schließen *(v1.7.0: Extraktor-Bug behoben und Zeichnungsseiten per OCR erschlossen)*
- **Befund v1.4.0:** 1.009 Seiten lieferten beim Extrahieren keinen Text — angenommen wurden „reine Bildseiten" und OCR als Lösung
- **Erste Ursache:** PDF.js liest auf **allen** 1.009 Seiten Text; keine ist textlos. Der eigene Extraktor versteht nur literale `(…)Tj`-Strings und scheitert an den Hex-Strings dieser Dateien
- **Maßnahme 1:** `tools/titles.js` liefert neben dem Titel auch den Seitentext; `build_index.js` nutzt ihn als Rückfallebene, wenn `extractText()` leer bleibt. Kopf-/Fußzeilen („BACK TO CHAPTER INDEX", „TO MODEL INDEX", „MAZDA CX5 …") werden vorher entfernt
- **Zwischenstand:** Keywords 6.285 → 7.041 (86,2 % → 96,5 %), 251 Seiten blieben ohne Text
- **Zweite Ursache:** Diese 251 Seiten sind Zeichnungen, deren Beschriftungen als **Vektorpfade** gezeichnet sind — im Textstrom unsichtbar, aber im Rendering vorhanden. Die Messung am eingebetteten Rasterbild ergab 0 Zeichen, weil dort nur die Strichzeichnung liegt
- **Maßnahme 2 (OCR):** `tools/ocr_pages.py` (PyMuPDF, 200 dpi) → `tools/ocr_batch.ps1` (Windows-OCR de-DE) → `tools/ocr_merge.js` → `config/ocr_text.json` (203 KB, versioniert). `build_index.js` liest die Datei, ein Rebuild braucht keine erneute OCR
- **Endstand:** 253 Seiten erkannt (Ø 756 Zeichen), Keywords **7.292 (100 %)**, Titel **5.608 (76,9 %)**, Sektionscodes 6.302, Index 4,30 MB
- **Grenze:** OCR-Text ist fehlerbehaftet („BAITERY", „[CRAY]") — gut für Stichworte, nicht für Zitate. Neue Abhängigkeit nur für eine erneute OCR: Python + PyMuPDF + Windows-OCR-Sprachpaket
- **Wirkung:** „4WD" 264 Treffer, „Solenoid" 273 — vorher nur über die Kapitelstruktur erreichbar. „Massepunkt" liefert weiterhin Treffer über die deutschen Synonyme

### [x] 2.5 `searchCatalog.find()` durch Map ersetzen
- **Ort:** [`server.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/server.js) (`byFile`-Map, Lookup in `extractPdfLinks`)
- Pro Link wird linear über 7.294 Einträge gesucht (bei 59 Links ≈ 430.000 Vergleiche/Seite)
- **Maßnahme:** beim Laden `byFile = new Map(catalog.map(e => [e.f, e]))`
- **Fertig, wenn:** `/api/links` messbar schneller ist (heute 1–7 ms je Seite)

### [x] 2.6 Index-Build-Report
- Build soll zusammenfassen: Anzahl Dokumente, Ø Keywords, fehlende Titel/Sektionen je Familie, Dauer, Dateigröße
- **Fertig, wenn:** ein Index-Lauf ohne Log-Studium bewertbar ist

---

## 🟡 P2 – Suche

### [x] 3.1 Ranking: Wortgrenzen, IDF, Phrasen
- **Ort:** [`server.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/server.js)
- Drei Ursachen: `includes()` ohne Wortgrenzen (`oil` trifft `coil spring`: 127 von 658 „Öl"-Treffern sind falsch), Mehrwort-Synonyme werden zerlegt (`air conditioning` → `air` trifft **4.719 von 7.294** Dokumenten = 65 %), kein IDF/Tiebreak (27 „bremse"-Treffer mit identischem Score 200)
- **Maßnahme:** Tokens beim Start vorbereiten (Set pro Dokument), BM25-artiges Scoring, Synonyme als Phrase, exakte Sektionscodes höher gewichten, stabiler Tiebreak (Dateinummer)
- **Fertig, wenn:** „Klima" ≤ 300 Treffer, „Öl" ohne Coil-Spring-Rauschen, „bremse" führt mit dem Bremsen-Kapitelindex

### [x] 3.2 Wörterbuch-Lücken schließen
Mindestens diese Begriffe liefern heute 0 oder falsche Treffer:
`luftfilter` / `innenraumfilter` / `pollenfilter` → air cleaner, `dieselfilter` / `kraftstofffilter`, `achsvermessung` → wheel alignment, `spurstangenkopf` → tie rod end, `kurbelwellensensor` / `nockenwellensensor`, `raildruck` → fuel pressure, `öldruck`, `kompressionsprüfung`, `wärmetauscher` → heater core, `glühsteuergerät`, `injektordichtung`
- **Fertig, wenn:** jede Zeile einen plausiblen Top-3-Treffer liefert (Testfälle in `tools/search_test.js`)

### [x] 3.3 Live-Highlight beim Tippen
- Aktuell wird die geöffnete Seite erst markiert, wenn man ein Suchergebnis anklickt
- **Fertig, wenn:** Tippen im Suchfeld die aktuelle Seite sofort hervorhebt (debounced)

### [x] 3.4 „Alle Treffer anzeigen"
- Ergebnisliste ist hart auf 60 begrenzt ([`server.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/server.js))
- **Fertig, wenn:** ein „mehr laden"-Mechanismus existiert bzw. nach Sektion gruppiert wird

### [x] 3.5 Tippfehler-Toleranz
- Levenshtein ≤ 1 für Terme > 6 Zeichen, plus Umlaut-Normalisierung (ö→oe, ß→ss)
- **Fertig, wenn:** „bremsbelag" und „bremsbeläge" identische Treffer liefern

---

## 🟡 P2 – Viewer, Touch & Werkstattbetrieb

### [x] 4.1 Hotspots auf 254 quer liegenden Schaltplänen falsch
- **Ort:** [`app.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/public/app.js)
- Alle 254 Dateien mit `/Rotate 90` (sämtliche Schaltpläne) rechnen die Hotspot-Prozente aus der MediaBox **ohne** Rotation → Klickflächen sitzen falsch
- **Maßnahme:** `viewport.convertToViewportRectangle(rect)` und Positionierung in px statt Prozent (deckt Rotation + CropBox + Skalierung ab)
- **Fertig, wenn:** auf `…wiring_diagrams100.pdf` die Hotspots deckungsgleich mit den blauen Kästen des Originals sind

### [x] 4.2 „Breite anpassen" nutzt die falsche Breite
- **Ort:** [`app.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/public/app.js)
- Skaliert mit MediaBox-Breite (595) statt Viewport-Breite (842 bei Rotation) → horizontales Scrollen
- **Fertig, wenn:** `W` auf einer queren Seite die Seite exakt in die Breite bringt

### [x] 4.3 Prefetch-Bug: `link.targetFile` existiert nicht
- **Ort:** [`app.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/public/app.js) — die API liefert `target`
- Das Vorladen der Link-Ziele ist dadurch toter Code; nur Vor/Zurück wird gecacht
- **Fertig, wenn:** Netzwerk-Tab beim Wechsel über einen Hotspot keinen vollen Ladebalken mehr zeigt

### [x] 4.4 Lesezeichen löschen öffnet das Dokument
- **Ort:** [`app.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/public/app.js) (Delegation in `setupEvents`, Guard auf `.btn-delete-bookmark`)
- Zwei `document`-Listener; `stopPropagation()` stoppt keine Listener am selben Knoten → Klick auf „×" löscht **und** navigiert
- **Fertig, wenn:** „×" nur löscht (`stopImmediatePropagation` oder Guard im Delegate-Handler)

### [x] 4.5 Sprungfeld baut falschen Dateinamen
- **Ort:** [`app.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/public/app.js)
- Auf `front_page.pdf` ergibt „1092" den Namen `front_page.pdf1092.pdf` (Präfix-Regex greift nicht)
- **Fertig, wenn:** ungültige Präfixe auf `mazda_cx5_workshop_manual` zurückfallen und leere/ungültige Nummern eine Meldung zeigen

### [x] 4.6 LRU-Cache gibt Speicher nicht frei
- **Ort:** [`app.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/public/app.js)
- Beim Verdrängen wird der `PDFDocumentProxy` nie `destroy()`-t
- **Fertig, wenn:** nach 100 Dokumentwechseln der Speicher nicht weiter wächst

### [x] 4.7 Klicks während des Renderns werden verworfen
- **Ort:** [`app.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/public/app.js) — `if (state.isRendering) return;`
- Schnelle Doppelklicks wirken wie ein Hänger; besser letzte Anforderung queuen
- **Fertig, wenn:** zwei schnelle Klicks auf verschiedene Treffer immer beim zweiten Ziel landen

### [x] 4.8 Ungespeicherte Notizen gehen verloren
- **Ort:** [`app.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/public/app.js)
- Dokumentwechsel überschreibt die Textarea ohne Warnung
- **Fertig, wenn:** ein Wechsel bei geänderter Notiz nachfragt oder automatisch speichert

### [x] 4.9 Notizinhalte escapen
- **Ort:** [`app.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/public/app.js) — `innerHTML` mit Nutzertext
- **Fertig, wenn:** `<img onerror=…>` als Text angezeigt wird (`textContent` oder Escaping)

### [x] 4.10 Tablet-Modus: Media Queries, Touch, Vollbild *(aus v1.2-Planung)*
- Keine einzige Media Query; Header mit ~12 Bedienelementen auf 1024 px, Sidebar fix 360 px
- Wunsch: unter 1100 px Sidebar als Overlay, Header zweizeilig, Touch-Ziele ≥ 44 px
- Touch-Gesten: Wischen links/rechts = blättern, Pinch-to-Zoom, Doppeltipp = Zoom
- Vollbild-/Werkstattmodus (alle Chrome-Teile ausblenden)
- **Fertig, wenn:** auf einem 10"-Tablet ohne Zoom-Gefummel bedienbar

### [x] 4.11 Druck & PDF-Export *(aus v1.2-Planung)*
- Aktuell druckt `Ctrl+P` nur das Canvas-Gerüst
- Wunsch: aktuelle Seite bzw. Bereich (z. B. 1573–1575) als zusammenhängendes PDF drucken/exportieren
- **Fertig, wenn:** eine Reparaturanleitung als mehrseitiges PDF herauskommt

### [x] 4.12 Reparatur-Checklisten *(aus v1.2-Planung)*
- Interaktive Checklisten für Standardarbeiten (Injektortausch, Bremsenwechsel, Ölwechsel), abhakbar, im LocalStorage gespeichert
- **Fertig, wenn:** eine Checkliste pro Dokument hinterlegbar und der Fortschritt sichtbar ist

---

## 🔵 P3 – Betrieb, Wartbarkeit & Projekt-Hygiene

### [ ] 5.5 Smoke-Test (`node --test`)
- Tests: `/api/status` 200, Suche liefert Treffer, `/api/links` parst eine Referenzseite, Index-Invarianten (7.294 Einträge, alle Sektionen valide, alle kuratierten Dateien vorhanden), Traversal-Varianten → 403
- **Fertig, wenn:** `npm test` in unter 10 s grün ist

### [ ] 5.6 `.active_port` aufräumen
- Enthält aktuell `3301`, obwohl kein Server lief → irreführend. Beim Start neu schreiben, beim Beenden löschen oder als reine Info kennzeichnen

### [x] 5.8 Kleinigkeiten
- [x] unbenutzte Imports in `server.js` entfernt (neu: nur `http`, `fs`, `path`)
- [x] Favicon beantwortet (204 statt 404)
- [ ] CHANGELOG: „1,02 MB" ([`CHANGELOG.md`](file:///C:/Projekte/Tools/mazda-manual-viewer/CHANGELOG.md)) → für v1.1 historisch korrekt, in v1.4.0 bereits richtiggestellt
- [ ] Range-Requests (`206`) für PDFs — unkritisch, da alle Dateien < 1 MB, aber sauber
- [ ] einfaches Request-Log (Methode, Pfad, Dauer) für Fehlersuche
- [x] `hashchange`-Listener, damit manuelle `#datei.pdf`-Eingaben funktionieren

### [x] 5.9 Playwright als Dev-Setup *(v1.8.0)*
- **Umgesetzt:** `devDependencies: { "playwright": "^1.64.0" }` (installiert: 1.64.1, ohne Browser-Download — der Test nutzt das installierte Chrome über `channel: 'chrome'`)
- **Ohne Vorbereitung:** `tools/run_browser_test.js` startet den Viewer selbst auf Port 3480–3539, führt `tools/browser_test.js` dagegen aus und beendet ihn. `npm run test:browser` braucht nur `npm install` und Chrome
- **Abwägung bleibt:** `node_modules` (~50 MB) gegen 30 End-to-End-Prüfungen; `tools/ui_test.js` (CDP) ist weiter die abhängigkeitsfreie Alternative
- **Fertig, wenn:** `npm run test:browser` ohne manuelle Vorbereitung durchläuft — **30/30 grün**

---

## 🔵 P3 – Ausbau

### [x] 6.1 Kapitelbaum aus dem Index *(v1.8.0)*
- **Umgesetzt als Laufzeit-Baum** statt `chapters.json`: `GET /api/tree` baut aus dem Suchindex Gruppe → Sektion → Dokumente (17 Gruppen, 238 Sektionen, alle 7.294 Dokumente). Vorteil: kann nicht veralten, keine zweite Datenquelle
- Sektion = Kapitelteil des Codes (`01-14B-35` → `01-14B`); Bezeichnung nur, wenn ≥ 40 % der Sektion denselben Titel tragen — sonst steht der Code, statt einen falschen Titel zu zeigen
- UI: aufklappbare Gruppen und Sektionen unter den 16 Schnellzugriff-Karten; Dokumente werden erst beim Aufklappen gerendert (nicht 7.294 Links auf einmal)
- **Fertig, wenn:** jedes Dokument in ≤ 3 Klicks erreichbar ist — Klick 1 Gruppe, Klick 2 Sektion, Klick 3 Dokument

### [x] 6.2 Gruppen 10–12 im Baum *(v1.8.0, mit 6.1 erledigt)*
- `build_index.js` kannte nur 00–09; seit v1.4.0 werden 10/11/12 zugeordnet, und der Sektionsbaum zeigt sie als eigene Gruppen (10 Multiplex/CAN, 11 i-stop, 12 Personalisierung)

### [x] 6.3 Globale DTC-Übersicht *(v1.9.0)*
- **Umgesetzt:** `buildDtcIndex()` liest aus Titel und Keywords aller Seiten die Fehlercodes und baut eine Tabelle Code → Dokumente (827 Dokumente, 358 Code-Varianten, 329 Basis-Codes). `GET /api/dtc` liefert Code, Anzahl und häufigste Baugruppe
- **Suche:** Eingabe eines Codes (`P0301`, `U0100:87`) nimmt eine eigene Ranking-Route: Code im Titel +120, Abschnitt `-02` +40, Werkstatthandbuch +25, „INSPECTION" +15 → P0301 landet auf `01-02-182`
- **UI:** Hinweiszeile über den Treffern mit Code und Anzahl; unbekannte Codes werden als „nicht dokumentiert" gemeldet
- **Grenze:** Nur Seiten mit Code in Titel oder Keywords werden gefunden — reine Tabellenseiten ohne Code im Text fehlen. Ein Browse-Tab für die 329 Codes ist über `/api/dtc` vorbereitet, aber nicht eingebaut

### [x] 6.4 OCR für textlose Seiten prüfen *(in 2.4 erledigt — Pipeline läuft)*
- Siehe **2.4** — dort stehen Befund (1.007 Bildseiten), Aufwand und Abbruchkriterien.

### [ ] 6.5 Weiteres Handbuch einbinden
In `Downloads` liegt `mazda-l8-lf-l3-engine-workshop-manual.pdf` (L8/LF/L3-Motoren, 33 MB) — derzeit ungenutzt. Als zusätzliche Dokumentfamilie mit eigenem Index-Zweig aufnehmen, sobald 2.1–2.3 stehen

### [ ] 6.6 Reparaturprotokoll
Welche Arbeiten wurden am Fahrzeug wann nach welcher Seite durchgeführt (LocalStorage/JSON-Export) — Mehrwert für Wiederverkauf und Wartungshistorie

---

## 🟣 P4 – Auslieferung als Desktop-App

### [ ] 7.1 Windows-EXE mit Electron
**Ziel:** `npm run dist` erzeugt eine ausführbare Windows-App, die auf einem PC **ohne Node**, ohne
Internet und ohne weitere Installation läuft — Doppelklick, Fenster, fertig.

**Warum Electron:** Der Viewer ist bereits eine Web-App mit eigenem HTTP-Server (`server.js`) und
braucht nur einen Browser. Electron bringt Chromium mit, der bestehende Server läuft unverändert im
Main-Prozess — die Oberfläche muss nicht angefasst werden. Reine Node-Paketierer (`pkg`, Node SEA)
erzeugen eine kleinere EXE, öffnen aber kein eigenes Fenster und brauchen weiterhin Edge/Chrome.

**Architektur**
- `electron/main.js`: freien Port suchen, `process.env.PORT` und `MANUAL_DIR` setzen, den bestehenden
  Server per `require('../server.js')` starten, `BrowserWindow` (1280×900, Menü aus,
  `contextIsolation: true`, `nodeIntegration: false`) auf `http://127.0.0.1:<Port>/` öffnen.
  Dafür muss `server.js` `startServer` exportieren (heute nur intern) — eine Zeile.
- Beim Schließen: Fenster → Server → Prozess beenden, kein Zombie und kein belegter Port.
- Fehlt `data\`, erscheint ein Dialog mit Pfad und Hinweis statt einer 404-Serie.
- `MANUAL_DIR` wird in `main.js` auf `<exe-Ordner>\data` gesetzt — im asar-Archiv wäre `data/`
  schreibgeschützt und nicht austauschbar. Die Reihenfolge in `lib/paths.js` bleibt sonst unverändert.

**Build**
- Dev-Abhängigkeiten: `electron` + `electron-builder` (Versionen beim Umsetzen festlegen).
- `npm run app` startet die App im Entwicklungsmodus; `npm run dist` baut
  `dist/win-unpacked/Mazda-CX5-Viewer.exe` (portabel) und `dist/Mazda-CX5-Viewer-Setup-<Version>.exe`
  (NSIS, pro Benutzer, ohne Adminrechte).
- `electron-builder`-Konfiguration unter `build` in `package.json`: `appId`, `productName`, `files`
  (`server.js`, `lib/`, `public/`, `config/`), Icon (`.ico`), Version aus `package.json`.
- Die 451 MB PDFs werden **nicht** eingebacken (`extraResources` bewusst nicht) — `data\` bleibt ein
  Ordner neben der EXE, sonst wäre jeder Build 500 MB groß und ein Handbuch-Update unmöglich.

**Daten und Updates**
- `data\` liegt neben der EXE; ein Handbuch-Update ist ein Kopiervorgang, kein neuer Build.
- Notizen/Lesezeichen liegen im Electron-Profil (`%APPDATA%\Mazda-CX5-Viewer`), nicht neben der EXE.
- Auflösung bleibt: `MANUAL_DIR` → `config/settings.json` → `data\`.

**Abnahmekriterien**
- [ ] `npm run dist` erzeugt Installer und portablen Ordner
- [ ] Frisches Windows ohne Node: Installation ohne Adminrechte, Start in unter 10 s
- [ ] Kapitelbaum, Suche (inkl. `P0301`), PDF-Anzeige, Hotspots, Notizen, Checklisten und Druck laufen
- [ ] Ohne `data\` erscheint eine verständliche Meldung statt einer 404-Serie
- [ ] Beenden hinterlässt keinen laufenden Prozess und keinen belegten Port
- [ ] Installer ≤ 550 MB, installiert ≤ 700 MB (die PDFs dominieren)

**Risiken**
- Unsignierte EXE → SmartScreen-Warnung; ein Code-Signing-Zertifikat kostet Geld und ist für den
  Eigenbedarf verzichtbar
- ~90 MB Chromium im Paket und regelmäßige Electron-Sicherheitsupdates
- Virenscanner melden frisch gebaute, unsignierte Installer gelegentlich fälschlich
- Ein Installer verteilt 451 MB — für den Eigenbedarf ist der portable Ordner meist die bessere Wahl

**Alternativen** (falls Electron zu schwer ist)

| Variante | Größe | Aufwand | Nachteil |
|---|---|---|---|
| Electron + electron-builder | ~180 MB + Daten | ~1 Tag | Chromium im Paket, Updates nötig |
| Node-SEA/`pkg` + Verknüpfung | ~110 MB + Daten | ~3 h | kein eigenes Fenster, Browser bleibt nötig |
| Portable ZIP mit `node.exe` + `START_VIEWER.bat` | ~50 MB + Daten | ~2 h | wirkt gebastelt, kein Eintrag im Startmenü |
| Tauri/WebView2 | ~10 MB | ~2–3 Tage | zweiter Stack (Rust oder Sidecar), WebView2-Abhängigkeit |

---

## Empfohlene Reihenfolge

### v1.10.0 (als Nächstes)

Siehe Tabelle „Nächste Schritte" oben. **7.1** (Desktop-Build) ist ein eigener Block von ~1 Tag;
daneben die Betriebs-Kleinigkeiten 5.5/5.6/5.8 und die Ausbau-Punkte 6.5/6.6.

### Abgeschlossene Sprints (v1.4.0)

| Sprint | Inhalt | Status |
|---|---|---|
| 1 | 0.1–0.3, 5.1, 1.3 | ✅ (5.1 teilweise → A) |
| 2 | 1.1, 1.2, 2.1, 4.3, 4.4 | ✅ |
| 3 | 2.2, 2.3, 2.5, 3.1, 3.2 | ✅ (2.2 vollständig in v1.6.0) |
| 4 | 4.1, 4.2, 4.5–4.9 | ✅ (+ Flex-Shrink-Fix) |
| 5 | 5.2–5.7, 6.1, 6.2 | ✅ (5.5/5.6 offen) |
| 6 | 4.10–4.12, 6.3 | ✅ (6.3 in v1.9.0) |

---

## ✅ Erledigt in v1.9.0

- [x] **6.3 Fehlercodes** — `buildDtcIndex()` baut aus Titel und Keywords eine Tabelle Code → Dokumente
  (827 Dokumente, 358 Varianten, 329 Basis-Codes); `GET /api/dtc` liefert Code, Anzahl und Baugruppe.
  - **Suche:** Ein Code im Suchfeld (`P0301`, `U0100:87`) nimmt eine eigene Route mit Ranking
    (Code im Titel +120, Diagnoseabschnitt `-02` +40, Werkstatthandbuch +25, „INSPECTION" +15).
    P0301 → 7 Dokumente, oben `01-02-182` (Diagnostic Procedure).
  - **UI:** Hinweiszeile über den Treffern; unbekannte Codes werden als nicht dokumentiert gemeldet.
  - **Grenze:** Nur Seiten mit Code in Titel/Keywords werden gefunden — reine Tabellenseiten ohne Code
    im Text fehlen. Die Übersicht für einen künftigen Browse-Tab liegt über `/api/dtc` bereit.
  - **Tests:** API-Vertrag 59, Suchtests 16, Browser-Test 32 — alle grün.

---

## ✅ Erledigt in v1.8.0

- [x] **6.1 Sektionsbaum aus dem Index** — `GET /api/tree` baut beim ersten Aufruf Gruppe → Sektion → Dokumente aus dem Suchindex (17 Gruppen, 238 Sektionen, 7.294 Dokumente), gecacht bis zum nächsten Katalog-Laden. Kein `chapters.json`, das veralten könnte.
  - Sektion = Kapitelteil (`01-14B-35` → `01-14B`) — vorher ergab jede Seite eine eigene „Sektion" (1.115 in Gruppe 01 statt 30)
  - Bezeichnung nur bei homogenen Sektionen (≥ 40 % gleicher Titel), sonst steht der Code — sonst hätte `01-14B` den Titel einer falsch zugeordneten Seite gezeigt
  - UI unter den Schnellzugriff-Karten: Gruppen und Sektionen klappen auf, Dokumente werden erst dann gerendert; Dokumentzeile zeigt Seiten- und Sektionstitel
  - Jedes Dokument ist in drei Klicks erreichbar (Gruppe → Sektion → Dokument)
- [x] **6.2 Gruppen 10–12** — erscheinen im Baum als eigene Gruppen (10 Multiplex/CAN, 11 i-stop, 12 Personalisierung); `build_index.js` ordnet sie seit v1.4.0 zu
- [x] **5.9 Playwright** — `playwright@1.64.1` als Dev-Abhängigkeit (ohne Browser-Download, `channel: 'chrome'`), `npm run test:browser` startet den Viewer selbst (Port 3480–3539) über `tools/run_browser_test.js`; der Test deckt jetzt auch den Sektionsbaum ab: **30/30 grün**

---

## ✅ Erledigt in v1.7.0

- [x] **2.4 Volltext-Lücken** — 1.007 Seiten hatten keinen Text, weil der eigene Extraktor nur literale `(…)Tj`-Strings liest. `tools/titles.js` liefert jetzt zusätzlich den Seitentext, den `build_index.js` als Rückfallebene nutzt (ein PDF.js-Durchlauf für Titel und Text).
  - **Keywords 6.285 → 7.041 (86,2 % → 96,5 %)**, Sektionscodes 6.221 → 6.302, Titel 5.256 → 5.357 (73,4 %).
  - Kopf-/Fußzeilen werden vor der Keyword-Bildung entfernt, sonst hätten die Zeichnungsseiten nur „back to chapter index" als Inhalt.
  - **OCR der Zeichnungsseiten:** Die 251 Restseiten sind Zeichnungen mit Beschriftungen als Vektorpfade.
    Pipeline `tools/ocr_pages.py` → `tools/ocr_batch.ps1` → `tools/ocr_merge.js` → `config/ocr_text.json`;
    253 Seiten erkannt (Ø 756 Zeichen), Titel aus der ersten OCR-Zeile.
  - **Suche:** „4WD" 264 Treffer, „Solenoid" 273 — vorher nur über die Kapitelstruktur erreichbar.
  - **Ranking:** Mit dem neuen Volltext zog die Technical-Guide-Seite bei „Klima" erneut vor — Gruppen-Boost 55 → 65, Suchtests 15/15.
  - Index 4,22 MB (< 6 MB), Build 149 s.

---

## ✅ Erledigt in v1.6.0

- [x] **2.2 Titel aus dem PDF-Layout** — neue [`tools/titles.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/tools/titles.js): PDF.js `getTextContent()` liefert je Textstück Position und Höhe; daraus werden Zeilen im Kopfband (y 60–762) gebaut, Kopf-/Fußzeilen verworfen und die Überschrift über Verfahrensbegriff, Einzug und Schriftgröße bestimmt.
  - Indextitel: **3.664 → 5.256 (50,2 % → 72,1 %)**, davon der Großteil aus dem Layout; die alte Text-Heuristik bleibt als Fallback.
  - Stichprobe (304 Seiten, gleichmäßig über den Bestand): 50,0 % → 69,7 %; Workshop 65,3 % → 83,3 %, Technical Guide 12,5 % → 54,3 %, Bodyshop 27,3 % → 62,1 %.
  - Qualitätsfilter: keine Kopfzeilen, keine Punktierungs-Lineale („….01-12A–3"), keine Flowchart-Zeilen („Yes/No"), keine Sektionscodes, balancierte Klammern, 8–95 Zeichen.
  - Beispiele: `…1092.pdf` „FUEL INJECTOR REMOVAL/INSTALLATION" (vorher „BEFORE SERVICE PRECAUTION"), `…1094.pdf` „Fuel Injector Installation Note" (vorher leer), `…1573.pdf` „DIAGNOSIS FLOW [SKYACTIV-D 2.2 (R.H.D.)]" (vorher leer).
  - Ranking: Mit den neuen Titeln zog ein Technical-Guide-Dokument bei „Klima" vor das Kapitel 07 → Gruppen-Boost 45 → 55 (`server.js`), Suchtests wieder 15/15.
  - Index: 3,88 MB (Ziel < 6 MB), Build 155 s mit PDF.js; ohne neue Abhängigkeit, der vorhandene Browser-Build in `public/vendor` läuft in Node mit vorgeladenem Worker-Bundle.

---

## ✅ Erledigt in v1.5.1

- [x] **1.4 Injektor-Drehmomente belegt** — alle Werte der Karte „2.2D Injektor-Drehmomente" stammen jetzt aus den Originalseiten, jede Zeile hat einen Quellenlink (`data-file`, Sprung direkt auf die Seite).
  - `01-14B-37` (`…1094.pdf`): Mutter 1 – Voranzug 1,8–2,2 N·m (Schritt 4), Lösen −30° bis −150° (Schritt 5).
  - `01-14B-38` (`…1095.pdf`): Mutter 2 – Endzug 1,8–2,2 N·m + **177–183°** (Schritt 6; die Karte sagte vorher „+ 180°" ohne Toleranz), Einspritzleitungen 32–42 N·m (Schritte 7–8), Rücklaufleitung Injektorseite 22–26 N·m (Schritt 10).
  - **Neu in der Karte:** Common Rail 20–26 N·m (`01-14B-38`, Schritt 9) — wird beim Injektortausch gelöst und muss wieder angezogen werden.
  - **Gegenprobe `01-14B-34`** (`…1091.pdf`): bestätigt 32–42 N·m für beide Einspritzleitungen; die dort genannte Klammer der Pumpenseite (4,2–5,2 N·m) gehört nicht zum Injektortausch und bleibt außen vor.
  - Quellenlinks funktionieren: neuer Delegate-Handler in `app.js` für `.inline-link[data-file]` (vorher ohne Wirkung).

---

## ✅ Erledigt in v1.5.0

- [x] **5.1 Daten ins Projekt** — 7.294 PDFs (451 MB) liegen unter `data\`; `lib/paths.js` löst den Pfad einheitlich auf (`MANUAL_DIR` → `config/settings.json` → `data\`), `server.js`, `build_index.js` und `tools/validate.js` nutzen nur noch diesen Resolver. Der `C:\Temp`-Hardcode ist entfernt.
  - Startprüfung: fehlendes Verzeichnis bricht mit Anleitung und Exit-Code 1 ab; PDF-Anzahl ≠ Index wird als Warnung gemeldet; `/api/status` nennt zusätzlich `manualDirSource`.
  - `config/settings.json` mit `{ "manualDir": "data" }`; Umgebungsvariable `MANUAL_DIR` hat weiterhin Vorrang.
- [x] **5.2 Git** — Repository auf `main`, `.gitignore` (PDFs, `_backup/`, `.active_port`, `node_modules/`, Logs), erster Commit „v1.5.0 – Projekt-Hygiene"; 27 Dateien, 1,4 MB, `git status` sauber. `public/search_index.json` ist versioniert.
- [x] **5.3 `package.json`** — Scripts `start`, `start:open`, `index`, `packs`, `validate`, `test`, `test:api`, `test:browser`; `engines.node >= 18`; `dependencies: {}`.
  - `npm test` läuft ohne Vorbereitung: `tools/run_tests.js` validiert, startet den Server selbst auf Port 3480–3539, führt API-Vertrag (47) und Suchtests (15) aus und beendet ihn.
- [x] **5.4 README** — Start, Datenherkunft, Projektstruktur, Bedienung, Pfad-/Port-Konfiguration, Tests, bekannte Grenzen, Rechtehinweis.
- [x] **5.7 `START_VIEWER.bat`** — prüft Node.js (`where node`), zeigt die gefundene Version, bricht bei fehlendem Node mit verständlicher Meldung und Exit-Code 1 ab und zeigt nach dem Beenden den zuletzt genutzten Port aus `.active_port`.

---

## ✅ Erledigt in v1.4.0

- [x] **Sicherheit (P0)**: `safeJoin()` für `/pdf/` und `/public/`, CORS-Wildcard entfernt, `nosniff`/`Referrer-Policy`, Endungs-Whitelist — Traversal liefert 404
- [x] **Daten (P1)**: 0 ungültige Sektionscodes (vorher 1.201), Titel 46,8 % → 50,2 % ohne Artefakte, Gruppen 10–12 im Index, 91 falsch einsortierte Dateien korrigiert, Build-Report
- [x] **Kuratierung (P1)**: Packs generiert und geprüft (53 Verweise), drei Kapitelkarten korrigiert, drei Checklisten eingeführt, `tools/validate.js`
- [x] **Suche (P2)**: neue Engine (Wortgrenzen, IDF, Phrasen-Synonyme, Gruppen-Boost, Paging, Tippfehler) — „Klima" 4.719 → 195 Treffer, „Luftfilter" 0 → 75
- [x] **Viewer (P2)**: Hotspots über `convertToViewportRectangle` (behebt 254 gedrehte Schaltpläne), Fit-Breite, Prefetch-Bug, Lesezeichen, Sprungfeld, LRU mit `destroy()`, Render-Queue, Notiz-Autosave, Escaping, Live-Highlight, Druck/Export, Vollbild, Touch-Wischen, Tablet-CSS
- [x] **Nachbesserungen aus den Browser-Tests**: Checklisten-Kopf wurde überschrieben (behoben), Seite schrumpfte im Flex-Container und verschob Hotspots nach dem Zoomen (behoben)
- [x] **Tests**: `tools/validate.js` (OK), `api_contract_test.js` (47), `search_test.js` (15), `ui_test.js` (23, CDP), `browser_test.js` (27, Playwright mit echtem Chrome)

---

## ✅ Erledigt in v1.3.0

- [x] **Pre-Caching der Nachbarseiten (Zero-Latency Paging)**
  - LRU-Cache (max. 16 Dokumente) im Frontend, Vorladen von Vor-/Nachbarseite
  - Blättern mit <kbd>←</kbd> / <kbd>→</kbd> in ~10 ms
- [x] **Tastatur-Hilfe (Modal / Overlay)**
  - Aufruf per <kbd>?</kbd>, gegliedert in Navigation, Ansicht, Werkstattfunktionen, <kbd>Esc</kbd> schließt
- [x] **Automatischer Port-Fallback & Starter-Update**
  - `EADDRINUSE` → 3301, 3302 …, `.active_port`, `--open`, `/api/status`

---

## ✅ Erledigt in v1.2.0

- [x] **Textauswahl & Copy-Paste (PDF.js TextLayer)**
- [x] **Eigene Notizen & Lesezeichen (LocalStorage)** — ★-Favoriten, Notizfeld pro Dokument, Indikator-Dot, Listenübersicht
- [x] **Suchbegriff-Hervorhebung & Relevanz-Ranking** — `<mark class="search-match">`, `.search-highlight`, zweisprachige Synonyme, Snippets

---

## ✅ Erledigt in v1.1.0

- [x] **Vollständiger Mazda-Baugruppenbaum (00–09 + Schaltpläne + Karosserie + Tech Guide)**
- [x] **Offline-Suchindex (`search_index.json`)** — 7.294 PDFs, im RAM
- [x] **Zweisprachige Suche (Deutsch ⇄ Englisch)** — Synonym-Mapping (83 Begriffe; Ausbaubedarf siehe 3.2)
- [x] **Themenbezogene Reparatur-Packs** — vorkonfigurierte Direkteinstiege (Korrektheit siehe 1.1)
- [x] **Link-Tooltips mit Zieldokument-Titel**

---

## ✅ Erledigt in v1.0.0

- [x] Node-Backend ohne externe Abhängigkeiten, PDF-Streaming aller 7.294 Dateien
- [x] On-the-fly-Link-Extraktion (`/api/links/:file`) mit In-Memory-Cache
- [x] Frontend mit Dark-Theme, Hotspot-Overlay, Verlauf, Zoom, Blättern
- [x] Injektor-Fokus (Drehmomente, 11 Direkteinstiege)
- [x] Offline-Fähigkeit (PDF.js lokal) und Windows-Starter
