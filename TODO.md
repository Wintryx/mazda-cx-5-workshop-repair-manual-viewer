# Roadmap & TODOs – Mazda CX-5 Service Manual Viewer

**Stand:** v1.5.0 · 20.10.2026
**Grundlage:** vollständige Code- und Datenanalyse (7.294 PDFs, alle API-Endpunkte, Index-Auswertung, Testinstanz auf Port 3399)

Diese Liste enthält alle offenen Punkte, um den Viewer sicher, korrekt und am Werkstattarbeitsplatz (Tablet/Laptop am Auto) universell nutzbar zu machen. Abgehakte Punkte wandern nach unten in die Versionshistorie.

**Legende:** 🔴 Blocker · 🟠 hoch · 🟡 mittel · 🔵 niedrig
**Format je Punkt:** Problem → Datei/Zeile → Maßnahme → *Fertig, wenn …* (abgehakte Punkte beschreiben den ursprünglichen Befund und wie er behoben wurde)

> **v1.4.0 umgesetzt:** P0 vollständig, P1 (außer 1.4, 2.2, 2.4) und P2 vollständig. Verifiziert mit `tools/validate.js` (OK) und `tools/search_test.js` (15/15).
>
> **v1.5.0 umgesetzt:** Paket A (Projekt-Hygiene: 5.1–5.4, 5.7). Verifiziert mit `npm test` (47 API- + 15 Suchprüfungen) gegen `data\`.

---

## 🎯 Nächste Schritte (v1.6.0)

Paket **A** (Projekt-Hygiene) ist mit v1.5.0 erledigt — siehe „Erledigt in v1.5.0" unten. Es bleiben drei Pakete, in dieser Reihenfolge sinnvoll — Details unter den jeweiligen Punkten (B → 1.4, C → 2.2, D → 2.4).

| Paket | Inhalt | Aufwand | Bringt |
|---|---|---|---|
| **B** | Drehmomente belegen (01-14B-34/37/38) | ~1 h | Sicherheit bei der häufigsten Arbeit |
| **C** | Titel 50 % → ~70 % über PDF.js-Layout | ~3 h | Suche und Sidebar deutlich lesbarer |
| **D** | OCR der 1.007 Bildseiten | ~1 Tag | Schaltpläne und Bodyshop durchsuchbar |

### [ ] B – Drehmomente verifizieren
- [ ] Spickzettel gegen **01-14B-34** (Einspritzleitungen 32–42 Nm), **01-14B-37** (Montagehinweis/Anzugschema) und **01-14B-38** (Klammer 1,8–2,2 Nm + 180°) abgleichen
- [ ] Rücklaufleitung (22–26 Nm) belegen — oder aus der Karte entfernen
- [ ] Jede Zeile der Karte bekommt einen Quellenlink (`data-file` auf die Seite)
- **Fertig, wenn:** keine Zeile ohne Seitenangabe ist und die Werte im PDF exakt so stehen.

### [ ] C – Titel über das PDF.js-Layout
- [ ] Node-fähigen PDF.js-Build (Legacy) einbinden und `getTextContent()` nutzen — es liefert `transform` (x/y) und `height` je Textstück
- [ ] **Kopfzeile erkennen:** oberste Zeile mit Sektionscode oder wiederholtem Kolumnentitel (z. B. „MECHANICAL [SKYACTIV-D 2.2]") verwerfen
- [ ] **Überschrift bestimmen:** größte Schriftgröße im oberen Drittel, sonst erste Zeile nach dem Sektionscode
- [ ] Qualitätsfilter: 10–90 Zeichen, Großbuchstaben-Anteil > 0,6, keine reinen Zahlen/IDs
- **Fertig, wenn:** ≥ 70 % der Dokumente einen Titel haben und eine Stichprobe von 20 Seiten keine Kopfzeilen mehr enthält.

### [ ] D – OCR der Bildseiten
- [ ] Bestätigen, dass die 1.007 Seiten ohne Text nur aus `/Image`-XObjects bestehen
- [ ] Tesseract (deu+eng) offline über diese Seiten laufen lassen, `t`/`kw` nachziehen
- [ ] Laufzeit messen und Index-Größe prüfen (Ziel < 6 MB)
- **Fertig, wenn:** Schaltpläne über Stichworte wie „4WD-Solenoid" oder „Massepunkt" auffindbar sind.

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

### [ ] 1.4 Injektor-Drehmomente gegen Original prüfen
Die Spickzettel-Karte im Frontend ([`index.html`](file:///C:/Projekte/Tools/mazda-manual-viewer/public/index.html)) nennt Werte (1,8–2,2 Nm + 180°, 32–42 Nm, 22–26 Nm). Diese wurden nicht gegen die PDF-Seiten abgeglichen — bei Drehmomenten ist ein Tippfehler teuer.

- **Zu prüfen gegen:** `mazda_cx5_workshop_manual1091.pdf` (01-14B-34, Einspritzleitungen), `…1094.pdf` (01-14B-37, Montageanleitung), `…1095.pdf` (01-14B-38, Klammer-Drehmomente); die Rücklaufleitung (22–26 Nm) im Bereich 01-14B-4x suchen (Seite noch nicht bestätigt)
- **Maßnahme:** jeden Wert aus dem PDF ablesen, in der Karte mit Seitenangabe verlinken (`data-file`), abweichende/unnötige Zeilen streichen
- **Fertig, wenn:** jede Zeile mit Seitenzahl belegt ist (z. B. „→ 01-14B-38") und die Karte keine ungeprüften Zahlen mehr enthält

---

## 🟠 P1 – Index & Datenqualität

### [x] 2.1 Sektionscodes reparieren (1.201 von 6.221 betroffen)
- **Ort:** [`build_index.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/build_index.js)
- Ursache: Im PDF steht `0x85` (Gedankenstrich), der Code ersetzt aber das *literale* `\205` → `"01-14A\x8516"` statt `"01-14A-16"`
- **Maßnahme:** `full.replace(/[\u0080-\u009f\u00ad]/g, '-')` vor dem Match, dann strikt `(\d{2})-(\d{2})([A-Z]?) - (\d{1,3})` zusammensetzen; Trefferquote im Build-Log ausgeben
- **Fertig, wenn:** 0 fehlerhafte Codes und `01-10A-16` usw. per Suche auffindbar

