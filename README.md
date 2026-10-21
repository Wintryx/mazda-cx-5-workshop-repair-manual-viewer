# Mazda CX-5 Service Manual Viewer

Offline-Viewer für das Mazda-CX-5-Werkstatthandbuch (Modelljahr 2012–2013, 2.2 Skyactiv-D und 2.0 G).
7.294 PDF-Seiten aus Werkstatthandbuch, Schaltplänen, Bodyshop Manual und Technical Guide — mit Hotspots,
zweisprachiger Suche (Deutsch ⇄ Englisch), Lesezeichen, Notizen, Reparatur-Checklisten und Druck/Export.

Läuft ohne Internet und ohne externe Laufzeit-Abhängigkeiten (reines Node.js + lokal eingebundenes PDF.js)
auf Laptop oder Tablet im Werkstattbetrieb.

**Stand:** v1.10.0 · Oktober 2026

---

## 1. Was das Projekt kann

| Bereich | Funktion |
|---|---|
| Kapitel | 15 Kapitelkarten 00–09 plus Schaltpläne, Karosserie, Technical Guide; Reparatur-Packs als Direkteinstieg |
| Sektionen | Baum aus dem Index: 17 Gruppen → 238 Sektionen → alle 7.294 Dokumente, drei Klicks bis zur Seite |
| Suche | Wortgrenzen, IDF-Gewichtung, Phrasen-Synonyme, Tippfehler-Toleranz, Umlaut-Normalisierung, Paging |
| Fehlercodes | 329 DTCs (P/B/C/U) aus den Diagnosekapiteln; Code eingeben → Diagnoseblatt zuerst |
| Seite | Hotspots aus PDF-Links (auch auf 254 quer liegenden Schaltplänen), Textauswahl, Zoom, Fit-Breite, Vollbild |
| Werkstatt | Notizen pro Dokument, Lesezeichen, Checklisten (Injektoren, Bremsen vorn, Ölwechsel), Druck eines Seitenbereichs |
| Betrieb | Port-Fallback, `--open`, `/api/status`, klare Startprüfung des Datenverzeichnisses |

## 2. Voraussetzungen

- **Node.js ≥ 18** (getestet mit v24). Keine `npm install`-Pflicht: `dependencies` ist leer.
- Windows, Edge oder Chrome (empfohlen), 4 GB RAM.
- ~500 MB freier Plattenplatz für die PDFs.

## 3. Projektstruktur

```
mazda-manual-viewer/
├─ server.js              HTTP-Server, Suche, Link-Extraktion (kein Framework)
├─ build_index.js         erzeugt public/search_index.json aus den PDFs
├─ lib/paths.js           Auflösung des Handbuch-Verzeichnisses
├─ config/                chapters.json, packs.json, checklists.json, settings.json
├─ public/                Frontend (index.html, app.js, style.css), PDF.js, search_index.json
├─ tools/                 validate.js, run_tests.js, titles.js, ocr_*.{py,ps1,js}, Tests
├─ electron/main.js       Desktop-Hülle (Fenster + Server im selben Prozess)
├─ build/icon.png         App-Icon für den Desktop-Build
├─ data/                  7.294 PDFs (nicht versioniert, siehe .gitignore)
├─ START_VIEWER.bat       Doppelklick-Start mit Node-Prüfung
├─ package.json           Scripts: start, app, dist, index, packs, validate, test
└─ TODO.md / CHANGELOG.md Roadmap und Versionshistorie
```

## 4. Datenherkunft und Installation

Die PDFs stammen aus dem Handbuch-ZIP (`mazda_cx5_2012_2.2d_service_manual.zip`). Sie sind **nicht**
im Repository (Urheberrecht, 451 MB). Ein frischer Rechner braucht drei Schritte:

