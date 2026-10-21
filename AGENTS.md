# AGENTS.md — instructions for coding agents

This repository is a private, offline viewer for the Mazda CX-5 (2012–2013) workshop manual:
7,294 PDFs, bilingual search, hotspots, notes and checklists. It runs on plain Node.js without
runtime dependencies; an Electron shell provides a Windows desktop build.

## Language

- **Commit messages: English only.** Imperative mood, subject line ≤ 72 characters, body only when
  it explains *why* something changed. Example: `Fix range handling for suffix requests`.
  History before v1.13.0 is partly German — do not rewrite it.
- `README.md` and this file: English.
- `TODO.md` and `CHANGELOG.md`: German (the maintainer's working notes).
- UI strings: German **and** English via `public/i18n.js`. Every new user-facing string needs both
  entries (`de` is the fallback); dynamic strings go through `t()` in `public/app.js`.
- Code comments: German is fine and consistent with the existing code; keep them short and explain
  *why*, not *what*.

## Before every commit

1. `npm test` must be green (10 smoke + 59 API + 16 search checks).
2. `npm run test:browser` if the frontend changed (39 checks, runs Chrome, starts its own server).
3. Bump `version` in `package.json` for user-visible changes and add a `CHANGELOG.md` entry.
4. Tick the matching items in `TODO.md` (or move them to the current "Erledigt in vX.Y.Z" section).

## Never commit

- `data/` — 451 MB of PDFs, not redistributable (Mazda copyright).
- `node_modules/`, `dist/`, `_backup/`, `.active_port`, `*.log`.
- Secrets or tokens. The repository is **private** for copyright reasons; keep it that way.

## Data

- The manual directory resolves as `MANUAL_DIR` → `config/settings.json` → `data/` (`lib/paths.js`).
- `public/search_index.json` and `config/ocr_text.json` **are** versioned — the viewer does not run
  without them. Rebuild with `npm run index` (needs the PDFs in `data/`).
- OCR (`tools/ocr_pages.py`, `tools/ocr_batch.ps1`, `tools/ocr_merge.js`, `tools/ocr_clean.js`) needs
  Python 3 + PyMuPDF and a Windows OCR language pack; it is only required when the PDFs change.

## Security

- Every file path goes through `safeJoin()`; never join user input into a path directly.
- No CORS wildcard, no directory listing, PDFs only from the manual directory.
- Keep the traversal tests (`/pdf/..%2F…` → 404) and the range tests intact.

## Desktop build

- `npm run dist` builds `dist/win-unpacked/` and the NSIS installer.
- **Delete `dist/win-unpacked/data` (test junction) before building** — otherwise electron-builder
  fails while cleaning the output directory.
- The EXE must run without Node; `MAZDA_SMOKE=1 <exe>` verifies it headlessly and writes
  `%TEMP%\mazda-viewer-smoke.json`.

## Style

- Vanilla JS/Node, no frameworks, no new runtime dependencies. Dev dependencies are fine
  (Playwright, Electron).
- Prefer explicit code over clever code; keep functions small; update tests with the code.
