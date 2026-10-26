import { app, emit, h, on, markClean, markDirty } from './app.js';
import { createProject, normalizeProject, bookName } from './project.js';
import { openView, resetChapterStates, syncChapters } from './editor.js';
import { buildBookHTML } from './exporter.js';
import { saveSettings } from './settings.js';
import { openDialog, toast } from './ui.js';
import { importDocument, exportPayload, FORMAT_NAMES, FORMAT_LIMITS } from './formats/index.js';
import { saveFolder } from './folders.js';

let lastSaveAt = Date.now();
let recoveryStale = false;

export function loadProject(data, filePath) {
  app.project = normalizeProject(data);
  app.filePath = filePath || null;
  resetChapterStates();
  openView(app.project.chapters[0].id);
  markClean();
  lastSaveAt = Date.now();
  emit('project-loaded');
}

async function confirmDiscard() {
  if (!app.dirty) return true;
  const r = await openDialog({
    title: 'Save your changes?',
    body: h('p.dialog-text', {}, `“${bookName(app.project)}” has changes that haven’t been saved yet.`),
    buttons: [
      { label: 'Cancel', value: null },
      { label: "Don't save", value: 'discard' },
      { label: 'Save', value: 'save', primary: true },
    ],
  });
  if (r === 'save') return saveBook();
  return r === 'discard';
}

export async function newBook() {
  if (!(await confirmDiscard())) return;
  loadProject(createProject(), null);
  window.moopress.clearRecovery();
  toast('Started a new book. Give it a title on the Title Page.', 'success');
}

const extOf = (p) => (p || '').split('.').pop().toLowerCase();

const SAVE_IN_PLACE = ['moopress', 'docx', 'odt', 'rtf', 'txt', 'md', 'html', 'htm'];
const keepFormatConfirmed = new Set();

export function fileFormat() {
  return app.filePath ? extOf(app.filePath) : 'moopress';
}

export async function openBook(path) {
  if (!(await confirmDiscard())) return;
  let converting = null;
  try {
    converting = setTimeout(() => toast('Converting your document…', 'info', 2500), 400);
    const r = await window.moopress.openFile(path, path ? undefined : await saveFolder());
    clearTimeout(converting);
    if (!r) return;
    if (r.ext === 'moopress') {
      if (!r.data || !Array.isArray(r.data.chapters)) throw new Error('Not a MooPress book');
      loadProject(r.data, r.path);
      toast(`Opened “${bookName(app.project)}”.`, 'success');
    } else {
      loadProject(await importDocument(r), r.path);
      const chapters = app.project.chapters.length;
      toast(`Opened ${FORMAT_NAMES[r.ext] || r.ext.toUpperCase()} “${r.path.split(/[\\/]/).pop()}” — ${chapters} ${chapters === 1 ? 'chapter' : 'chapters'}.`, 'success', 4500);
    }
    addRecent(r.path);
  } catch (err) {
    clearTimeout(converting);
    console.error(err);
    if (path) removeRecent(path);
    toast(`That file couldn’t be opened. ${err.message?.startsWith('MooPress') ? err.message : 'It may have been moved, be damaged, or be password-protected.'}`, 'error', 6000);
  }
}

async function confirmKeepFormat(path) {
  const ext = extOf(path);
  if (ext === 'moopress' || keepFormatConfirmed.has(path)) return 'keep';
  const name = FORMAT_NAMES[ext] || ext.toUpperCase();
  const r = await openDialog({
    title: `Keep using ${name} format?`,
    width: 500,
    body: h(
      'div',
      {},
      h('p.dialog-text', {}, `“${path.split(/[\\/]/).pop()}” is a ${name}. ${FORMAT_LIMITS[ext] || ''}`),
      h('p.dialog-text.muted', {}, 'MooPress extras like Story Settings and your ignored spellings are only kept in a MooPress book (.moopress).'),
    ),
    buttons: [
      { label: 'Cancel', value: null },
      { label: 'Save as MooPress book', value: 'moopress' },
      { label: `Keep ${ext.toUpperCase()}`, value: 'keep', primary: true },
    ],
  });
  if (r === 'keep') keepFormatConfirmed.add(path);
  return r;
}

