# Mazda CX-5 Service Manual Viewer

Offline-Viewer für das Mazda-CX-5-Werkstatthandbuch (Modelljahr 2012–2013, 2.2 Skyactiv-D und 2.0 G).
7.294 PDF-Seiten aus Werkstatthandbuch, Schaltplänen, Bodyshop Manual und Technical Guide — mit Hotspots,
zweisprachiger Suche (Deutsch ⇄ Englisch), Lesezeichen, Notizen, Reparatur-Checklisten und Druck/Export.

Läuft ohne Internet und ohne externe Laufzeit-Abhängigkeiten (reines Node.js + lokal eingebundenes PDF.js)
auf Laptop oder Tablet im Werkstattbetrieb.

**Stand:** v1.5.0 · Oktober 2026

---

## 1. Was das Projekt kann

| Bereich | Funktion |
|---|---|
| Kapitel | 15 Kapitelkarten 00–09 plus Schaltpläne, Karosserie, Technical Guide; Reparatur-Packs als Direkteinstieg |
| Suche | Wortgrenzen, IDF-Gewichtung, Phrasen-Synonyme, Tippfehler-Toleranz, Umlaut-Normalisierung, Paging |
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
├─ tools/                 validate.js, run_tests.js, build_packs.js, Tests
├─ data/                  7.294 PDFs (nicht versioniert, siehe .gitignore)
├─ START_VIEWER.bat       Doppelklick-Start mit Node-Prüfung
├─ package.json           Scripts: start, index, packs, validate, test
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
| Sprung zu Dateinummer | Sprungfeld (z. B. `1092` → `mazda_cx5_workshop_manual1092.pdf`) |
| Kapitel / Packs | linke Sidebar |
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
npm run test:browser # Playwright/Chrome, optional (benötigt playwright und laufenden Server)
```

`npm test` startet seinen Server selbst und lässt einen bereits laufenden Viewer auf 3300 unberührt.
`npm run test:api` erwartet die Adresse als Argument, Standard `http://127.0.0.1:3300`.

## 9. Bekannte Grenzen

- **Titelabdeckung 50,2 %** (3.664 von 7.294): Die Heuristik liest Text ohne Position; Kopfzeilen und
  Querverweise sind nicht unterscheidbar. Lösung über PDF.js-Layout ist als Paket C geplant (TODO 2.2).
- **1.007 Seiten ohne Text** (reine Bildseiten, v. a. Schaltpläne und Bodyshop-Deckblätter): nur über
  die Kapitelstruktur erreichbar, nicht über Stichworte. OCR ist als Paket D geplant (TODO 2.4).
- **Drehmomente** in der Injektor-Karte sind noch nicht gegen die Originalseiten geprüft (TODO 1.4).
- Die PDFs unterliegen dem Urheberrecht von Mazda — siehe Abschnitt 11.

## 10. Wartung

- Index nach PDF-Änderungen: `npm run index && npm run packs && npm run validate`
- Port-Datei `.active_port` ist reine Information und wird beim Start überschrieben.
- Sicherungen vor Umbauten liegen in `_backup/` (nicht versioniert).
- `TODO.md` führt offene Punkte, `CHANGELOG.md` die Versionshistorie.

## 11. Rechtehinweis

Die Handbuch-PDFs sind urheberrechtlich geschütztes Material von Mazda. Dieses Projekt ist ein
privates Werkstatt-Hilfsmittel: **nicht öffentlich hosten, nicht weitergeben, nicht kommerziell nutzen.**
Der Quellcode des Viewers darf frei angepasst werden; die Rechte an den Inhalten bleiben bei Mazda.