1. Projektordner kopieren.
2. ZIP entpacken und **alle 7.294 PDFs direkt nach `data\`** legen
   (Dateinamen unverändert, keine Unterordner).
3. `npm start` — der Server prüft beim Start, ob Verzeichnis und Index zusammenpassen.

Der Suchindex (`public/search_index.json`, ~4 MB) ist Teil des Projekts und bereits enthalten.
Nur wenn sich die PDFs ändern, muss er neu gebaut werden:

```powershell
npm run index     # Index aus data\ neu erzeugen (~2–3 min)
npm run packs     # kuratierte Reparatur-Packs aus dem Index ableiten
```

## 5. Erster Start

```powershell
npm start            # http://localhost:3300
npm run start:open   # zusätzlich Browser öffnen
```

Alternativ `START_VIEWER.bat` doppelklicken: prüft Node, startet den Server und zeigt nach dem
Beenden den zuletzt genutzten Port.

Ist Port 3300 belegt, weicht der Server automatisch auf 3301, 3302 … aus und schreibt den aktiven
Port nach `.active_port`. `http://localhost:<Port>/api/status` zeigt jederzeit Port, Datenverzeichnis,
PDF-Anzahl und Index-Abdeckung.

## 6. Bedienung

| Aktion | Taste / Element |
|---|---|
| Blättern | ← / → oder Pager |
| Zoom | + / − , Strg+Mausrad, Doppeltipp |
| Breite anpassen | `W` oder Schaltfläche „Breite" |
| Vollbild / Werkstattmodus | `F` |
| Suche | Suchfeld oben, `Enter`; „mehr laden" für weitere Treffer |
| Fehlercode | Code ins Suchfeld (`P0301`, `U0100:87`) → Diagnoseblätter zuerst; 329 Codes im Index (`/api/dtc`) |
| Sprung zu Dateinummer | Sprungfeld (z. B. `1092` → `mazda_cx5_workshop_manual1092.pdf`) |
| Kapitel / Sektionen | Sidebar: Schnellzugriff-Karten, darunter der Baum „Alle Sektionen" (Gruppe → Sektion → Dokument) |
| Notizen, Lesezeichen | rechte Spalte, automatisch im LocalStorage gespeichert |
| Checklisten | Kapitelkarte „Checklisten", Fortschritt pro Dokument |
| Drucken / Export | `Strg+P` bzw. Schaltfläche, Seitenbereich z. B. `1573–1575` |
| Tastatur-Hilfe | `?` |

## 7. Konfiguration

**Handbuch-Verzeichnis** — Reihenfolge (`lib/paths.js`):

1. Umgebungsvariable `MANUAL_DIR` (absolut oder relativ zum Arbeitsverzeichnis)
2. `config/settings.json` → `"manualDir": "data"`
3. Standard: `data\` im Projektordner

```json
{ "manualDir": "D:/Handbuecher/mazda" }
```

**Port** — `PORT=3400 npm start`; ohne Angabe 3300 mit automatischem Fallback.

## 8. Tests

```powershell
npm run validate     # Index, Kapitel, Packs, Checklisten gegeneinander (offline, Exit-Code für CI)
npm test             # validate + eigener Testserver auf Port 3480–3539 + API- und Suchtests
npm run test:api     # nur API-Vertrag gegen laufenden Server
npm run test:browser # Playwright in Chrome: echte Bedienung (30 Prüfungen), startet den Server selbst
```

`npm test` und `npm run test:browser` starten ihren Server selbst (Port 3480–3539) und lassen einen
bereits laufenden Viewer auf 3300 unberührt. Der Browser-Test braucht einmalig `npm install`
(Playwright ist Dev-Abhängigkeit) und ein installiertes Google Chrome — es werden keine
Playwright-Browser heruntergeladen (`channel: 'chrome'`).
`npm run test:api` erwartet die Adresse als Argument, Standard `http://127.0.0.1:3300`.

## 9. Bekannte Grenzen

- **Titelabdeckung 76,9 %** (5.608 von 7.294): Der Rest sind Seiten ohne eigene Überschrift
  (Fortsetzungsseiten, Zeichnungen ohne Beschriftung) — dort bleibt der Titel leer statt geraten.
- **OCR-Texte** der 253 Zeichnungsseiten (Schaltpläne, Bodyshop) sind maschinell gelesen und enthalten
  Fehler („BAITERY", „[CRAY]"). Sie taugen für Stichworte, nicht für Zitate; die Seiten selbst sind
  maßgeblich.
- **Drehmomente** der Injektor-Karte sind gegen `01-14B-37` und `01-14B-38` geprüft und je Zeile verlinkt;
  sie gelten für den 2.2 Skyactiv-D — andere Motorvarianten haben eigene Werte.
- Die PDFs unterliegen dem Urheberrecht von Mazda — siehe Abschnitt 11.

## 10. Wartung

