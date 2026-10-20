"""ocr_pages.py – rendert Seiten ohne Text als PNG für die OCR (Paket D).

Die Beschriftungen der Schaltplan- und Karosseriezeichnungen sind Vektorpfade
und stehen in keinem Textstrom; sie werden erst beim Rendern sichtbar.

Aufruf:
    python tools/ocr_pages.py            # alle Seiten ohne Keywords
    python tools/ocr_pages.py 20         # nur die ersten 20 (Probelauf)

Ergebnis: PNGs und manifest.json in %TEMP%\\mazda-ocr.
Danach tools/ocr_batch.ps1 (Windows-OCR) und tools/ocr_merge.js laufen lassen.
"""
import json
import os
import sys
import tempfile

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
INDEX = os.path.join(ROOT, "public", "search_index.json")
OUTDIR = os.path.join(tempfile.gettempdir(), "mazda-ocr")
DPI = 200

limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0

with open(INDEX, encoding="utf-8") as fh:
    catalog = json.load(fh)

pages = [e for e in catalog if not e.get("kw")]
if limit:
    pages = pages[:limit]

os.makedirs(OUTDIR, exist_ok=True)
manifest = []
for i, entry in enumerate(pages):
    doc = pymupdf.open(os.path.join(DATA, entry["f"]))
    pix = doc[0].get_pixmap(dpi=DPI)
    png = os.path.join(OUTDIR, f"{i:03d}.png")
    pix.save(png)
    doc.close()
    manifest.append({"file": entry["f"], "png": png})
    if (i + 1) % 25 == 0:
        print(f"{i + 1} / {len(pages)}")

with open(os.path.join(OUTDIR, "manifest.json"), "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, ensure_ascii=False)

print(f"{len(manifest)} Seiten gerendert ({DPI} dpi) -> {OUTDIR}")