export async function saveBook({ saveAs = false, quiet = false } = {}) {
  try {
    let path = app.filePath;
    const current = fileFormat();
    if (!path || saveAs || !SAVE_IN_PLACE.includes(current)) {
      if (quiet) return false;
      const suggested = SAVE_IN_PLACE.includes(current) ? current : ['doc', 'dot', 'docm', 'dotx', 'dotm'].includes(current) ? 'docx' : 'moopress';
      path = await window.moopress.chooseSavePath({ suggestedName: bookName(app.project), ext: suggested, folder: await saveFolder() });
      if (!path) return false;
      keepFormatConfirmed.add(path);
    } else if (current !== 'moopress') {
      if (quiet && !keepFormatConfirmed.has(path)) return false;
      const choice = await confirmKeepFormat(path);
      if (!choice) return false;
      if (choice === 'moopress') return saveBook({ saveAs: true });
    }

    const ext = extOf(path);
    const payload = await exportPayload(ext);
    await window.moopress.writeFile({ path, ...payload });

    if (ext === 'pdf') {
      if (!quiet) toast('Saved a PDF copy of your book.', 'success', 3000);
      return true;
    }
    app.filePath = path;
    lastSaveAt = Date.now();
    markClean();
    recoveryStale = false;
    window.moopress.clearRecovery();
    addRecent(path);
    emit('saved', { quiet });
    if (!quiet) toast(ext === 'moopress' ? 'Your book is saved.' : `Saved as ${FORMAT_NAMES[ext] || ext.toUpperCase()}.`, 'success', 2000);
    return true;
  } catch (err) {
    console.error(err);
    toast(`Couldn’t save: ${err.message}`, 'error', 6000);
    return false;
  }
}

function addRecent(path) {
  const list = (app.settings.recentFiles || []).filter((r) => r.path !== path);
  list.unshift({ path, title: bookName(app.project), openedAt: Date.now() });
  app.settings.recentFiles = list.slice(0, 8);
  saveSettings();
  emit('recent-changed');
}

function removeRecent(path) {
  app.settings.recentFiles = (app.settings.recentFiles || []).filter((r) => r.path !== path);
  saveSettings();
  emit('recent-changed');
}

export async function exportPdf() {
  toast('Preparing your PDF…', 'info', 2000);
  const out = await window.moopress.exportPdf({ html: buildBookHTML(), suggestedName: bookName(app.project) });
  if (out) toast('PDF exported. It has opened in your PDF viewer.', 'success', 4000);
}

export async function exportHtml() {
  const out = await window.moopress.exportHtml({ html: buildBookHTML(), suggestedName: bookName(app.project) });
  if (out) toast('Web page exported.', 'success');
}

export async function printBook() {
  const r = await window.moopress.print({ html: buildBookHTML() });
  if (r && !r.ok && r.reason && r.reason !== 'cancelled') toast(`Printing failed: ${r.reason}`, 'error');
}

export function startBackgroundSaving() {
  on('dirty-changed', () => { if (app.dirty) recoveryStale = true; });
  on('doc-changed', () => { recoveryStale = true; });

  setInterval(() => {
    if (!app.dirty || !recoveryStale) return;
    recoveryStale = false;
    syncChapters();
    window.moopress.writeRecovery({ project: app.project, filePath: app.filePath, at: Date.now() }).catch(console.error);
  }, 15000);

  setInterval(() => {
    const s = app.settings;
    if (s.autosave && app.filePath && app.dirty && Date.now() - lastSaveAt >= s.autosaveMinutes * 60000) {
      saveBook({ quiet: true });
    }
  }, 20000);

  window.moopress.onSaveAndClose(async () => {
    if (await saveBook()) window.moopress.closeNow();
  });
}

export async function offerRecovery() {
  const r = await window.moopress.readRecovery();
  if (!r?.project) return false;
  const when = new Date(r.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const choice = await openDialog({
    title: 'Recover your work?',
    body: h(
      'div',
      {},
      h('p.dialog-text', {}, `MooPress closed before “${bookName(r.project)}” was saved. A recovery copy from ${when} is available.`),
      h('p.dialog-text.muted', {}, 'If you don’t recover it now, the copy will be deleted.'),
    ),
    buttons: [
      { label: 'Delete it', value: 'discard', danger: true },
      { label: 'Recover my work', value: 'restore', primary: true },
    ],
  });
  if (choice === 'restore') {
    loadProject(r.project, r.filePath);
    markDirty();
    toast('Your work was recovered. Remember to save it.', 'success', 5000);
    return true;
  }
  if (choice === 'discard') window.moopress.clearRecovery();
  return false;
}
