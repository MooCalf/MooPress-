import { app, h, icon, on, debounce } from './app.js';
import { pageCount, currentPage, updateCurrentPage } from './layout.js';
import { chapterWords, bookWords, countWords } from './stats.js';
import { setZoom, zoomToWidth, ZOOM_MIN, ZOOM_MAX } from './view.js';
import { stats as fluffStats, readabilityLabel, readabilityPopover, formatReadingTime } from './features/fluff.js';
import { popover, refreshIcons } from './ui.js';

const bar = () => document.getElementById('statusbar');
let els = null;

export function renderStatusbar() {
  const slider = h('input.zoom-slider', { type: 'range', min: ZOOM_MIN * 100, max: ZOOM_MAX * 100, step: 5, 'aria-label': 'Zoom' });
  slider.addEventListener('input', () => setZoom(slider.value / 100));
  const pct = h('button.status-btn.zoom-pct', { 'data-tip': 'Choose a zoom level' });
  pct.addEventListener('click', () =>
    popover(pct, [
      ...[0.75, 1, 1.25, 1.5, 2].map((z) => ({ label: `${Math.round(z * 100)}%`, checked: Math.abs(app.zoom - z) < 0.01, onClick: () => setZoom(z) })),
      'separator',
      { label: 'Fit page width', icon: 'move-horizontal', onClick: zoomToWidth },
    ], { align: 'end' }),
  );
  const readability = h('button.status-btn.readability-badge', { 'data-tip': 'Readability', 'data-desc': 'How easy this chapter is to read. Click for details.' });
  readability.addEventListener('click', () => readabilityPopover(readability));
  els = {
    location: h('span.status-item'),
    page: h('span.status-item'),
    readability,
    readTime: h('span.status-badge.read-time', { 'data-tip': 'Time to read', 'data-desc': 'At an average reading speed of 238 words a minute. Select text to time just that part.' }),
    words: h('button.status-btn.word-count', { 'data-action': 'wordCount' }),
    slider,
    pct,
  };
  bar().replaceChildren(
    h('div.status-left', {}, els.location, els.page, els.words),
    h(
      'div.status-right',
      {},
      els.readability,
      els.readTime,
      h('span.status-sep'),
      h('button.status-btn', { 'data-action': 'proofing', 'aria-label': 'Spelling & grammar' }, icon('spell-check')),
      h('button.status-btn', { 'data-action': 'typewriter', 'aria-label': 'Typewriter scrolling' }, icon('align-vertical-justify-center')),
      h('button.status-btn', { 'data-action': 'zenMode', 'aria-label': 'Zen mode' }, icon('flower-2')),
      h('span.status-sep'),
      h('button.status-btn', { 'data-action': 'zoomOut', 'aria-label': 'Zoom out' }, icon('minus')),
      slider,
      h('button.status-btn', { 'data-action': 'zoomIn', 'aria-label': 'Zoom in' }, icon('plus')),
      pct,
    ),
  );
  refreshIcons(bar());
  updateStatus();
}

const n = (v) => v.toLocaleString();

export function updateStatus() {
  if (!els || !app.project) return;
  const chapters = app.project.chapters;
  const total = bookWords();
  let words;
  let selectionWords = 0;
  if (app.view === 'title') {
    els.location.textContent = 'Title page';
    els.page.textContent = '';
    words = total;
    els.words.textContent = `${n(total)} words in book`;
  } else {
    const idx = chapters.findIndex((c) => c.id === app.view);
    els.location.textContent = `Chapter ${idx + 1} of ${chapters.length}`;
    els.page.textContent = `Page ${currentPage} of ${pageCount}`;
    words = chapterWords(app.view);
    const { from, to, empty } = app.editor.state.selection;
    if (!empty) selectionWords = countWords(app.editor.state.doc.textBetween(from, to, ' ', ' '));
    els.words.textContent = selectionWords ? `${n(selectionWords)} of ${n(words)} words` : `${n(words)} ${words === 1 ? 'word' : 'words'}`;
    els.words.title = `${n(total)} words in the whole book`;
  }
  els.readTime.replaceChildren(
    icon('clock-3'),
    selectionWords ? `${formatReadingTime(selectionWords)} for selection` : `${formatReadingTime(words)} read`,
  );
  els.readTime.dataset.desc = `Whole book: ${formatReadingTime(total)} at 238 words a minute. Select text to time just that part.`;
  const showScore = app.settings.fluffDetector && app.view !== 'title';
  els.readability.hidden = !showScore;
  if (showScore) {
    const s = fluffStats.score;
    els.readability.replaceChildren(icon('gauge'), s == null ? 'Readability –' : `Readability ${s} · ${readabilityLabel(s)}`);
    els.readability.className = `status-btn readability-badge ${s == null ? '' : s >= 60 ? 'good' : s >= 40 ? 'ok' : 'hard'}`;
  }
  refreshIcons(els.readTime);
  if (showScore) refreshIcons(els.readability);
  els.slider.value = Math.round(app.zoom * 100);
  els.pct.textContent = `${Math.round(app.zoom * 100)}%`;
}

const updateSoon = debounce(updateStatus, 250);
on('doc-changed', updateSoon);
on('view-changed', updateStatus);
on('chapters-changed', updateStatus);
on('project-loaded', updateStatus);
on('pages-changed', updateStatus);
on('zoom-changed', updateStatus);
on('fluff-changed', updateStatus);
on('settings-changed', updateSoon);
on(
  'selection-changed',
  debounce(() => {
    updateCurrentPage();
    updateStatus();
  }, 150),
);