### [ ] 2.2 Titel: 3.882 Dokumente ohne, viele verstümmelt *(v1.4.0: 50,2 % erreicht, Artefakte bereinigt – Ziel ~70 % offen)*
- **Ort:** [`build_index.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/build_index.js)
- **Ist-Zustand v1.4.0:** 3.664 Titel (50,2 %), aber die Heuristik rät: auf `…1092.pdf` steht „BEFORE SERVICE PRECAUTION" statt „FUEL INJECTOR REMOVAL/INSTALLATION", weil der Querverweis vor der Überschrift im Textstrom liegt
- **Ursache:** Text wird ohne Position extrahiert — Kopfzeile, Querverweis und Überschrift sind nicht unterscheidbar
- **Maßnahme (Layout):** Node-fähigen PDF.js-Legacy-Build nutzen, `getTextContent()` liefert je Textstück `transform: [a,b,c,d,x,y]` und `height`
  1. Zeilen nach `y` gruppieren, Kopf-/Fußzeile (oberste/unterste Zeile, enthält Sektionscode oder wiederholt sich auf > 60 % der Seiten) verwerfen
  2. Überschrift = Textstück mit größter `height` im oberen Drittel; Fallback: erste Zeile nach dem Sektionscode
  3. Qualitätsfilter: 10–90 Zeichen, Großbuchstaben-Anteil > 0,6, keine reinen Zahlen/IDs
  4. Ergebnis gegen die 20 auffälligsten Seiten prüfen (`1092`, `1573`, `869`, `955`)
- **Fertig, wenn:** ≥ 70 % der Dokumente einen Titel haben und in der Stichprobe keine Kopfzeilen mehr auftauchen

### [x] 2.3 91 Dateien im falschen Kapitel
- **Ort:** [`build_index.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/build_index.js)
- `mazda_cx5_electrical_wiring_manual1…91.pdf` enthält **keine Schaltpläne**, sondern Mechanikseiten (`00-00`, `01-10`, `01-60`) — die Typ-Erkennung prüft nur das Präfix
- **Maßnahme:** Typ anhand des Sektionscodes bestimmen, nicht anhand des Dateinamens
- **Fertig, wenn:** Kapitel „Schaltpläne" exakt 277 Dokumente zeigt und die 91 Seiten unter 01/00 einsortiert sind

### [ ] 2.4 1.009 Dokumente ohne Volltext-Keywords *(v1.4.0: Ursache geklärt – 1.007 Seiten sind reine Bildseiten, OCR entscheidbar)*
- **Befund:** 1.007 Seiten liefern beim Extrahieren keinen Text (Deckblätter von Wiring/Bodyshop, einige Schaltpläne); Schaltpläne haben nur 7 % Keyword-Abdeckung
- **Maßnahme (OCR):** Tesseract (deu+eng) offline über genau diese Seiten laufen lassen, Ergebnis in `t`/`kw` des Index übernehmen; Seitenliste aus dem Build-Report ziehen
- **Aufwand/Risiko:** ~1 Tag; Index wächst (Ziel < 6 MB), Laufzeit einmalig, Qualität bei Strichzeichnungen begrenzt — Nutzen vorher an 20 Seiten messen
- **Alternative:** bewusst akzeptieren und im README als Grenze dokumentieren
- **Fertig, wenn:** Schaltpläne über Stichworte (z. B. „4WD-Solenoid", „Massepunkt") findbar sind oder die Entscheidung dokumentiert ist

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

