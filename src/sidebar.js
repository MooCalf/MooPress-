import { app, h, icon, on, emit, markDirty, debounce } from './app.js';
import { newChapter } from './project.js';
import { openView, forgetChapter, chapterDoc, focusEditor } from './editor.js';
import { chapterWords } from './stats.js';
import { popover, confirmDialog, refreshIcons, toast } from './ui.js';
import { bibleSection } from './features/bible.js';

const sidebar = () => document.getElementById('sidebar');
let dragId = null;

export function renderSidebar() {
  const p = app.project;
  const list = h('ol.chapter-list', { 'aria-label': 'Chapters' });
  p.chapters.forEach((ch, i) => list.append(chapterItem(ch, i)));

  sidebar().replaceChildren(
    h('div.sb-head', {}, h('h2', {}, 'Your book')),
    h(
      `button.sb-item.title-item${app.view === 'title' ? '.active' : ''}`,
      { onclick: () => openView('title'), 'data-tip': 'Edit your title, subtitle, author name and dedication' },
      h('span.sb-icon', {}, icon('book-open')),
      h('span.sb-text', {}, h('strong', {}, 'Title page'), h('small', {}, p.title || 'Add a title…')),
    ),
    h(
      'div.sb-section',
      {},
      h('span', {}, 'Chapters'),
      h('button.icon-btn.small', { 'data-action': 'newChapter', 'aria-label': 'New chapter' }, icon('plus')),
    ),
    list,
    h('button.sb-add', { 'data-action': 'newChapter' }, icon('plus'), 'New chapter'),
    bibleSection(),
  );
  refreshIcons(sidebar());
}

function chapterItem(ch, i) {
  const active = ch.id === app.view;
  const words = chapterWords(ch.id);
  const more = h('button.icon-btn.small.sb-more', { 'aria-label': `More options for ${ch.title}`, onclick: (e) => { e.stopPropagation(); chapterMenu(more, ch); } }, icon('more-horizontal'));
  const li = h(
    `li.chapter-item${active ? '.active' : ''}`,
    {
      draggable: 'true',
      tabindex: 0,
      dataset: { id: ch.id },
      title: 'Click to open · double-click to rename · drag to reorder',
      onclick: () => openView(ch.id),
      ondblclick: (e) => { e.preventDefault(); startRename(li, ch); },
      onkeydown: (e) => {
        if (e.key === 'Enter') openView(ch.id);
        if (e.key === 'F2') startRename(li, ch);
        if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); moveChapter(ch.id, -1); }
        if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); moveChapter(ch.id, 1); }
      },
    },
    h('span.ch-num', {}, i + 1),
    h('span.sb-text', {}, h('strong.ch-title', {}, ch.title || 'Untitled chapter'), h('small', {}, `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`)),
    more,
  );

  li.addEventListener('dragstart', (e) => {
    dragId = ch.id;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ch.title);
  });
  li.addEventListener('dragend', () => {
    dragId = null;
    li.classList.remove('dragging');
    sidebar().querySelectorAll('.drop-before, .drop-after').forEach((el) => el.classList.remove('drop-before', 'drop-after'));
  });
  li.addEventListener('dragover', (e) => {
    if (!dragId || dragId === ch.id) return;
    e.preventDefault();
    const r = li.getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    li.classList.toggle('drop-after', after);
    li.classList.toggle('drop-before', !after);
  });
  li.addEventListener('dragleave', () => li.classList.remove('drop-before', 'drop-after'));
  li.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!dragId || dragId === ch.id) return;
    const after = li.classList.contains('drop-after');
    const chapters = app.project.chapters;
    const moving = chapters.splice(chapters.findIndex((c) => c.id === dragId), 1)[0];
    const target = chapters.findIndex((c) => c.id === ch.id);
    chapters.splice(after ? target + 1 : target, 0, moving);
    markDirty();
    emit('chapters-changed');
  });
  return li;
}

