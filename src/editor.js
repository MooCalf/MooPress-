import { Editor } from '@tiptap/core';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { DOMSerializer } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import Typography from '@tiptap/extension-typography';
import { Placeholder, CharacterCount } from '@tiptap/extensions';
import { app, emit, markDirty, h, on } from './app.js';
import { EMPTY_DOC } from './project.js';
import { PageBreak, SceneBreak } from './extensions/breaks.js';
import { ParagraphFormat } from './extensions/paragraphFormat.js';
import { BookImage, ImageDropPaste } from './extensions/bookImage.js';
import { EditorDecorations } from './extensions/decorations.js';
import { PageElement, Footnote } from './extensions/pageElements.js';
import { TableStyle, BookTableView } from './extensions/tableStyle.js';

const chapterStates = new Map();
let editorMount;

export function buildExtensions({ smartQuotes = true } = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      code: false,
      codeBlock: false,
      horizontalRule: false,
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Subscript,
    Superscript,
    Table.configure({ resizable: true, cellMinWidth: 40, View: BookTableView }),
    TableRow,
    TableHeader,
    TableCell,
    TableStyle,
    smartQuotes && Typography,
    Placeholder.configure({ placeholder: 'Start writing… (everything you type is kept in this chapter)' }),
    CharacterCount,
    PageBreak,
    SceneBreak,
    ParagraphFormat,
    BookImage.configure({ allowBase64: true }),
    ImageDropPaste,
    EditorDecorations,
    PageElement,
    Footnote,
  ].filter(Boolean);
}

export function createEditor(element) {
  editorMount = element;
  app.editor = new Editor({
    element,
    extensions: buildExtensions({ smartQuotes: app.settings.smartQuotes }),
    content: EMPTY_DOC,
    editorProps: {
      attributes: { class: 'manuscript', spellcheck: String(app.settings.spellcheck) },
    },
    onUpdate: () => {
      markDirty();
      emit('doc-changed');
    },
    onSelectionUpdate: () => emit('selection-changed'),
    onTransaction: () => emit('transaction'),
  });
  return app.editor;
}

function stateFromJson(json) {
  const { editor } = app;
  let doc;
  try {
    doc = editor.schema.nodeFromJSON(json || EMPTY_DOC);
    doc.check();
  } catch (err) {
    console.warn('Chapter content could not be read; starting it empty.', err);
    doc = editor.schema.nodeFromJSON(EMPTY_DOC);
  }
  return EditorState.create({ doc, plugins: editor.state.plugins });
}

export function activeChapter() {
  return app.project.chapters.find((c) => c.id === app.view) || null;
}

export function chapterState(id) {
  if (id === app.view) return app.editor.state;
  if (!chapterStates.has(id)) {
    const ch = app.project.chapters.find((c) => c.id === id);
    chapterStates.set(id, stateFromJson(ch?.content));
  }
  return chapterStates.get(id);
}

export function setChapterState(id, state) {
  if (id === app.view) app.editor.view.updateState(state);
  else chapterStates.set(id, state);
  const ch = app.project.chapters.find((c) => c.id === id);
  if (ch) ch.content = state.doc.toJSON();
}

export function chapterDoc(id) {
  return chapterState(id).doc;
}

export function syncChapters() {
  for (const ch of app.project.chapters) {
    if (ch.id === app.view) ch.content = app.editor.getJSON();
    else if (chapterStates.has(ch.id)) ch.content = chapterStates.get(ch.id).doc.toJSON();
  }
}

export function openView(id, { scroll = true } = {}) {
  const { editor } = app;
  const canvas = document.getElementById('canvas');
  const previousScroll = canvas.scrollTop;
  const anchor = id === 'title' ? document.getElementById('title-page') : [...document.querySelectorAll('.chapter-paper')].find((paper) => paper.dataset.chapterId === id);
  const previousTop = anchor?.getBoundingClientRect().top;
  if (id !== 'title' && !app.project.chapters.some((ch) => ch.id === id)) return;
  if (app.view === id) {
    if (scroll) scrollToView(id);
    return;
  }
  if (app.view && app.view !== 'title') {
    chapterStates.set(app.view, editor.state);
    const prev = activeChapter();
    if (prev) prev.content = editor.getJSON();
  }
  app.view = id;
  if (id !== 'title') {
    const state = chapterStates.get(id) || stateFromJson(app.project.chapters.find((c) => c.id === id)?.content);
    chapterStates.delete(id);
    editor.view.updateState(state);
  }
  renderManuscript();
  emit('view-changed');
  emit('selection-changed');
  if (scroll) scrollToView(id);
  else if (previousTop != null && anchor?.isConnected) canvas.scrollTop = previousScroll + anchor.getBoundingClientRect().top - previousTop;
}

