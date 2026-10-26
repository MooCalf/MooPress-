import { DOMSerializer } from '@tiptap/pm/model';
import { app, h, icon, on, emit } from '../app.js';
import { activeChapter } from '../editor.js';
import { refreshIcons, toast, confirmDialog } from '../ui.js';

const KEEP_MS = 10 * 60 * 1000;
const EVERY_MS = 5000;
const history = new Map();
let ui = null;

function record(id, doc, force = false) {
  const now = Date.now();
  const list = (history.get(id) || []).filter((s) => now - s.t <= KEEP_MS);
  const last = list.at(-1);
  if (last && (last.doc.eq(doc) || (!force && now - last.t < EVERY_MS))) {
    history.set(id, list);
    return;
  }
  list.push({ t: now, doc });
  history.set(id, list);
}

export function initTimeMachine() {
  app.editor.on('transaction', ({ transaction: tr }) => {
    if (!tr.docChanged || !app.view || app.view === 'title') return;
    const bigDelete = tr.before.content.size - tr.doc.content.size > 80;
    record(app.view, tr.before, bigDelete);
    if (ui) renderPreview();
  });
  on('view-changed', () => {
    if (ui) closeTimeMachine();
    if (app.view && app.view !== 'title') record(app.view, app.editor.state.doc, true);
  });
  on('project-loaded', () => history.clear());
}

const blockKey = (node) => `${node.type.name}:${node.textContent.trim()}`;

function snapshots() {
  const now = Date.now();
  const list = (history.get(app.view) || []).filter((s) => now - s.t <= KEEP_MS && !s.doc.eq(app.editor.state.doc));
  return [...list, { t: now, doc: app.editor.state.doc, current: true }];
}

function ago(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 5) return 'Now';
  if (s < 60) return `${s} seconds ago`;
  const m = Math.floor(s / 60);
  return `${m} min ${s % 60 ? `${s % 60} s ` : ''}ago`;
}

export function openTimeMachine() {
  if (!app.view || app.view === 'title') return toast('Open a chapter to travel back through its history.', 'info');
  if (ui) return closeTimeMachine();
  const list = snapshots();
  const slider = h('input.tm-slider', { type: 'range', min: 0, max: list.length - 1, value: list.length - 1, step: 1, 'aria-label': 'Point in time' });
  const when = h('div.tm-when');
  const diff = h('div.tm-diff');
  const restoreAll = h('button.btn.primary', { onclick: restoreVersion }, icon('history'), 'Restore this version');
  const bar = h(
    'div.tm-bar',
    {},
    h('div.tm-title', {}, icon('clock-arrow-up'), h('strong', {}, 'Time Machine')),
    h('div.tm-track', {}, h('span.tm-end', {}, '10 min ago'), slider, h('span.tm-end', {}, 'Now')),
    h('div.tm-info', {}, when, diff),
    restoreAll,
    h('button.btn', { onclick: closeTimeMachine }, 'Back to now'),
  );
  const paperSrc = document.getElementById('paper');
  const content = h('div.manuscript.tm-content');
  const paper = h('article.paper', { id: 'tm-paper', style: paperSrc.getAttribute('style') || '' }, h('div.tm-chapter-title', {}, activeChapter()?.title || ''), content);
  paper.className = `${paperSrc.className} tm-paper`;
  paperSrc.hidden = true;
  paperSrc.after(paper);
  document.getElementById('canvas').prepend(bar);
  document.body.classList.add('time-machine');
  ui = { bar, slider, when, diff, content, restoreAll, list };
  slider.addEventListener('input', renderPreview);
  refreshIcons(bar);
  renderPreview();
  if (list.length === 1) toast('No earlier versions yet. The Time Machine remembers the last 10 minutes of changes to each chapter.', 'info', 5000);
  else slider.focus();
  document.addEventListener('keydown', escClose, true);
  emit('time-machine-changed');
}

export function closeTimeMachine() {
  if (!ui) return;
  ui.bar.remove();
  document.getElementById('tm-paper')?.remove();
  document.getElementById('paper').hidden = app.view === 'title';
  document.body.classList.remove('time-machine');
  document.removeEventListener('keydown', escClose, true);
  ui = null;
  emit('time-machine-changed');
  app.editor.commands.focus();
}

function escClose(e) {
  if (e.key === 'Escape' && !document.querySelector('.modal-overlay')) {
    e.preventDefault();
    e.stopPropagation();
    closeTimeMachine();
  }
}

function selected() {
  return ui.list[Math.min(Number(ui.slider.value), ui.list.length - 1)];
}

function renderPreview() {
  if (!ui) return;
  ui.list = snapshots();
  ui.slider.max = ui.list.length - 1;
  const snap = selected();
  const current = app.editor.state.doc;
  const currentKeys = new Set();
  current.forEach((n) => currentKeys.add(blockKey(n)));
  const serializer = DOMSerializer.fromSchema(app.editor.schema);
  let missing = 0;
  const blocks = [];
  snap.doc.forEach((node, _offset, index) => {
    const el = serializer.serializeNode(node);
    const gone = !snap.current && node.textContent.trim() && !currentKeys.has(blockKey(node));
    if (!gone) return blocks.push(el);
    missing++;
    blocks.push(
      h(
        'div.tm-missing',
        {},
        el,
        h('button.btn.small.primary.tm-restore', { onclick: () => restoreBlock(snap.doc, index) }, icon('undo-2'), 'Restore'),
      ),
    );
  });
  ui.content.replaceChildren(...blocks);
  ui.when.textContent = snap.current ? 'Now — this is your chapter as it is' : `${ago(snap.t)} · ${new Date(snap.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`;
  ui.diff.textContent = snap.current ? `${ui.list.length - 1} earlier ${ui.list.length - 1 === 1 ? 'version' : 'versions'} saved` : missing ? `${missing} ${missing === 1 ? 'paragraph was' : 'paragraphs were'} deleted or changed since then` : 'Same paragraphs as now (small edits only)';
  ui.restoreAll.disabled = !!snap.current;
  refreshIcons(ui.content);
}

function restoreBlock(oldDoc, index) {
  const { state, view } = app.editor;
  const node = oldDoc.child(index);
  let pos = 0;
  for (let i = index - 1; i >= 0 && !pos; i--) {
    const key = blockKey(oldDoc.child(i));
    if (!oldDoc.child(i).textContent.trim()) continue;
    state.doc.forEach((n, offset) => {
      if (!pos && blockKey(n) === key) pos = offset + n.nodeSize;
    });
  }
  view.dispatch(state.tr.insert(pos, node).scrollIntoView());
  toast('Paragraph restored. Press Ctrl+Z if you change your mind.', 'success');
  renderPreview();
}

async function restoreVersion() {
  const snap = selected();
  if (snap.current) return;
  const ok = await confirmDialog('Restore this version?', `Your chapter will go back to how it was ${ago(snap.t).toLowerCase()}. You can undo this with Ctrl+Z.`, { okLabel: 'Restore version' });
  if (!ok) return;
  const { state, view } = app.editor;
  view.dispatch(state.tr.replaceWith(0, state.doc.content.size, snap.doc.content));
  closeTimeMachine();
  toast('Version restored.', 'success');
}