function chapterMenu(anchor, ch) {
  const idx = app.project.chapters.indexOf(ch);
  const count = app.project.chapters.length;
  popover(anchor, [
    { label: 'Open', icon: 'file-text', onClick: () => openView(ch.id) },
    { label: 'Rename', icon: 'pencil', detail: 'F2', onClick: () => { const li = sidebar().querySelector(`[data-id="${ch.id}"]`); if (li) startRename(li, ch); } },
    { label: 'Duplicate', icon: 'copy', onClick: () => duplicateChapter(ch.id) },
    'separator',
    { label: 'Move up', icon: 'arrow-up', detail: 'Alt+↑', disabled: idx === 0, onClick: () => moveChapter(ch.id, -1) },
    { label: 'Move down', icon: 'arrow-down', detail: 'Alt+↓', disabled: idx === count - 1, onClick: () => moveChapter(ch.id, 1) },
    'separator',
    { label: 'Delete chapter', icon: 'trash-2', disabled: count <= 1, onClick: () => deleteChapter(ch.id) },
  ], { align: 'end' });
}

function startRename(li, ch) {
  const titleEl = li.querySelector('.ch-title');
  const input = h('input.field.rename', { value: ch.title, 'aria-label': 'Chapter name' });
  titleEl.replaceWith(input);
  li.draggable = false;
  input.focus();
  input.select();
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    if (save && input.value.trim() !== ch.title) setChapterTitle(ch.id, input.value.trim());
    else renderSidebar();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('dblclick', (e) => e.stopPropagation());
  input.addEventListener('blur', () => finish(true));
}

export function setChapterTitle(id, title) {
  const ch = app.project.chapters.find((c) => c.id === id);
  if (!ch) return;
  ch.title = title;
  markDirty();
  emit('chapters-changed');
}

export function addChapter() {
  const p = app.project;
  const at = Math.max(0, p.chapters.findIndex((c) => c.id === app.view)) + 1;
  const ch = newChapter(`Chapter ${p.chapters.length + 1}`);
  p.chapters.splice(app.view === 'title' ? p.chapters.length : at, 0, ch);
  markDirty();
  openView(ch.id);
  emit('chapters-changed');
  const title = document.getElementById('chapter-title');
  title.focus();
  title.select();
}

function duplicateChapter(id) {
  const p = app.project;
  const idx = p.chapters.findIndex((c) => c.id === id);
  const src = p.chapters[idx];
  const copy = { ...newChapter(`${src.title} (copy)`), content: chapterDoc(id).toJSON() };
  p.chapters.splice(idx + 1, 0, copy);
  markDirty();
  emit('chapters-changed');
  toast(`Duplicated “${src.title}”.`, 'success');
}

export function moveChapter(id, dir) {
  const chapters = app.project.chapters;
  const i = chapters.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= chapters.length) return;
  [chapters[i], chapters[j]] = [chapters[j], chapters[i]];
  markDirty();
  emit('chapters-changed');
  sidebar().querySelector(`[data-id="${id}"]`)?.focus();
}

async function deleteChapter(id) {
  const p = app.project;
  if (p.chapters.length <= 1) return;
  const ch = p.chapters.find((c) => c.id === id);
  const words = chapterWords(id);
  const ok = await confirmDialog(
    'Delete this chapter?',
    `“${ch.title || 'Untitled chapter'}”${words ? ` and its ${words.toLocaleString()} words` : ''} will be removed from your book. This can’t be undone.`,
    { okLabel: 'Delete chapter', danger: true },
  );
  if (!ok) return;
  const idx = p.chapters.indexOf(ch);
  p.chapters.splice(idx, 1);
  forgetChapter(id);
  if (app.view === id) {
    app.view = null;
    openView(p.chapters[Math.max(0, idx - 1)].id);
  }
  markDirty();
  emit('chapters-changed');
}

export function stepChapter(dir) {
  const ids = ['title', ...app.project.chapters.map((c) => c.id)];
  const i = ids.indexOf(app.view);
  const next = ids[i + dir];
  if (next) {
    openView(next);
    focusEditor();
  }
}

const refreshCounts = debounce(() => {
  const ch = app.project?.chapters.find((c) => c.id === app.view);
  const el = ch && sidebar().querySelector(`[data-id="${ch.id}"] small`);
  if (el) {
    const w = chapterWords(ch.id);
    el.textContent = `${w.toLocaleString()} ${w === 1 ? 'word' : 'words'}`;
  }
}, 400);

on('project-loaded', renderSidebar);
on('chapters-changed', renderSidebar);
on('view-changed', renderSidebar);
on('meta-changed', renderSidebar);
on('bible-changed', renderSidebar);
on('doc-changed', refreshCounts);
