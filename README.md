# Mazda CX-5 Service Manual Viewer

Offline viewer for the Mazda CX-5 workshop manual (model years 2012–2013, 2.2 Skyactiv-D and 2.0 G).
7,294 PDF pages from the workshop manual, wiring diagrams, bodyshop manual and technical guide — with
clickable hotspots, bilingual search (German ⇄ English), bookmarks, notes, repair checklists and
print/export.

Runs without internet and without runtime dependencies (plain Node.js plus a locally bundled PDF.js)
on a laptop or tablet in the workshop.

> **Download source of the manual:** the archive `mazda_cx5_2012_2.2d_service_manual.zip` was
> downloaded on 2026-10-20 from
> **[manuale.clubmazda.ro/cx5/mazda_cx5_2012_2.2d_service_manual.zip](https://manuale.clubmazda.ro/cx5/mazda_cx5_2012_2.2d_service_manual.zip)**
> — a third-party site, not affiliated with this project. Availability and legality are not guaranteed;
> all rights to the content remain with Mazda.

**State:** v1.14.0 · October 2026

---

## How to run it

The viewer exists in two forms that share the same code and the same PDFs. Pick the one that fits
your machine:

|  | **From source** (Node + browser) | **Desktop app** (Windows EXE) |
|---|---|---|
| You need | Node.js ≥ 18 and a browser | nothing but Windows (no Node, no browser setup) |
| Start it with | `npm start`, then open http://localhost:3300 | double-click `Mazda-CX5-Viewer.exe` |
| PDFs live in | `data\` inside the project folder | `data\` next to the EXE |
| Build step | none | `npm run dist` once on a machine with Node |
| Good for | development, testing, a quick look | workshop laptop/tablet, USB stick, PCs without Node |

Both show exactly the same interface — chapters, search, fault codes, notes, checklists, printing.
Notes and bookmarks are stored per browser respectively in the Electron profile.

- **Source route:** sections 4–7 (data, first start, usage, configuration).
- **Desktop route:** section 11 (build, install, first start).

---

## 1. What this project does

| Area | Feature |
|---|---|
| Chapters | 16 quick-access cards (00–09 plus wiring, bodyshop, technical guide); curated repair packs |
| Sections | Tree built from the index: 17 groups → 238 sections → all 7,294 documents, three clicks to any page |
| Search | Word boundaries, IDF weighting, phrase synonyms, typo tolerance, umlaut normalisation, paging |
| Fault codes | 329 DTCs (P/B/C/U) from the diagnostic chapters; type a code → diagnostic sheet first |
| Page | Hotspots from PDF links (including 254 rotated wiring diagrams), text selection, zoom, fit width, fullscreen |
| Workshop | Notes per document, bookmarks, checklists (injectors, front brakes, oil change), printing a page range |
| UI languages | German (default) and English — flag dropdown in the header, switches **live** (no reload). Covers the whole interface including section groups, repair packs and checklists; only manual content (document titles) stays as printed |
| Operation | Port fallback, `--open`, `/api/status`, clear start-up check of the data directory, HTTP range requests for PDFs, request log (`LOG_REQUESTS=0` disables) |

## 2. Requirements

**Source route (section 5):**

- **Node.js ≥ 18** (tested with v24). No `npm install` needed to run: `dependencies` is empty.
- Windows, Edge or Chrome (recommended), 4 GB RAM.

**Desktop route (section 11):** Windows 10/11, no Node and no browser setup. Building the EXE still
needs Node once.

Both need ~500 MB free disk space for the PDFs.

## 3. Project structure

```
mazda-manual-viewer/
├─ server.js              HTTP server, search, link extraction (no framework)
├─ build_index.js         builds public/search_index.json from the PDFs
├─ lib/paths.js           resolves the manual directory
├─ config/                chapters.json, packs.json, checklists.json, settings.json
├─ public/                frontend (index.html, app.js, i18n.js, style.css), PDF.js, search_index.json
├─ tools/                 validate.js, run_tests.js, titles.js, ocr_*.{py,ps1,js}, tests
├─ electron/main.js       desktop shell (window + server in one process)
├─ build/icon.png         app icon for the desktop build
├─ data/                  7,294 PDFs (not versioned, see .gitignore)
├─ START_VIEWER.bat       double-click launcher with Node check
├─ package.json           scripts: start, app, dist, index, packs, validate, test
├─ AGENTS.md              conventions for coding agents (commit language, tests, data)
└─ TODO.md / CHANGELOG.md roadmap and version history
```

## 4. Data source and installation

The PDFs come from the manual archive linked at the top of this README. They are **not** part of the
repository (copyright, 451 MB). For the **source route** a fresh machine needs three steps:

1. Copy the project folder.
2. Unpack the archive and put **all 7,294 PDFs directly into `data\`**
   (keep the file names, no subdirectories).
3. `npm start` — on start-up the server checks that directory and index match.

For the **desktop route** the steps are the same, except that `data\` goes next to the EXE and you
double-click the EXE instead of running `npm start` — see section 11.

The search index (`public/search_index.json`, ~4 MB) is part of the project and already included.
It only has to be rebuilt when the PDFs change:

```powershell
npm run index     # rebuild the index from data\ (~2–3 min)
npm run packs     # derive the curated repair packs from the index
```

## 5. Running from source (Node + browser)

This is the development and quick-start route: a small Node server delivers the UI and the PDFs to
your browser. It needs Node.js (≥ 18) and a browser — see section 11 for the standalone EXE.

```powershell
npm start            # http://localhost:3300
npm run start:open   # also opens the browser
```

Alternatively double-click `START_VIEWER.bat`: it checks for Node, starts the server and keeps the
window open while it runs.

If port 3300 is taken, the server automatically moves to 3301, 3302 … and writes the active port to
`.active_port` (the file exists only while the server runs). `http://localhost:<port>/api/status`
always reports port, data directory, PDF count and index coverage.

## 6. Usage

| Action | Key / element |
|---|---|
| Paging | ← / → or the pager |
| Zoom | + / −, Ctrl + mouse wheel, double click |
| Fit width | `W` or the “Fit width” button |
| Fullscreen / workshop mode | `F` |
| Search | search field at the top, `Enter`; “load more” for further hits |
| Fault code | type the code into the search field (`P0301`, `U0100:87`) → diagnostic sheets first; 329 codes in the index (`/api/dtc`) |
| Jump to file number | jump field (e.g. `1092` → `mazda_cx5_workshop_manual1092.pdf`) |
| Chapters / sections | sidebar: quick-access cards, below them the “All sections” tree (group → section → document) |
| Notes, bookmarks | right-hand column, stored automatically in localStorage |
| Checklists | “Checklists” tab, progress per document |
| Print / export | `Ctrl+P` or the button, page range e.g. `1573–1575` |
| Keyboard help | `?` |
| Language | flag dropdown in the header (🇩🇪 Deutsch / 🇬🇧 English) — switches live, no reload |

## 7. Configuration

**Manual directory** — resolution order (`lib/paths.js`):

1. environment variable `MANUAL_DIR` (absolute or relative to the working directory)
2. `config/settings.json` → `"manualDir": "data"`
3. default: `data\` inside the project folder

```json
{ "manualDir": "D:/manuals/mazda" }
```

**Port** — `PORT=3400 npm start`; default 3300 with automatic fallback.

## 8. Tests

```powershell
npm run validate     # index, chapters, packs, checklists against each other (offline, exit code for CI)
npm run test:smoke   # node:test smoke suite (10 checks, own server, ~2 s)
npm test             # smoke + validate + own test server on port 3480–3539 + API and search tests
npm run test:api     # API contract only, against a running server
npm run test:browser # Playwright in Chrome: real UI (39 checks), starts the server itself
```

`npm test` and `npm run test:browser` start their own server (port 3480–3539) and leave a viewer
running on 3300 untouched. The browser test needs a one-time `npm install` (Playwright is a dev
dependency) and an installed Google Chrome — no Playwright browsers are downloaded
(`channel: 'chrome'`). `npm run test:api` takes the address as an argument, default
`http://127.0.0.1:3300`.

Current state: 10 smoke checks, 59 API checks, 16 search checks, 39 browser checks — all green.

## 9. Known limits

- **Title coverage 78.5 %** (5,725 of 7,294): the rest are pages without their own heading
  (continuation pages, drawings without captions) — the title stays empty instead of being guessed.
  Three extra passes catch headings the general rules reject: DTC pages (“DTC P0223:00 [SKYACTIV-G 2.0]”),
  headings prefixed with a section code (“09-80C BODY STRUCTURE”) and centred capitals (“FOREWORD”).
- **OCR text** of the 253 drawing pages (wiring diagrams, bodyshop) is machine-read and contains
  errors (“BAITERY”, “[CRAY]”). Good for keywords, not for quoting; the pages themselves are
  authoritative.
- **Torque values** in the injector card are verified against `01-14B-37` and `01-14B-38` and linked
  per row; they apply to the 2.2 Skyactiv-D — other engines have their own values.
- The PDFs are copyrighted by Mazda — see section 12.

## 10. Maintenance

- After PDF changes: `npm run index && npm run packs && npm run validate`
- `.active_port` exists only while the server runs — written on start, removed on exit; test runs never touch it (`MAZDA_PORT_FILE=0`).
- Backups before larger changes live in `_backup/` (not versioned).
- `TODO.md` lists open items, `CHANGELOG.md` the version history.

**Regenerate the OCR** (only needed when the PDFs change; the result `config/ocr_text.json` is
versioned):

```powershell
python tools/ocr_pages.py        # renders the pages without text (200 dpi)
powershell -NoProfile -File tools/ocr_batch.ps1 `
  -Manifest "$env:TEMP\mazda-ocr\manifest.json" -Out "$env:TEMP\mazda-ocr\results.json"
node tools/ocr_merge.js "$env:TEMP\mazda-ocr\results.json"
npm run index
```

Requirements: Python 3 with `pymupdf` (`pip install pymupdf`) and a Windows OCR language pack
(de-DE here). The viewer itself needs neither Python nor a network — only this maintenance step.

**Versioning:** the project is a Git repository on `main`. Not versioned: `data\` (451 MB of PDFs),
`node_modules\`, `dist\` and `_backup\`; part of the repository: `public/search_index.json` and
`config/ocr_text.json`, because the viewer does not run without them (~5 MB). Push over SSH:

```powershell
git remote add origin git@github.com:Wintryx/mazda-cx-5-workshop-repair-manual-viewer.git   # once
git push -u origin main
```

The repository lives at
[github.com/Wintryx/mazda-cx-5-workshop-repair-manual-viewer](https://github.com/Wintryx/mazda-cx-5-workshop-repair-manual-viewer)
and is **private**: the index contains titles and keywords extracted from the Mazda manual and is
therefore subject to copyright (see section 12). Releases are tagged `v1.5.0` to `v1.10.0`.

## 11. Desktop app (Windows EXE)

The desktop build is the same viewer wrapped in Electron, so the target machine needs neither Node
nor a browser setup. Two separate steps: **building needs Node**, **running does not**.

### Build it (machine with Node)

```powershell
npm install     # once: pulls Electron and electron-builder as dev dependencies
npm run dist    # builds dist\win-unpacked\ and the installer
```

Output in `dist\`:

| File | Size | Purpose |
|---|---|---|
| `win-unpacked\Mazda-CX5-Viewer.exe` | 362 MB (folder) | portable — copy the folder to a USB stick, run the EXE |
| `Mazda-CX5-Viewer-Setup-<version>.exe` | 108 MB | installer, per user, no admin rights |

**Important:** the `data\` folder with the 7,294 PDFs belongs **next to the EXE**, not inside the
build — the PDFs are deliberately not bundled. On the target machine:

```
Mazda-CX5-Viewer.exe
data\            <- 7,294 PDFs
```

If `data\` is missing, the app shows a dialog with the expected path and exits. Updating the manual
is a copy operation into `data\`, not a new build. Notes and bookmarks live in the Electron profile
(`%APPDATA%\Mazda CX-5 Viewer`).

### Install and run it (target machine, no Node)

**Portable (recommended for a USB stick).** Copy the whole `dist\win-unpacked\` folder to the target
PC and put the PDFs next to the EXE:

```
Mazda-CX5-Viewer\
├─ Mazda-CX5-Viewer.exe
├─ resources\ …
└─ data\             <- 7,294 PDFs (451 MB)
```

Double-click `Mazda-CX5-Viewer.exe`. Nothing is installed, nothing is written outside the folder
except the Electron profile in `%APPDATA%\Mazda CX-5 Viewer` (notes, bookmarks, window state).
Removing the folder removes the program.

**Installer.** Run `dist\Mazda-CX5-Viewer-Setup-1.14.0.exe`. It installs per user without admin
rights — default target `%LOCALAPPDATA%\Programs\Mazda CX-5 Viewer` — and creates Start-menu and
desktop shortcuts. Afterwards copy the `data\` folder into that install directory:

```
%LOCALAPPDATA%\Programs\Mazda CX-5 Viewer\
├─ Mazda-CX5-Viewer.exe
└─ data\             <- 7,294 PDFs
```

Then start it from the Start menu. Uninstall via *Settings → Apps* or the `Uninstall` shortcut —
`data\` is left behind and can be deleted manually.

**First start.** A window opens, the local server picks a free port (not shown in the UI;
`http://localhost:<port>/api/status` reports it), and the viewer behaves exactly like the browser
version: chapters, search, fault codes, notes, print. No Node, no network, no admin rights needed.

**If Windows warns.** The EXE is unsigned, so SmartScreen shows “Windows protected your PC” on the
first launch: click *More info → Run anyway*. If the app closes immediately instead of showing a
window, check the environment variable `ELECTRON_RUN_AS_NODE` (must not be set — it makes Electron
run as plain Node); details are written to `%APPDATA%\Mazda CX-5 Viewer\error.log`.

### Develop the desktop UI

`npm run app` starts the app straight from the source tree in an Electron window — same server, same
`data\` folder as `npm start`, useful while working on the UI. It is not the distribution: end users
get `npm run dist` output only.

## 12. Copyright

The manual PDFs are copyrighted material owned by Mazda. This project is a private workshop tool:
**do not host it publicly, do not redistribute it, do not use it commercially.** The viewer source
code may be adapted freely; all rights to the content remain with Mazda.
