import { Editor } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import Typography from '@tiptap/extension-typography';
import { Placeholder, CharacterCount } from '@tiptap/extensions';
import { app, emit, markDirty } from './app.js';
import { EMPTY_DOC } from './project.js';
import { PageBreak, SceneBreak } from './extensions/breaks.js';
import { ParagraphFormat } from './extensions/paragraphFormat.js';
import { BookImage, ImageDropPaste } from './extensions/bookImage.js';
import { EditorDecorations } from './extensions/decorations.js';

const chapterStates = new Map();

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
    Table.configure({ resizable: true, cellMinWidth: 40 }),
    TableRow,
    TableHeader,
    TableCell,
    smartQuotes && Typography,
    Placeholder.configure({ placeholder: 'Start writing… (everything you type is kept in this chapter)' }),
    CharacterCount,
    PageBreak,
    SceneBreak,
    ParagraphFormat,
    BookImage.configure({ allowBase64: true }),
    ImageDropPaste,
    EditorDecorations,
  ].filter(Boolean);
}

export function createEditor(element) {
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

export function openView(id) {
  const { editor } = app;
  if (app.view === id) return;
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
  emit('view-changed');
  emit('selection-changed');
}

export function forgetChapter(id) {
  chapterStates.delete(id);
}

export function resetChapterStates() {
  chapterStates.clear();
  app.view = null;
}

export function focusEditor() {
  if (app.view && app.view !== 'title') app.editor.commands.focus();
}

export function withEditor(fn) {
  if (!app.editor || !app.view || app.view === 'title') return false;
  return fn(app.editor.chain().focus(), app.editor);
}