### [ ] 5.9 Playwright als optionales Dev-Setup
- `tools/browser_test.js` läuft nur, wenn `playwright` installiert ist (aktuell außerhalb des Projekts getestet)
- **Maßnahme:** `devDependencies: { "playwright": "^1.64" }`, Script `test:browser`, Hinweis im README, dass der Test das installierte Chrome nutzt (`channel: 'chrome'`) und einen laufenden Server voraussetzt
- **Abwägung:** ~50 MB `node_modules` gegen 27 End-to-End-Prüfungen; `tools/ui_test.js` (CDP-Variante) bleibt die abhängigkeitsfreie Alternative
- **Fertig, wenn:** `npm run test:browser` ohne manuelle Vorbereitung durchläuft

---

## 🔵 P3 – Ausbau

### [ ] 6.1 Kapitelbaum aus dem Index generieren
- Der Bestand hat **161 echte Sektionen** (00-00 … 12-00), die UI zeigt 15 Karten; nur **49 von 7.294** Dokumenten (0,7 %) sind direkt verlinkt
- Generator: pro Sektion `{ code, count, tocFile, label }` → `chapters.json`; Sortierung nach Sektion, Gruppen 00–12
- Die 15 handgepflegten Karten aus `/api/chapters` bleiben als „Schnellzugriff" darüber
- **Fertig, wenn:** jedes Dokument in ≤ 3 Klicks erreichbar ist

### [ ] 6.2 Gruppen 10 (Multiplex/CAN, 255 Docs), 11 (i-stop, 52) und 12 (Personalisierung, 5) in den Baum aufnehmen
- Sie landen derzeit im Sammelbecken „Allgemein" ([`build_index.js`](file:///C:/Projekte/Tools/mazda-manual-viewer/build_index.js) kennt nur 00–09)
- **Fertig, wenn:** die Gruppen als eigene Kapitel erscheinen

### [ ] 6.3 Globale DTC-Übersicht generieren
- Es gibt keine übergreifende Fehlercode-Tabelle; DTCs liegen pro System (04-02A, 05-02A/B, 09-02A…L, 10-02B/D, …)
- Aus den `-02`-Seiten eine durchsuchbare Tabelle (Code → System → Dokument) bauen
- **Fertig, wenn:** Eingabe „P0301" direkt zum richtigen Diagnoseblatt führt

### [ ] 6.4 OCR für textlose Seiten prüfen *(zusammengeführt mit 2.4)*
- Siehe **2.4** — dort stehen Befund (1.007 Bildseiten), Aufwand und Abbruchkriterien.

### [ ] 6.5 Weiteres Handbuch einbinden
In `Downloads` liegt `mazda-l8-lf-l3-engine-workshop-manual.pdf` (L8/LF/L3-Motoren, 33 MB) — derzeit ungenutzt. Als zusätzliche Dokumentfamilie mit eigenem Index-Zweig aufnehmen, sobald 2.1–2.3 stehen

### [ ] 6.6 Reparaturprotokoll
Welche Arbeiten wurden am Fahrzeug wann nach welcher Seite durchgeführt (LocalStorage/JSON-Export) — Mehrwert für Wiederverkauf und Wartungshistorie

---

## Empfohlene Reihenfolge

### v1.6.0 (als Nächstes)

| Paket | Inhalt | Aufwand |
|---|---|---|
| **B** | 1.4 Drehmomente belegen | ~1 h |
| **C** | 2.2 Titel über PDF.js-Layout | ~3 h |
| **D** | 2.4 OCR der Bildseiten | ~1 Tag |
| optional | 5.9 Playwright als Dev-Setup, 6.5 zweites Handbuch | je ~1 h |

### Abgeschlossene Sprints (v1.4.0)

| Sprint | Inhalt | Status |
|---|---|---|
| 1 | 0.1–0.3, 5.1, 1.3 | ✅ (5.1 teilweise → A) |
| 2 | 1.1, 1.2, 2.1, 4.3, 4.4 | ✅ |
| 3 | 2.2, 2.3, 2.5, 3.1, 3.2 | ✅ (2.2 teilweise → C) |
| 4 | 4.1, 4.2, 4.5–4.9 | ✅ (+ Flex-Shrink-Fix) |
| 5 | 5.2–5.7, 6.1, 6.2 | ✅ in v1.5.0 (5.5/5.6/5.9 offen) |
| 6 | 4.10–4.12, 6.3 | ✅ (6.3 offen) |

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
