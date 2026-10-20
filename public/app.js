// Mazda CX-5 Universal Service Manual Portal
// v1.4.0 – Fixes: Rotation der Hotspots, Prefetch, Lesezeichen, Sprungfeld, LRU,
//                 Render-Queue, Notizverlust, Escaping; neu: Such-Paging, Live-Highlight,
//                 Checklisten, Druck/Export, Vollbild, Touch-Gesten.
(function () {
  'use strict';

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.js';
  }

  // ---------------------------------------------------------------- Helpers
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const loadJSON = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  };
  const saveJSON = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* Speicher voll */ }
  };

  // ---------------------------------------------------------------- State
  const state = {
    currentFile: 'mazda_cx5_workshop_manual1092.pdf',
    history: [],
    historyIndex: -1,
    scale: 1.25,
    pdfDoc: null,
    viewport: null,
    links: [],
    mediaBox: [0, 0, 595.28, 841.89],
    isRendering: false,
    pending: null,
    activeTab: 'chapters',
    searchQuery: '',
    searchTerms: [],
    searchOffset: 0,
    searchLimit: 60,
    searchTotal: 0,
    bookmarks: loadJSON('mazda_bookmarks', []),
    notes: loadJSON('mazda_notes', {}),
    notesDirty: false,
    checks: loadJSON('mazda_checklists', {}),
    checklists: []
  };

  // ---------------------------------------------------------------- DOM
  const el = {
    canvas: $('pdf-canvas'),
    textLayer: $('text-layer'),
    hotspotOverlay: $('hotspot-overlay'),
    linkTooltip: $('link-tooltip'),
    viewerContainer: $('viewer-container'),
    pageWrapper: $('page-wrapper'),
    loadingOverlay: $('loading-overlay'),
    loadingText: $('loading-text'),
    toast: $('toast'),

    btnBack: $('btn-back'),
    btnForward: $('btn-forward'),
    btnHome: $('btn-home'),
    docSecBadge: $('doc-sec-badge'),
    docNameBadge: $('doc-name-badge'),
    docTitleBar: $('doc-title-bar'),
    inputJumpDoc: $('input-jump-doc'),
    btnPrevPage: $('btn-prev-page'),
    btnNextPage: $('btn-next-page'),

    btnBookmark: $('btn-bookmark'),
    btnNote: $('btn-note'),
    noteBadgeDot: $('note-badge-dot'),

    notesPanel: $('notes-panel'),
    notesPanelDoc: $('notes-panel-doc'),
    notesTextarea: $('notes-textarea'),
    btnSaveNote: $('btn-save-note'),
    btnDeleteNote: $('btn-delete-note'),
    btnCloseNotes: $('btn-close-notes'),

    btnZoomOut: $('btn-zoom-out'),
    btnZoomIn: $('btn-zoom-in'),
    btnFitWidth: $('btn-fit-width'),
    zoomLevelText: $('zoom-level-text'),
    chkHighlightLinks: $('chk-highlight-links'),
    btnRawPdf: $('btn-raw-pdf'),
    btnShortcuts: $('btn-shortcuts'),
    btnPrint: $('btn-print'),
    btnFullscreen: $('btn-fullscreen'),

    shortcutsModal: $('shortcuts-modal'),
    btnCloseShortcuts: $('btn-close-shortcuts'),
    btnModalOk: $('btn-modal-ok'),

    printModal: $('print-modal'),
    printFrom: $('print-from'),
    printTo: $('print-to'),
    printStatus: $('print-status'),
    btnPrintCancel: $('btn-print-cancel'),
    btnPrintStart: $('btn-print-start'),

    btnToggleSidebar: $('btn-toggle-sidebar'),
    sidebar: $('app-sidebar'),
    sidebarSearchInput: $('sidebar-search-input'),
    btnClearSearch: $('btn-clear-search'),
    searchResultsSection: $('search-results-section'),
    searchResultsList: $('search-results-list'),
    searchCount: $('search-count'),
    searchMore: $('search-more'),

    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    chaptersTreeList: $('chapters-tree-list'),
    repairPacksContainer: $('repair-packs-container'),
    userBookmarksList: $('user-bookmarks-list'),
    userNotesList: $('user-notes-list'),
    bookmarksCount: $('bookmarks-count'),
    notesCount: $('notes-count'),
    checklistsList: $('checklists-container'),
    checklistDetail: $('checklist-detail'),
    checklistTitle: $('checklist-title'),
    checklistBody: $('checklist-body'),
    checklistBack: $('btn-checklist-back')
  };

  const ctx = el.canvas.getContext('2d');

  // ---------------------------------------------------------------- Cache
  const docCache = new Map();
  const CACHE_MAX = 12;

  function getDoc(file) {
    const hit = docCache.get(file);
    if (hit) {
      docCache.delete(file);
      docCache.set(file, hit);          // LRU: zuletzt benutzt nach hinten
      return hit.promise;
    }
    const promise = Promise.all([
      window.pdfjsLib.getDocument(`/pdf/${encodeURIComponent(file)}`).promise,
      fetch(`/api/links/${encodeURIComponent(file)}`).then((r) => {
        if (!r.ok) throw new Error(`Links HTTP ${r.status}`);
        return r.json();
      })
    ]).then(([pdfDoc, linkData]) => ({ pdfDoc, linkData }));

    docCache.set(file, { promise });
    promise.catch(() => docCache.delete(file));

    if (docCache.size > CACHE_MAX) {
      for (const key of docCache.keys()) {
        if (key === file || key === state.currentFile) continue;
        const victim = docCache.get(key);
        docCache.delete(key);
        Promise.resolve(victim.promise).then(({ pdfDoc }) => pdfDoc.destroy()).catch(() => {});
        break;
      }
    }
    return promise;
  }

  // ---------------------------------------------------------------- Toast
  let toastTimer = null;
  function toast(msg) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2600);
  }

  // ---------------------------------------------------------------- Loading
  function showLoading(text) {
    el.loadingText.textContent = text || 'Dokument wird geladen …';
    el.loadingOverlay.classList.remove('hidden');
  }
  function hideLoading() {
    el.loadingOverlay.classList.add('hidden');
  }

  // ---------------------------------------------------------------- Navigation
  async function loadPdf(fileName, pushToHistory) {
    if (!fileName) return;
    if (state.isRendering) {
      state.pending = { fileName, pushToHistory };
      return;
    }
    state.isRendering = true;

    if (state.notesDirty) saveCurrentNote(true);

    const cached = docCache.has(fileName);
    if (!cached) showLoading(`Lade ${fileName} …`);

    try {
      const { pdfDoc, linkData } = await getDoc(fileName);
      state.pdfDoc = pdfDoc;
      state.currentFile = fileName;
      state.links = linkData.links || [];
      state.mediaBox = linkData.mediaBox || [0, 0, 595.28, 841.89];

      if (pushToHistory !== false) {
        if (state.historyIndex < state.history.length - 1) {
          state.history = state.history.slice(0, state.historyIndex + 1);
        }
        state.history.push(fileName);
        state.historyIndex = state.history.length - 1;
      }
      updateHistoryButtons();

      if (location.hash.slice(1) !== fileName) {
        history.replaceState(null, '', `#${fileName}`);
      }

      updateHeaderInfo(fileName, linkData.meta);
      updateBookmarkState(fileName);
      updateNoteState(fileName);
      updateSidebarActive(fileName);

      const page = await state.pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: state.scale });
      state.viewport = viewport;

      await renderCanvas(page, viewport);
      await renderTextLayer(page, viewport);
      renderHotspots(viewport);
      applySearchHighlight();
      prefetchNeighbours(fileName);
    } catch (err) {
      console.error('PDF konnte nicht geladen werden:', err);
      toast(`Fehler beim Laden von ${fileName}`);
    } finally {
      state.isRendering = false;
      hideLoading();
      if (state.pending) {
        const next = state.pending;
        state.pending = null;
        loadPdf(next.fileName, next.pushToHistory);
      }
    }
  }

  async function renderCanvas(page, viewport) {
    const outputScale = window.devicePixelRatio || 1;
    el.canvas.width = Math.floor(viewport.width * outputScale);
    el.canvas.height = Math.floor(viewport.height * outputScale);
    el.canvas.style.width = `${Math.floor(viewport.width)}px`;
    el.canvas.style.height = `${Math.floor(viewport.height)}px`;

    el.pageWrapper.style.width = `${Math.floor(viewport.width)}px`;
    el.pageWrapper.style.height = `${Math.floor(viewport.height)}px`;

    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
    await page.render({ canvasContext: ctx, transform, viewport }).promise;
    el.zoomLevelText.textContent = `${Math.round(state.scale * 100)} %`;
  }

  async function renderTextLayer(page, viewport) {
    el.textLayer.innerHTML = '';
    el.textLayer.style.width = `${Math.floor(viewport.width)}px`;
    el.textLayer.style.height = `${Math.floor(viewport.height)}px`;
    el.textLayer.style.setProperty('--scale-factor', viewport.scale);

    try {
      const textContent = await page.getTextContent();
      const task = window.pdfjsLib.renderTextLayer({
        textContentSource: textContent,
        container: el.textLayer,
        viewport,
        textDivs: []
      });
      await (task.promise || task);
    } catch (err) {
      console.warn('TextLayer:', err.message);
    }
  }

  // Hotspots im Viewport-Raum platzieren – inklusive Rotation und CropBox.
  function renderHotspots(viewport) {
    el.hotspotOverlay.innerHTML = '';
    for (const link of state.links) {
      let r;
      try {
        r = viewport.convertToViewportRectangle(link.rect);
      } catch (e) {
        continue;
      }
      if (!r || r.some((n) => !Number.isFinite(n))) continue;

      const left = Math.min(r[0], r[2]);
      const top = Math.min(r[1], r[3]);
      const width = Math.abs(r[2] - r[0]);
      const height = Math.abs(r[3] - r[1]);

      const spot = document.createElement('div');
      spot.className = 'hotspot-link';
      spot.style.left = `${left}px`;
      spot.style.top = `${top}px`;
      spot.style.width = `${width}px`;
      spot.style.height = `${height}px`;
      spot.dataset.target = link.target;

      spot.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        loadPdf(link.target);
      });
      spot.addEventListener('mouseenter', (e) => showTooltip(e, link.target, link.title));
      spot.addEventListener('mouseleave', hideTooltip);

      el.hotspotOverlay.appendChild(spot);
    }
  }

  function showTooltip(e, target, title) {
    const desc = title && title !== target ? ` – ${esc(title)}` : '';
    el.linkTooltip.innerHTML = `<span>➜</span> <strong>${esc(target)}</strong><span class="tooltip-sub">${desc}</span>`;
    el.linkTooltip.classList.remove('hidden');
    el.linkTooltip.style.left = `${e.clientX + 14}px`;
    el.linkTooltip.style.top = `${e.clientY + 14}px`;
  }
  function hideTooltip() { el.linkTooltip.classList.add('hidden'); }

  function updateHeaderInfo(fileName, meta) {
    el.docNameBadge.textContent = fileName;
    el.btnRawPdf.href = `/pdf/${encodeURIComponent(fileName)}`;
    const numMatch = fileName.match(/(\d+)\.pdf$/);
    el.inputJumpDoc.value = numMatch ? numMatch[1] : '';
    el.docSecBadge.textContent = (meta && meta.sec) ? meta.sec : 'DOC';
    el.docTitleBar.textContent = (meta && meta.title) ? meta.title : fileName;
  }

  function updateHistoryButtons() {
    el.btnBack.disabled = state.historyIndex <= 0;
    el.btnForward.disabled = state.historyIndex >= state.history.length - 1;
  }

  function jumpToNumber(value) {
    const raw = String(value || '').trim();
    if (!raw) return;
    if (raw.endsWith('.pdf')) { loadPdf(raw); return; }
    if (!/^\d{1,5}$/.test(raw)) { toast('Bitte eine Dokumentnummer eingeben'); return; }

    let prefix = 'mazda_cx5_workshop_manual';
    const m = state.currentFile.match(/^(.*?)(\d+)\.pdf$/);
    if (m) prefix = m[1];
    else if (state.currentFile.indexOf('technical_guide') >= 0) prefix = 'mazda_cx5_technical_guide_manual';
    else if (state.currentFile.indexOf('wiring_diagrams') >= 0) prefix = 'mazda_cx5_electrical_wiring_diagrams';
    else if (state.currentFile.indexOf('bodyshop') >= 0) prefix = 'mazda_cx5_bodyshop_manual';

    loadPdf(`${prefix}${parseInt(raw, 10)}.pdf`);
  }

  function navigateOffset(offset) {
    const m = state.currentFile.match(/^(.*?)(\d+)\.pdf$/);
    if (!m) { toast('Blättern ist für dieses Dokument nicht möglich'); return; }
    const num = parseInt(m[2], 10) + offset;
    if (num < 1) return;
    loadPdf(`${m[1]}${num}.pdf`);
  }

  function prefetchNeighbours(fileName) {
    const m = fileName.match(/^(.*?)(\d+)\.pdf$/);
    if (m) {
      const num = parseInt(m[2], 10);
      getDoc(`${m[1]}${num + 1}.pdf`).catch(() => {});
      if (num > 1) getDoc(`${m[1]}${num - 1}.pdf`).catch(() => {});
    }
    state.links
      .filter((l) => l.target && l.target.endsWith('.pdf') && l.target !== fileName)
      .slice(0, 3)
      .forEach((l) => getDoc(l.target).catch(() => {}));
  }

  // ---------------------------------------------------------------- Zoom
  async function renderCurrentPageScale() {
    if (!state.pdfDoc) return;
    const page = await state.pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: state.scale });
    state.viewport = viewport;
    await renderCanvas(page, viewport);
    await renderTextLayer(page, viewport);
    renderHotspots(viewport);
    applySearchHighlight();
  }

  function zoomBy(delta) {
    state.scale = Math.max(0.5, Math.min(3.2, state.scale + delta));
    renderCurrentPageScale();
  }

  async function fitWidth() {
    if (!state.pdfDoc) return;
    const page = await state.pdfDoc.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    const available = el.viewerContainer.clientWidth - 56;
    state.scale = Math.max(0.5, Math.min(3.2, available / vp.width));
    await renderCurrentPageScale();
  }

  // ---------------------------------------------------------------- Bookmarks
  function updateBookmarkState(fileName) {
    const active = state.bookmarks.some((b) => b.file === fileName);
    el.btnBookmark.classList.toggle('bookmarked', active);
    el.btnBookmark.title = active ? 'Lesezeichen entfernen (B)' : 'Lesezeichen setzen (B)';
  }

  function toggleBookmark() {
    const file = state.currentFile;
    const idx = state.bookmarks.findIndex((b) => b.file === file);
    if (idx !== -1) {
      state.bookmarks.splice(idx, 1);
      toast('Lesezeichen entfernt');
    } else {
      state.bookmarks.push({
        file,
        sec: el.docSecBadge.textContent,
        title: el.docTitleBar.textContent,
        date: new Date().toLocaleDateString('de-DE')
      });
      toast('Lesezeichen gesetzt');
    }
    saveJSON('mazda_bookmarks', state.bookmarks);
    updateBookmarkState(file);
    renderBookmarks();
  }

  function removeBookmark(file) {
    const idx = state.bookmarks.findIndex((b) => b.file === file);
    if (idx === -1) return;
    state.bookmarks.splice(idx, 1);
    saveJSON('mazda_bookmarks', state.bookmarks);
    updateBookmarkState(state.currentFile);
    renderBookmarks();
  }

  function renderBookmarks() {
    el.bookmarksCount.textContent = state.bookmarks.length;
    if (state.bookmarks.length === 0) {
      el.userBookmarksList.innerHTML = '<div class="empty-state">Noch keine Lesezeichen. Stern (★) im Kopfbereich setzen.</div>';
      return;
    }
    el.userBookmarksList.innerHTML = state.bookmarks.map((b) => `
      <div class="nav-item ${b.file === state.currentFile ? 'active' : ''}" data-file="${esc(b.file)}">
        <span class="nav-item-badge">${esc(b.sec || '★')}</span>
        <span class="nav-item-text" title="${esc(b.title)}">${esc(b.title)}</span>
        <span class="nav-item-action btn-delete-bookmark" data-remove="${esc(b.file)}" title="Entfernen">×</span>
      </div>`).join('');
  }

  // ---------------------------------------------------------------- Notes
  function currentNote(file) {
    return state.notes[file] && state.notes[file].text ? state.notes[file] : null;
  }

  function updateNoteState(fileName) {
    const note = currentNote(fileName);
    el.noteBadgeDot.classList.toggle('hidden', !note);
    el.btnNote.title = note ? 'Notiz bearbeiten (N)' : 'Notiz hinzufügen (N)';
    el.notesPanelDoc.textContent = fileName;
    if (!state.notesDirty) {
      el.notesTextarea.value = note ? note.text : '';
    }
  }

  function persistNote(file, text) {
    const trimmed = (text || '').trim();
    if (trimmed) {
      state.notes[file] = {
        text: trimmed,
        sec: el.docSecBadge.textContent,
        title: el.docTitleBar.textContent,
        date: new Date().toLocaleDateString('de-DE')
      };
    } else {
      delete state.notes[file];
    }
    saveJSON('mazda_notes', state.notes);
    state.notesDirty = false;
  }

  function saveCurrentNote(silent) {
    persistNote(state.currentFile, el.notesTextarea.value);
    updateNoteState(state.currentFile);
    renderNotes();
    if (!silent) {
      el.notesPanel.classList.add('hidden');
      toast('Notiz gespeichert');
    }
  }

  function renderNotes() {
    const keys = Object.keys(state.notes);
    el.notesCount.textContent = keys.length;
    if (keys.length === 0) {
      el.userNotesList.innerHTML = '<div class="empty-state">Noch keine Notizen. Stift (📝) im Kopfbereich öffnet das Notizfeld.</div>';
      return;
    }
    el.userNotesList.innerHTML = keys.map((key) => {
      const n = state.notes[key];
      return `
        <div class="nav-item ${key === state.currentFile ? 'active' : ''}" data-file="${esc(key)}">
          <span class="nav-item-badge">${esc(n.sec || '📝')}</span>
          <div class="nav-item-text" title="${esc(n.title)}">
            <div class="note-title">${esc(n.title)}</div>
            <div class="note-preview">${esc(n.text)}</div>
          </div>
        </div>`;
    }).join('');
  }

  // ---------------------------------------------------------------- Suche
  function markTerms(text, terms) {
    if (!text) return '';
    const list = (terms || []).filter((t) => t && t.length > 1)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (list.length === 0) return esc(text);
    const re = new RegExp(`(${list.join('|')})`, 'gi');
    return esc(text).replace(re, '<mark class="search-match">$1</mark>');
  }

  function applySearchHighlight() {
    el.textLayer.querySelectorAll('.search-highlight').forEach((n) => n.classList.remove('search-highlight'));
    const terms = (state.searchTerms || []).filter((t) => t.length > 1).map((t) => t.toLowerCase());
    if (terms.length === 0) return;
    el.textLayer.querySelectorAll('span').forEach((span) => {
      const txt = span.textContent.toLowerCase();
      if (terms.some((t) => txt.includes(t))) span.classList.add('search-highlight');
    });
  }

  async function performSearch(query, append) {
    const q = (query || '').trim();
    state.searchQuery = q;
    if (!q) {
      el.searchResultsSection.classList.add('hidden');
      state.searchTerms = [];
      applySearchHighlight();
      return;
    }
    const offset = append ? state.searchOffset + state.searchLimit : 0;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${state.searchLimit}&offset=${offset}`);
      const data = await res.json();
      state.searchTerms = data.terms || [];
      state.searchTotal = data.total || 0;
      state.searchOffset = offset;

      el.searchCount.textContent = data.total || 0;
      el.searchResultsSection.classList.remove('hidden');

      // Fehlercode? Dann Hinweis über den Treffern zeigen.
      const dtcHint = document.getElementById('dtc-hint');
      if (dtcHint) {
        if (data.dtc) {
          dtcHint.textContent = data.dtc.total
            ? `Fehlercode ${data.dtc.code}: ${data.dtc.total} Dokumente – Diagnoseblätter zuerst`
            : `Fehlercode ${data.dtc.code} ist im Handbuch nicht dokumentiert`;
          dtcHint.classList.remove('hidden');
        } else {
          dtcHint.classList.add('hidden');
        }
      }

      const html = (data.results || []).map((item) => `
        <a href="#" class="nav-item ${item.f === state.currentFile ? 'active' : ''}" data-file="${esc(item.f)}">
          <span class="nav-item-badge">${esc(item.sec || item.grp || 'DOC')}</span>
          <div class="nav-item-text" title="${esc(item.t || item.f)}">
            <div class="result-title">${markTerms(item.t || item.f, state.searchTerms)}</div>
            ${item.snippet ? `<div class="result-snippet">${markTerms(item.snippet, state.searchTerms)}</div>` : ''}
          </div>
        </a>`).join('');

      if (append) {
        el.searchResultsList.insertAdjacentHTML('beforeend', html);
      } else {
        el.searchResultsList.innerHTML = html || '<div class="empty-state">Keine Treffer.</div>';
      }

      const shown = state.searchOffset + (data.results || []).length;
      const remaining = state.searchTotal - shown;
      if (remaining > 0) {
        el.searchMore.classList.remove('hidden');
        el.searchMore.textContent = `Weitere ${Math.min(remaining, state.searchLimit)} von ${remaining} laden`;
      } else {
        el.searchMore.classList.add('hidden');
      }

      applySearchHighlight();
      if (data.fuzzy) toast('Keine exakten Treffer – ähnliche Begriffe angezeigt');
    } catch (err) {
      console.error('Suche fehlgeschlagen:', err);
      toast('Suche fehlgeschlagen');
    }
  }

  // ---------------------------------------------------------------- Kapitel / Packs
  async function loadChapters() {
    try {
      const chapters = await (await fetch('/api/chapters')).json();
      el.chaptersTreeList.innerHTML = chapters.map((c) => {
        const hasSub = Array.isArray(c.subsections) && c.subsections.length > 0;
        return `
          <div class="chapter-card">
            <div class="chapter-header" data-file="${esc(c.startFile)}">
              <span class="chapter-icon">${c.icon || '📄'}</span>
              <div class="chapter-info">
                <div class="chapter-title">${esc(c.title)}</div>
                <div class="chapter-desc">${esc(c.description || '')}</div>
              </div>
              ${hasSub ? '<span class="chapter-arrow">▶</span>' : ''}
            </div>
            ${hasSub ? `<div class="chapter-sub-list">${c.subsections.map((s) => `
              <a href="#" class="nav-item" data-file="${esc(s.file)}">
                <span class="nav-item-badge">Sub</span>
                <span class="nav-item-text" title="${esc(s.title)}">${esc(s.title)}</span>
              </a>`).join('')}</div>` : ''}
          </div>`;
      }).join('');

      el.chaptersTreeList.querySelectorAll('.chapter-header').forEach((header) => {
        header.addEventListener('click', (e) => {
          const card = header.closest('.chapter-card');
          if (e.target.classList.contains('chapter-arrow')) {
            card.classList.toggle('open');
            e.preventDefault();
            return;
          }
          if (header.dataset.file) loadPdf(header.dataset.file);
          if (card.querySelector('.chapter-sub-list')) card.classList.toggle('open');
        });
      });
    } catch (err) {
      console.warn('Kapitel konnten nicht geladen werden:', err);
    }
  }

  // ---------------------------------------------------------------- Sektionsbaum (v1.8.0)
  // Gruppe → Sektion → Dokumente, aus /api/tree (entsteht aus dem Suchindex).
  let treeData = null;

  async function initSectionTree() {
    const box = document.getElementById('section-tree');
    if (!box || treeData) return;
    try {
      treeData = await (await fetch('/api/tree')).json();
    } catch (err) {
      console.warn('Sektionsbaum nicht verfügbar:', err);
      box.innerHTML = '<div class="tree-loading">Kapitelbaum nicht verfügbar</div>';
      return;
    }
    box.innerHTML = treeData.map((g, gi) => `
      <div class="tree-group">
        <button class="tree-head" data-kind="group" data-group="${gi}">
          <span class="tree-caret">▶</span>
          <span class="tree-name">${esc(g.label)}</span>
          <span class="badge-count">${g.count}</span>
        </button>
        <div class="tree-body hidden"></div>
      </div>`).join('');
  }

  function renderTreeSections(gi, bodyEl) {
    if (bodyEl.dataset.filled) return;
    bodyEl.dataset.filled = '1';
    bodyEl.innerHTML = treeData[gi].sections.map((s, si) => `
      <div class="tree-section">
        <button class="tree-head tree-head-sub" data-kind="section" data-group="${gi}" data-index="${si}">
          <span class="tree-caret">▶</span>
          <span class="tree-code">${esc(s.code || 'ohne Code')}</span>
          <span class="tree-name">${esc(s.label || '')}</span>
          <span class="badge-count">${s.count}</span>
        </button>
        <div class="tree-docs hidden"></div>
      </div>`).join('');
  }

  function renderTreeDocs(gi, si, docsEl) {
    if (docsEl.dataset.filled) return;
    docsEl.dataset.filled = '1';
    const section = treeData[gi].sections[si];
    docsEl.innerHTML = section.docs.map((d) => `
      <a href="#" class="nav-item tree-doc" data-file="${esc(d.f)}">
        <span class="nav-item-badge">${esc(d.s || '–')}</span>
        <span class="nav-item-text" title="${esc(d.t || d.f)}">${esc(d.t || d.f)}</span>
      </a>`).join('');
  }

  async function loadPacks() {
    try {
      const packs = await (await fetch('/api/favorites')).json();
      el.repairPacksContainer.innerHTML = packs.map((pack) => `
        <div class="sidebar-section pack">
          <div class="section-header"><span>${esc(pack.category)}</span></div>
          <div class="nav-list">
            ${pack.items.map((item) => `
              <a href="#" class="nav-item" data-file="${esc(item.file)}">
                <span class="nav-item-badge">${esc(item.sec)}</span>
                <span class="nav-item-text" title="${esc(item.title)}">${esc(item.title)}</span>
              </a>`).join('')}
          </div>
        </div>`).join('');
    } catch (err) {
      console.warn('Reparatur-Packs konnten nicht geladen werden:', err);
    }
  }

  // ---------------------------------------------------------------- Checklisten
  async function loadChecklists() {
    try {
      state.checklists = await (await fetch('/api/checklists')).json();
      renderChecklists();
    } catch (err) {
      console.warn('Checklisten konnten nicht geladen werden:', err);
    }
  }

  function checklistProgress(id) {
    const done = state.checks[id] || [];
    const list = state.checklists.find((c) => c.id === id);
    return { done: done.length, total: list ? list.steps.length : 0 };
  }

  function renderChecklists() {
    if (!state.checklists.length) {
      el.checklistsList.innerHTML = '<div class="empty-state">Keine Checklisten hinterlegt.</div>';
      return;
    }
    el.checklistsList.innerHTML = state.checklists.map((c) => {
      const p = checklistProgress(c.id);
      const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
      return `
        <div class="checklist-card" data-checklist="${esc(c.id)}">
          <div class="checklist-card-head">
            <span class="checklist-card-title">${esc(c.title)}</span>
            <span class="badge-count">${p.done}/${p.total}</span>
          </div>
          <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
        </div>`;
    }).join('');

    el.checklistsList.querySelectorAll('.checklist-card').forEach((card) => {
      card.addEventListener('click', () => openChecklist(card.dataset.checklist));
    });
  }

  function openChecklist(id) {
    const list = state.checklists.find((c) => c.id === id);
    if (!list) return;
    const done = new Set(state.checks[id] || []);
    el.checklistTitle.textContent = list.title;
    el.checklistBody.innerHTML = `
      <div class="checklist-steps">
        ${list.steps.map((step, i) => `
          <label class="checklist-step ${done.has(i) ? 'done' : ''}">
            <input type="checkbox" data-idx="${i}" ${done.has(i) ? 'checked' : ''}>
            <span class="step-text">${esc(step.text)}</span>
            <span class="step-link" data-load="${esc(step.file)}" title="Seite öffnen">➜</span>
          </label>`).join('')}
      </div>
      <div class="checklist-footer">
        <button class="btn-action-danger" id="btn-checklist-reset">Zurücksetzen</button>
      </div>`;

    el.checklistDetail.classList.remove('hidden');
    el.checklistsList.classList.add('hidden');

    el.checklistDetail.querySelectorAll('input[type=checkbox]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const idx = parseInt(cb.dataset.idx, 10);
        const set = new Set(state.checks[id] || []);
        if (cb.checked) set.add(idx); else set.delete(idx);
        state.checks[id] = [...set].sort((a, b) => a - b);
        saveJSON('mazda_checklists', state.checks);
        cb.closest('.checklist-step').classList.toggle('done', cb.checked);
      });
    });

    const reset = el.checklistDetail.querySelector('#btn-checklist-reset');
    if (reset) {
      reset.addEventListener('click', () => {
        delete state.checks[id];
        saveJSON('mazda_checklists', state.checks);
        openChecklist(id);
      });
    }
  }

  function closeChecklist() {
    el.checklistDetail.classList.add('hidden');
    el.checklistsList.classList.remove('hidden');
    renderChecklists();
  }

  // ---------------------------------------------------------------- Druck
  function openPrintModal() {
    const m = state.currentFile.match(/(\d+)\.pdf$/);
    const num = m ? parseInt(m[1], 10) : 1;
    el.printFrom.value = num;
    el.printTo.value = num;
    el.printStatus.textContent = '';
    el.printModal.classList.remove('hidden');
  }

  async function printRange() {
    const fromRaw = parseInt(el.printFrom.value, 10);
    let to = parseInt(el.printTo.value, 10);
    let from = fromRaw;
    if (!Number.isFinite(from) || !Number.isFinite(to)) { el.printStatus.textContent = 'Bitte gültige Nummern eingeben.'; return; }
    if (to < from) { const t = to; to = from; from = t; }
    if (to - from > 19) { el.printStatus.textContent = 'Maximal 20 Seiten auf einmal.'; return; }

    const prefixMatch = state.currentFile.match(/^(.*?)\d+\.pdf$/);
    const prefix = prefixMatch ? prefixMatch[1] : 'mazda_cx5_workshop_manual';

    const win = window.open('', '_blank');
    if (!win) { el.printStatus.textContent = 'Popup blockiert – bitte erlauben.'; return; }
    win.document.write('<html><head><title>Mazda CX-5 – Ausdruck</title><style>' +
      'body{font-family:Arial,sans-serif;margin:0}img{width:100%;display:block;page-break-after:always}' +
      '</style></head><body><p style="padding:10px">Seiten werden vorbereitet …</p></body></html>');

    for (let n = from; n <= to; n++) {
      const file = `${prefix}${n}.pdf`;
      el.printStatus.textContent = `Rendere ${n} von ${to} …`;
      try {
        const { pdfDoc } = await getDoc(file);
        const page = await pdfDoc.getPage(1);
        const vp = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        const img = win.document.createElement('img');
        img.src = canvas.toDataURL('image/jpeg', 0.92);
        win.document.body.appendChild(img);
      } catch (e) {
        console.warn('Seite nicht druckbar:', file, e.message);
      }
    }
    win.document.close();
    el.printStatus.textContent = 'Druckdialog wird geöffnet …';
    setTimeout(() => { try { win.focus(); win.print(); } catch (e) { /* abgebrochen */ } }, 600);
    el.printModal.classList.add('hidden');
  }

  // ---------------------------------------------------------------- Tabs
  function switchTab(tab) {
    state.activeTab = tab;
    el.tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    el.tabContents.forEach((c) => c.classList.toggle('active', c.id === `tab-content-${tab}`));
  }

  function updateSidebarActive(fileName) {
    document.querySelectorAll('.nav-item').forEach((n) => {
      n.classList.toggle('active', n.dataset.file === fileName);
    });
  }

  // ---------------------------------------------------------------- Events
  function setupEvents() {
    el.tabBtns.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

    el.btnBookmark.addEventListener('click', toggleBookmark);
    el.btnNote.addEventListener('click', () => {
      el.notesPanel.classList.toggle('hidden');
      if (!el.notesPanel.classList.contains('hidden')) el.notesTextarea.focus();
    });
    el.btnCloseNotes.addEventListener('click', () => el.notesPanel.classList.add('hidden'));
    el.btnSaveNote.addEventListener('click', () => saveCurrentNote(false));
    el.btnDeleteNote.addEventListener('click', () => {
      el.notesTextarea.value = '';
      persistNote(state.currentFile, '');
      updateNoteState(state.currentFile);
      renderNotes();
      el.notesPanel.classList.add('hidden');
    });
    el.notesTextarea.addEventListener('input', () => { state.notesDirty = true; });

    el.btnBack.addEventListener('click', () => {
      if (state.historyIndex > 0) {
        state.historyIndex--;
        loadPdf(state.history[state.historyIndex], false);
      }
    });
    el.btnForward.addEventListener('click', () => {
      if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        loadPdf(state.history[state.historyIndex], false);
      }
    });
    el.btnHome.addEventListener('click', () => loadPdf('mazda_cx5_workshop_manual3.pdf'));

    el.btnPrevPage.addEventListener('click', () => navigateOffset(-1));
    el.btnNextPage.addEventListener('click', () => navigateOffset(1));

    el.inputJumpDoc.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { jumpToNumber(el.inputJumpDoc.value); el.inputJumpDoc.blur(); }
    });

    el.btnZoomIn.addEventListener('click', () => zoomBy(0.15));
    el.btnZoomOut.addEventListener('click', () => zoomBy(-0.15));
    el.btnFitWidth.addEventListener('click', fitWidth);

    el.chkHighlightLinks.addEventListener('change', (e) => {
      document.body.classList.toggle('highlight-links', e.target.checked);
    });

    el.btnToggleSidebar.addEventListener('click', () => el.sidebar.classList.toggle('collapsed'));

    el.btnShortcuts.addEventListener('click', () => el.shortcutsModal.classList.toggle('hidden'));
    el.btnCloseShortcuts.addEventListener('click', () => el.shortcutsModal.classList.add('hidden'));
    el.btnModalOk.addEventListener('click', () => el.shortcutsModal.classList.add('hidden'));
    el.shortcutsModal.addEventListener('click', (e) => {
      if (e.target === el.shortcutsModal) el.shortcutsModal.classList.add('hidden');
    });

    el.btnPrint.addEventListener('click', openPrintModal);
    el.btnPrintCancel.addEventListener('click', () => el.printModal.classList.add('hidden'));
    el.btnPrintStart.addEventListener('click', printRange);
    el.printModal.addEventListener('click', (e) => {
      if (e.target === el.printModal) el.printModal.classList.add('hidden');
    });

    el.btnFullscreen.addEventListener('click', toggleFullscreen);
    el.checklistBack.addEventListener('click', closeChecklist);

    // Ein einziger Delegate-Handler für alle klickbaren Listenpunkte
    document.addEventListener('click', (e) => {
      // Sektionsbaum: Gruppe oder Sektion auf-/zuklappen
      const head = e.target.closest('.tree-head');
      if (head) {
        e.preventDefault();
        const gi = parseInt(head.dataset.group, 10);
        const wrap = head.parentElement;
        if (head.dataset.kind === 'group') {
          const body = wrap.querySelector('.tree-body');
          renderTreeSections(gi, body);
          body.classList.toggle('hidden');
          wrap.classList.toggle('open');
        } else {
          const si = parseInt(head.dataset.index, 10);
          const docsEl = wrap.querySelector('.tree-docs');
          renderTreeDocs(gi, si, docsEl);
          docsEl.classList.toggle('hidden');
          wrap.classList.toggle('open');
        }
        return;
      }
      const del = e.target.closest('.btn-delete-bookmark');
      if (del) {
        e.preventDefault();
        e.stopPropagation();
        removeBookmark(del.dataset.remove);
        return;
      }
      const link = e.target.closest('[data-load]');
      if (link) {
        e.preventDefault();
        e.stopPropagation();
        loadPdf(link.dataset.load);
        return;
      }
      const item = e.target.closest('.nav-item');
      if (item && item.dataset.file) {
        e.preventDefault();
        loadPdf(item.dataset.file);
        return;
      }
      // Quellenlinks in Karten (z. B. Drehmoment-Zeile → 01-14B-38)
      const src = e.target.closest('.inline-link[data-file]');
      if (src) {
        e.preventDefault();
        e.stopPropagation();
        loadPdf(src.dataset.file);
      }
    });

    el.searchMore.addEventListener('click', () => performSearch(state.searchQuery, true));

    let debounce = null;
    el.sidebarSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      el.btnClearSearch.classList.toggle('hidden', !q);
      clearTimeout(debounce);
      if (!q) {
        state.searchTerms = [];
        el.searchResultsSection.classList.add('hidden');
        el.searchMore.classList.add('hidden');
        applySearchHighlight();
        return;
      }
      debounce = setTimeout(() => performSearch(q, false), 220);
    });

    el.btnClearSearch.addEventListener('click', () => {
      el.sidebarSearchInput.value = '';
      el.btnClearSearch.classList.add('hidden');
      el.searchResultsSection.classList.add('hidden');
      el.searchMore.classList.add('hidden');
      state.searchQuery = '';
      state.searchTerms = [];
      applySearchHighlight();
    });

    window.addEventListener('keydown', (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') {
          e.target.blur();
          el.notesPanel.classList.add('hidden');
          el.shortcutsModal.classList.add('hidden');
          el.printModal.classList.add('hidden');
        }
        return;
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) { e.preventDefault(); el.shortcutsModal.classList.toggle('hidden'); return; }
      if (e.key === 'Escape') {
        el.notesPanel.classList.add('hidden');
        el.shortcutsModal.classList.add('hidden');
        el.printModal.classList.add('hidden');
        return;
      }
      if (e.altKey && e.key === 'ArrowLeft') el.btnBack.click();
      else if (e.altKey && e.key === 'ArrowRight') el.btnForward.click();
      else if (e.key === 'ArrowLeft') el.btnPrevPage.click();
      else if (e.key === 'ArrowRight') el.btnNextPage.click();
      else if (e.key === '+' || e.key === '=') el.btnZoomIn.click();
      else if (e.key === '-') el.btnZoomOut.click();
      else if (e.key === 'w' || e.key === 'W') el.btnFitWidth.click();
      else if (e.key === 's' || e.key === 'S') el.sidebar.classList.toggle('collapsed');
      else if (e.key === 'b' || e.key === 'B') toggleBookmark();
      else if (e.key === 'n' || e.key === 'N') el.btnNote.click();
      else if (e.key === 'p' || e.key === 'P') openPrintModal();
      else if (e.key === 'f' || e.key === 'F' || e.key === '/') {
        e.preventDefault();
        el.sidebarSearchInput.focus();
        el.sidebarSearchInput.select();
      }
    });

    // Touch: Wischen blättert
    let touchX = null;
    let touchY = null;
    el.viewerContainer.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) { touchX = null; return; }
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    }, { passive: true });
    el.viewerContainer.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = e.changedTouches[0].clientY - touchY;
      touchX = null;
      if (Math.abs(dx) > 70 && Math.abs(dy) < 60) navigateOffset(dx < 0 ? 1 : -1);
    }, { passive: true });

    window.addEventListener('hashchange', () => {
      const hash = location.hash.replace('#', '').trim();
      if (hash && hash.endsWith('.pdf') && hash !== state.currentFile) loadPdf(hash);
    });
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
      document.body.classList.add('workshop-mode');
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      document.body.classList.remove('workshop-mode');
    }
  }

  // ---------------------------------------------------------------- Init
  async function init() {
    setupEvents();
    renderBookmarks();
    renderNotes();

    await Promise.all([loadChapters(), loadPacks(), loadChecklists()]);
    initSectionTree();

    const hash = location.hash.replace('#', '').trim();
    await loadPdf(hash && hash.endsWith('.pdf') ? hash : state.currentFile);

    document.body.classList.add('highlight-links');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
