import '@fontsource/nunito/800.css';
import { app, on, emit, markDirty, debounce } from './app.js';
import { loadSettings, setSetting, openSettings } from './settings.js';
import { registerActions } from './actions.js';
import { actions, bindingFor, formatCombo, rebuildKeymap, initShortcutDispatcher } from './keybinds.js';
import { createEditor, activeChapter, focusEditor } from './editor.js';
import { buildRibbon } from './ribbon.js';
import { setChapterTitle } from './sidebar.js';
import { renderStatusbar } from './statusbar.js';
import { applyLayout, schedulePageGuides } from './layout.js';
import { loadProject, offerRecovery, startBackgroundSaving, openBook, fileFormat } from './fileops.js';
import { FORMAT_NAMES } from './formats/index.js';
import { logoIcon } from './assets.js';
import { startTour } from './features/tour.js';
import { createProject, bookName } from './project.js';
import { initTooltips, refreshIcons } from './ui.js';
import { applyTheme, initZoom, applySidebar, applyRibbonCollapsed } from './view.js';
import './proofing.js';
import './find.js';
import './features/fluff.js';
import { initTimeMachine } from './features/timeMachine.js';
import { initSynonyms } from './features/synonyms.js';
import { initSnippets } from './features/snippets.js';
import { initClipRing } from './features/clipRing.js';
import { initFocusPalette } from './features/focusPalette.js';
import { initRadialMenu } from './features/radialMenu.js';
import { initBible } from './features/bible.js';
import { applyTypewriter } from './features/typewriter.js';

const $ = (id) => document.getElementById(id);

function tooltipFor(el) {
  const id = el.dataset.action;
  const a = id && actions.get(id);
  if (a) return { title: el.dataset.tip || a.label, shortcut: formatCombo(bindingFor(id)), description: el.dataset.desc || a.description };
  return el.dataset.tip ? { title: el.dataset.tip, description: el.dataset.desc } : null;
}

function autosize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function wireTitlePage() {
  const fields = { 'tp-title': 'title', 'tp-subtitle': 'subtitle', 'tp-author': 'author', 'tp-dedication': 'dedication' };
  for (const [id, key] of Object.entries(fields)) {
    const el = $(id);
    el.addEventListener('input', () => {
      app.project[key] = el.value;
      if (el.tagName === 'TEXTAREA') autosize(el);
      markDirty();
      emit('meta-changed');
    });
  }
  $('tp-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('tp-subtitle').focus(); }
  });
}

function fillTitlePage() {
  const p = app.project;
  $('tp-title').value = p.title;
  $('tp-subtitle').value = p.subtitle;
  $('tp-author').value = p.author;
  $('tp-dedication').value = p.dedication;
  requestAnimationFrame(() => { autosize($('tp-title')); autosize($('tp-dedication')); });
}

function wireChapterTitle() {
  const input = $('chapter-title');
  input.addEventListener('input', () => setChapterTitle(app.view, input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      app.editor.commands.focus('start');
    }
  });
}

function showView() {
  const isTitle = app.view === 'title';
  $('paper').hidden = isTitle;
  $('title-page').hidden = !isTitle;
  if (isTitle) {
    fillTitlePage();
    if (!app.project.title) requestAnimationFrame(() => $('tp-title').focus());
  } else {
    const ch = activeChapter();
    if (document.activeElement !== $('chapter-title')) $('chapter-title').value = ch?.title || '';
    $('canvas').scrollTop = 0;
    schedulePageGuides();
  }
}

function updateDocName() {
  const name = bookName(app.project);
  $('doc-name').textContent = name;
  document.title = `${app.dirty ? '• ' : ''}${name} — MooPress`;
  const state = $('save-state');
  if (app.dirty) {
    state.textContent = app.filePath ? 'Unsaved changes' : 'Not saved yet';
    state.className = 'save-state dirty';
  } else if (app.filePath) {
    const fmt = fileFormat();
    state.textContent = fmt === 'moopress' ? 'Saved' : `${FORMAT_NAMES[fmt] || fmt.toUpperCase()} · Saved`;
    state.className = 'save-state clean';
  } else {
    state.textContent = '';
    state.className = 'save-state';
  }
}

function setRibbonToggleIcon() {
  const btn = $('ribbon-toggle');
  btn.innerHTML = `<i data-lucide="${app.settings.ribbonCollapsed ? 'chevron-down' : 'chevron-up'}"></i>`;
  btn.dataset.tip = app.settings.ribbonCollapsed ? 'Show the ribbon' : 'Collapse the ribbon (double-click a tab also works)';
  refreshIcons(btn);
}

function wireTopbar() {
  $('ribbon-toggle').addEventListener('click', () => setSetting('ribbonCollapsed', !app.settings.ribbonCollapsed));
  on('settings-changed', (key) => {
    if (key === 'ribbonCollapsed') setRibbonToggleIcon();
  });
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-open-settings]');
    if (link) {
      e.preventDefault();
      openSettings(link.dataset.openSettings);
    }
  });
}

function wireCanvas() {
  window.addEventListener('scroll', () => window.scrollTo(0, 0));
  document.getElementById('app').addEventListener('scroll', (e) => { e.currentTarget.scrollTop = 0; });
  $('canvas').addEventListener('mousedown', (e) => {
    if ((e.target === $('canvas') || e.target === $('zoom-layer')) && app.view !== 'title') {
      e.preventDefault();
      app.editor.commands.focus('end');
    }
  });
  new ResizeObserver(() => schedulePageGuides()).observe($('editor-mount'));
}

async function boot() {
  await loadSettings();
  applyTheme();
  registerActions();
  rebuildKeymap();
  initShortcutDispatcher();
  createEditor($('editor-mount'));
  initTimeMachine();
  initSynonyms();
  initSnippets();
  initClipRing();
  initFocusPalette();
  initRadialMenu();
  initBible();
  applyTypewriter();

  on('project-loaded', () => {
    applyLayout();
    updateDocName();
  });
  on('view-changed', showView);
  on('dirty-changed', updateDocName);
  on('saved', ({ quiet }) => {
    updateDocName();
    if (quiet) $('save-state').textContent = `Autosaved at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  });
  on('meta-changed', debounce(() => { updateDocName(); applyLayout(); }, 150));
  on('doc-changed', schedulePageGuides);

  loadProject(createProject(), null);
  buildRibbon();
  renderStatusbar();
  applySidebar();
  applyRibbonCollapsed();
  initZoom();
  initTooltips(tooltipFor);
  wireTitlePage();
  wireChapterTitle();
  wireTopbar();
  wireCanvas();
  $('brand-logo').src = logoIcon;
  setRibbonToggleIcon();
  refreshIcons();
  startBackgroundSaving();
  window.moopress.onOpenFile((path) => openBook(path));

  const restored = await offerRecovery();
  if (!restored) {
    const launch = await window.moopress.launchFile();
    if (launch) await openBook(launch);
  }
  focusEditor();
  if (!app.settings.tourDone) setTimeout(startTour, 600);
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('afterbegin', `<pre class="boot-error">MooPress could not start:\n${String(err?.stack || err)}</pre>`);
});