function scrollToView(id) {
  const target = id === 'title' ? document.getElementById('title-page') : document.getElementById('paper');
  const canvas = document.getElementById('canvas');
  if (!target || !canvas) return;
  const top = target.getBoundingClientRect().top - canvas.getBoundingClientRect().top + canvas.scrollTop - 32;
  canvas.scrollTop = Math.max(0, top);
}

export function renderManuscript() {
  if (!app.project || !editorMount) return;
  const root = document.getElementById('zoom-layer');
  const titlePage = document.getElementById('title-page');
  if (root.firstElementChild !== titlePage) root.prepend(titlePage);
  titlePage.hidden = false;
  const ids = new Set(app.project.chapters.map((ch) => ch.id));
  for (const paper of root.querySelectorAll('.chapter-paper')) {
    if (!ids.has(paper.dataset.chapterId)) {
      if (paper.contains(editorMount)) root.append(editorMount);
      paper.remove();
    }
  }
  const original = root.querySelector('#paper:not(.chapter-paper)');
  if (original) { root.append(editorMount); original.remove(); }
  let previousPaper = titlePage;
  for (const ch of app.project.chapters) {
    let paper = [...root.querySelectorAll('.chapter-paper')].find((el) => el.dataset.chapterId === ch.id);
    if (!paper) {
      const input = h('input.chapter-title', { placeholder: 'Chapter title', value: ch.title, 'aria-label': 'Chapter title', spellcheck: 'true' });
      input.addEventListener('input', () => {
        ch.title = input.value; markDirty(); emit('chapters-changed');
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); app.editor.commands.focus('start'); }
      });
      paper = h('article.paper.chapter-paper', { dataset: { chapterId: ch.id } },
        h('div.hf-preview.hf-header'), h('div.chapter-head', {}, input), h('div.chapter-preview.manuscript'),
        h('div.chapter-notes'), h('div.page-overlay', { 'aria-hidden': 'true' }), h('div.hf-preview.hf-footer'));
      paper.addEventListener('mousedown', (e) => {
        if (app.view === ch.id) return;
        const text = e.target.closest('.chapter-preview');
        openView(ch.id, { scroll: false });
        if (text) {
          e.preventDefault();
          const hit = app.editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
          if (hit) app.editor.view.dispatch(app.editor.state.tr.setSelection(TextSelection.near(app.editor.state.doc.resolve(hit.pos))));
          app.editor.view.focus();
        }
      });
      paper.addEventListener('focusin', () => { if (app.view !== ch.id) openView(ch.id, { scroll: false }); });
    }
    paper.removeAttribute('id');
    for (const el of paper.querySelectorAll('[id]')) if (el !== editorMount) el.removeAttribute('id');
    const active = app.view === ch.id;
    paper.classList.toggle('active-chapter', active);
    const input = paper.querySelector('.chapter-title');
    if (document.activeElement !== input) input.value = ch.title;
    const preview = paper.querySelector('.chapter-preview');
    preview.hidden = active;
    if (active) {
      paper.id = 'paper';
      paper.querySelector('.chapter-head').id = 'chapter-head';
      input.id = 'chapter-title';
      paper.querySelector('.hf-header').id = 'header-preview';
      paper.querySelector('.hf-footer').id = 'footer-preview';
      paper.querySelector('.page-overlay').id = 'page-overlay';
      if (preview.nextElementSibling !== editorMount) preview.after(editorMount);
      editorMount.hidden = false;
    } else {
      preview.replaceChildren(DOMSerializer.fromSchema(app.editor.schema).serializeFragment(chapterDoc(ch.id).content));
    }
    if (previousPaper.nextElementSibling !== paper) previousPaper.after(paper);
    previousPaper = paper;
  }
  if (app.view === 'title') { editorMount.hidden = true; root.append(editorMount); }
  emit('manuscript-rendered');
}

on('chapters-changed', renderManuscript);
on('doc-changed', () => {
  for (const paper of document.querySelectorAll('.chapter-paper')) {
    if (paper.dataset.chapterId === app.view) continue;
    paper.querySelector('.chapter-preview').replaceChildren(DOMSerializer.fromSchema(app.editor.schema).serializeFragment(chapterDoc(paper.dataset.chapterId).content));
  }
});

export function forgetChapter(id) {
  chapterStates.delete(id);
}

export function resetChapterStates() {
  chapterStates.clear();
  app.view = null;
  if (editorMount) {
    document.getElementById('zoom-layer').append(editorMount);
    document.querySelectorAll('.chapter-paper').forEach((paper) => paper.remove());
  }
  if (app.editor) app.editor.view.updateState(stateFromJson(EMPTY_DOC));
}

export function focusEditor() {
  if (app.view && app.view !== 'title') app.editor.commands.focus();
}

export function withEditor(fn) {
  if (!app.editor || !app.view || app.view === 'title') return false;
  return fn(app.editor.chain().focus(), app.editor);
}
