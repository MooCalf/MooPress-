import { TextSelection } from '@tiptap/pm/state';
import { app, h, icon, on, markDirty, emit } from './app.js';
import { chapterState, setChapterState, openView } from './editor.js';
import { searchKey, findMatches } from './extensions/decorations.js';
import { showPanel, closePanel, panelOpen } from './panel.js';
import { toast, refreshIcons } from './ui.js';

const opts = { caseSensitive: false, wholeWord: false };
let query = '';
let ui = null;

function setSearch(meta) {
  const { view } = app.editor;
  view.dispatch(view.state.tr.setMeta(searchKey, meta));
}

function searchState() {
  return searchKey.getState(app.editor.state);
}

export function openFind({ replace = false } = {}) {
  if (!app.view || app.view === 'title') {
    const first = app.project.chapters[0];
    if (first) openView(first.id);
  }
  const { state } = app.editor;
  const selected = state.doc.textBetween(state.selection.from, state.selection.to, ' ');
  if (selected && selected.length < 80 && !selected.includes('\n')) query = selected;

  if (panelOpen('find') && ui) {
    ui.findInput.value = query;
    ui.findInput.focus();
    ui.findInput.select();
    if (replace) ui.replaceInput.focus();
    runSearch();
    return;
  }

  const findInput = h('input.field', { type: 'search', placeholder: 'Find in this chapter…', value: query, 'aria-label': 'Find' });
  const replaceInput = h('input.field', { placeholder: 'Replace with…', 'aria-label': 'Replace with' });
  const count = h('div.find-count');
  const bookResults = h('div.find-book');
  const check = (key, label) => {
    const box = h('input', { type: 'checkbox', checked: opts[key] });
    box.addEventListener('change', () => { opts[key] = box.checked; runSearch(); });
    return h('label.check', {}, box, label);
  };

  findInput.addEventListener('input', () => { query = findInput.value; runSearch(); });
  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') { e.preventDefault(); closePanel(); app.editor.commands.focus(); }
  });
  replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); replaceOne(); }
    if (e.key === 'Escape') { e.preventDefault(); closePanel(); app.editor.commands.focus(); }
  });

  const content = h(
    'div.find-panel',
    {},
    h('div.find-row', {}, findInput, h('button.icon-btn', { title: 'Previous (Shift+Enter)', onclick: () => step(-1) }, icon('chevron-up')), h('button.icon-btn', { title: 'Next (Enter)', onclick: () => step(1) }, icon('chevron-down'))),
    count,
    h('div.find-options', {}, check('caseSensitive', 'Match case'), check('wholeWord', 'Whole words only')),
    h('div.find-row', {}, replaceInput),
    h(
      'div.find-actions',
      {},
      h('button.btn', { onclick: replaceOne }, 'Replace'),
      h('button.btn', { onclick: replaceAllChapter }, 'Replace all'),
      h('button.btn.primary', { onclick: replaceAllBook, title: 'Replace in every chapter of the book' }, icon('book-open'), 'Replace in whole book'),
    ),
    h('h3.panel-subhead', {}, 'In the whole book'),
    bookResults,
  );
  ui = { findInput, replaceInput, count, bookResults };
  showPanel('find', 'Find & Replace', content, {
    onClose: () => {
      setSearch({ query: '', index: -1 });
      ui = null;
    },
  });
  findInput.focus();
  findInput.select();
  if (replace && query) replaceInput.focus();
  runSearch();
}

function runSearch() {
  if (!ui) return;
  setSearch({ query, opts: { ...opts } });
  renderCount();
  renderBookResults();
}

function renderCount() {
  if (!ui) return;
  const s = searchState();
  ui.count.textContent = !query ? 'Type something to find it.' : s.matches.length ? `${s.index + 1} of ${s.matches.length} in this chapter` : 'No matches in this chapter.';
  ui.count.classList.toggle('none', !!query && !s.matches.length);
}

function renderBookResults() {
  if (!ui) return;
  ui.bookResults.replaceChildren();
  if (!query) return;
  let total = 0;
  for (const [i, ch] of app.project.chapters.entries()) {
    const n = findMatches(chapterState(ch.id).doc, query, opts).length;
    total += n;
    if (!n) continue;
    ui.bookResults.append(
      h(
        `button.find-chapter${ch.id === app.view ? '.current' : ''}`,
        { onclick: () => { openView(ch.id); runSearch(); step(0); } },
        h('span', {}, ch.title || `Chapter ${i + 1}`),
        h('span.badge', {}, n),
      ),
    );
  }
  if (!total) ui.bookResults.append(h('p.empty', {}, 'Not found anywhere in the book.'));
  refreshIcons(ui.bookResults);
}

function step(dir) {
  const s = searchState();
  if (!s.matches.length) return;
  const index = (s.index + dir + s.matches.length) % s.matches.length;
  const m = s.matches[index];
  const { view } = app.editor;
  view.dispatch(view.state.tr.setMeta(searchKey, { index }).setSelection(TextSelection.create(view.state.doc, m.from, m.to)).scrollIntoView());
  renderCount();
}

function replaceOne() {
  const s = searchState();
  if (!s.matches.length) return;
  const m = s.matches[Math.max(0, s.index)];
  const { view } = app.editor;
  view.dispatch(view.state.tr.insertText(ui.replaceInput.value, m.from, m.to));
  renderCount();
  step(0);
  renderBookResults();
}

function replaceInState(state) {
  const matches = findMatches(state.doc, query, opts);
  if (!matches.length) return { state, n: 0 };
  const tr = state.tr;
  for (const m of [...matches].reverse()) tr.insertText(ui.replaceInput.value, m.from, m.to);
  return { state: state.apply(tr), tr, n: matches.length };
}

function replaceAllChapter() {
  const { view } = app.editor;
  const matches = findMatches(view.state.doc, query, opts);
  if (!matches.length) return toast('Nothing to replace in this chapter.', 'info');
  const tr = view.state.tr;
  for (const m of [...matches].reverse()) tr.insertText(ui.replaceInput.value, m.from, m.to);
  view.dispatch(tr);
  toast(`Replaced ${matches.length} ${matches.length === 1 ? 'match' : 'matches'} in this chapter.`, 'success');
  runSearch();
}

function replaceAllBook() {
  if (!query) return;
  let total = 0;
  let chapters = 0;
  for (const ch of app.project.chapters) {
    if (ch.id === app.view) {
      const { view } = app.editor;
      const matches = findMatches(view.state.doc, query, opts);
      if (!matches.length) continue;
      const tr = view.state.tr;
      for (const m of [...matches].reverse()) tr.insertText(ui.replaceInput.value, m.from, m.to);
      view.dispatch(tr);
      total += matches.length;
      chapters++;
    } else {
      const { state, n } = replaceInState(chapterState(ch.id));
      if (!n) continue;
      setChapterState(ch.id, state);
      total += n;
      chapters++;
    }
  }
  if (!total) return toast('Nothing to replace anywhere in the book.', 'info');
  markDirty();
  emit('doc-changed');
  toast(`Replaced ${total} ${total === 1 ? 'match' : 'matches'} across ${chapters} ${chapters === 1 ? 'chapter' : 'chapters'}.`, 'success');
  runSearch();
}

on('view-changed', () => { if (ui) runSearch(); });
on('doc-changed', () => { if (ui) { renderCount(); } });