- Index nach PDF-Änderungen: `npm run index && npm run packs && npm run validate`
- Port-Datei `.active_port` ist reine Information und wird beim Start überschrieben.
- Sicherungen vor Umbauten liegen in `_backup/` (nicht versioniert).
- `TODO.md` führt offene Punkte, `CHANGELOG.md` die Versionshistorie.

**OCR neu erzeugen** (nur nötig, wenn sich die PDFs ändern; das Ergebnis
`config/ocr_text.json` ist versioniert):

```powershell
python tools/ocr_pages.py        # rendert die Seiten ohne Text (200 dpi)
powershell -NoProfile -File tools/ocr_batch.ps1 `
  -Manifest "$env:TEMP\mazda-ocr\manifest.json" -Out "$env:TEMP\mazda-ocr\results.json"
node tools/ocr_merge.js "$env:TEMP\mazda-ocr\results.json"
npm run index
```

Voraussetzungen: Python 3 mit `pymupdf` (`pip install pymupdf`) und ein Windows-OCR-Sprachpaket
(hier de-DE). Der Viewer selbst braucht weder Python noch Netz — nur dieser Wartungsschritt.

**Versionierung:** Das Projekt ist ein Git-Repository auf `main`. Nicht versioniert sind `data\`
(451 MB PDFs), `node_modules\`, `dist\` und `_backup\`; Teil des Repos sind dagegen
`public/search_index.json` und `config/ocr_text.json`, weil der Viewer ohne sie nicht läuft
(~5 MB). Push über SSH:

```powershell
git remote add origin git@github.com:Wintryx/mazda-cx-5-workshop-repair-manual-viewer.git   # einmalig
git push -u origin main
```

Das Repository liegt unter
[github.com/Wintryx/mazda-cx-5-workshop-repair-manual-viewer](https://github.com/Wintryx/mazda-cx-5-workshop-repair-manual-viewer)
und ist **privat**: Der Index enthält Titel und Stichworte, die aus dem Mazda-Handbuch extrahiert
wurden, und unterliegt damit dem Urheberrecht (siehe Abschnitt 12). Die Releases sind mit den Tags
`v1.5.0` bis `v1.10.0` markiert.

## 11. Desktop-App (Windows-EXE)

Für Rechner **ohne Node**: einmalig `npm install` (holt Electron und electron-builder als
Dev-Abhängigkeiten), dann

```powershell
npm run app     # Entwicklungsmodus (Electron-Fenster)
npm run dist    # baut Installer und portablen Ordner
```

Ergebnis in `dist\`:

| Datei | Größe | Zweck |
|---|---|---|
| `win-unpacked\Mazda-CX5-Viewer.exe` | 362 MB (Ordner) | portabel — Ordner auf USB kopieren, EXE starten |
| `Mazda-CX5-Viewer-Setup-<Version>.exe` | 108 MB | Installer, pro Benutzer, ohne Adminrechte |

**Wichtig:** Der Ordner `data\` mit den 7.294 PDFs gehört **neben die EXE**, nicht in den Build —
die PDFs werden bewusst nicht eingebacken. Auf dem Zielrechner also:

```
Mazda-CX5-Viewer.exe
data\            <- 7.294 PDFs
```

Fehlt `data\`, zeigt die App einen Dialog mit dem erwarteten Pfad und beendet sich. Ein Handbuch-Update
ist ein Kopiervorgang in `data\`, kein neuer Build. Notizen und Lesezeichen liegen im
Electron-Profil (`%APPDATA%\Mazda CX-5 Viewer`).

Zwei Hinweise: Die EXE ist nicht signiert, Windows SmartScreen warnt beim ersten Start („Weitere
Informationen" → „Trotzdem ausführen"). Und ist die Umgebungsvariable `ELECTRON_RUN_AS_NODE=1`
gesetzt, startet die EXE als Node und beendet sich sofort — auf normalen PCs ist sie nicht gesetzt.

## 12. Rechtehinweis

Die Handbuch-PDFs sind urheberrechtlich geschütztes Material von Mazda. Dieses Projekt ist ein
privates Werkstatt-Hilfsmittel: **nicht öffentlich hosten, nicht weitergeben, nicht kommerziell nutzen.**
Der Quellcode des Viewers darf frei angepasst werden; die Rechte an den Inhalten bleiben bei Mazda.
