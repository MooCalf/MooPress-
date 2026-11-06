import { app, h, on, emit, markDirty } from './app.js';
import { syncChapters, chapterDoc } from './editor.js';
import { uid } from './project.js';
import { openDialog, field, toast } from './ui.js';
import { updateLayout } from './layout.js';
import { elementHTML } from './extensions/pageElements.js';

const select = (values, value) => h('select.field', {}, values.map(([key, label]) => h('option', { value: key, selected: String(key) === String(value) }, label)));
const number = (value, min, max) => h('input.field', { type: 'number', value, min, max });
const buttons = (editing) => [...(editing ? [{ label: 'Remove', value: 'remove', danger: true }] : []), { label: 'Cancel', value: null }, { label: editing ? 'Apply' : 'Insert', value: true, primary: true }];

function target(edit) {
  if (edit) return { ...edit, chapterId: app.view, project: app.project, node: edit.editor.state.doc.nodeAt(edit.pos) };
  if (!app.view || app.view === 'title') { toast('Click a chapter to insert this element there.', 'info'); return null; }
  const { editor } = app;
  return { editor, pos: editor.state.selection.from, chapterId: app.view, project: app.project, node: null };
}

function applyElement(context, attrs, type, result) {
  if (!result || app.project !== context.project || app.view !== context.chapterId) return;
  const { editor, pos, node } = context;
  if (node && editor.state.doc.nodeAt(pos) !== node) return toast('This element changed while the dialog was open. Select it and try again.', 'info');
  if (result === 'remove') editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize));
  else if (node) editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, attrs));
  else editor.chain().focus().insertContent({ type, attrs }).run();
  editor.view.focus();
  refreshPageElements();
}

export async function elementDialog(kind = 'caption', edit = null) {
  const context = target(edit);
  if (!context) return;
  const attrs = context.node?.attrs || { kind, label: kind === 'toc' ? 'Contents' : 'Figure 1.', text: '', align: kind === 'toc' ? 'left' : 'center', size: 11, italic: kind !== 'toc', depth: 0, chapters: true };
  const label = h('input.field', { value: attrs.label });
  const text = h('textarea.field', { value: attrs.text, rows: 3 });
  const align = select([['left', 'Left'], ['center', 'Center'], ['right', 'Right']], attrs.align);
  const size = number(attrs.size, 8, 48);
  const italic = h('input', { type: 'checkbox', checked: attrs.italic });
  const depth = select([[0, 'Chapters only'], [1, 'Include Heading 1'], [2, 'Include Headings 1–2'], [3, 'Include Headings 1–3']], attrs.depth);
  const chapters = h('input', { type: 'checkbox', checked: attrs.chapters });
  const body = h('div', {}, field(kind === 'toc' ? 'Contents title' : 'Label (optional)', label),
    kind === 'toc' ? h('div', {}, field('Heading depth', depth), h('label.check', {}, chapters, 'Include chapter titles'), h('p.dialog-text', {}, 'Contents update automatically as chapter titles and headings change. Click an entry to jump to its chapter.')) : field('Caption text', text),
    h('div.form-grid', {}, field('Alignment', align), field('Text size (pt)', size)), h('label.check', {}, italic, 'Italic'));
  syncChapters();
  const preview = h('div.element-preview');
  const read = () => ({ kind, label: label.value, text: text.value, align: align.value, size: Math.max(8, Math.min(48, +size.value || 11)), italic: italic.checked, depth: +depth.value, chapters: chapters.checked });
  const draw = () => { preview.innerHTML = elementHTML(read()); };
  body.append(preview); body.addEventListener('input', draw); draw();
  const result = await openDialog({ title: `${edit ? 'Edit' : 'Insert'} ${kind === 'toc' ? 'table of contents' : 'inline caption'}`, width: 500, body, buttons: buttons(!!edit) });
  applyElement(context, read(), 'pageElement', result);
}

export async function footnoteDialog(edit = null) {
  const context = target(edit);
  if (!context) return;
  const attrs = context.node?.attrs || { id: uid(), text: '', label: '', style: 'decimal' };
  const text = h('textarea.field', { value: attrs.text, rows: 5, placeholder: 'Write the footnote here' });
  const label = h('input.field', { value: attrs.label, placeholder: 'Automatic numbering' });
  const style = select([['decimal', '1, 2, 3'], ['roman', 'i, ii, iii'], ['symbol', '*, †, ‡']], attrs.style);
  const result = await openDialog({ title: `${edit ? 'Edit' : 'Insert'} footnote`, width: 480,
    body: h('div', {}, field('Footnote text', text), h('div.form-grid', {}, field('Numbering style', style), field('Custom reference (optional)', label)), h('p.dialog-text', {}, 'Notes appear below this chapter, in reference order. Double-click a reference or click its note to edit it.')),
    buttons: buttons(!!edit), validate: (value) => value === 'remove' || !!text.value.trim() || (toast('Enter some footnote text first.', 'info'), false),
  });
  applyElement(context, { ...attrs, text: text.value, label: label.value, style: style.value }, 'footnote', result);
}

export function footnotes(doc) {
  const notes = [];
  doc.descendants((node, pos) => { if (node.type.name === 'footnote') notes.push({ ...node.attrs, pos }); });
  return notes;
}

export function noteLabel(note, index) {
  if (note.label) return note.label;
  if (note.style === 'symbol') return ['*', '†', '‡', '§', '¶'][index % 5].repeat(Math.floor(index / 5) + 1);
  if (note.style === 'roman') {
    let n = index + 1; let result = '';
    for (const [value, glyph] of [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]) while (n >= value) { result += glyph; n -= value; }
    return result;
  }
  return String(index + 1);
}

export function refreshPageElements() {
  if (!app.project) return;
  syncChapters();
  for (const paper of document.querySelectorAll('.chapter-paper')) {
    const id = paper.dataset.chapterId;
    const notes = footnotes(chapterDoc(id));
    const box = paper.querySelector('.chapter-notes');
    box.replaceChildren(...notes.map((note, index) => {
      const el = h('button.chapter-note', { onclick: async () => {
        const { openView } = await import('./editor.js'); openView(id, { scroll: false });
        footnoteDialog({ editor: app.editor, pos: note.pos });
      } }, h('sup', {}, noteLabel(note, index)), ' ', note.text);
      for (const ref of paper.querySelectorAll('[data-footnote]')) if (ref.dataset.footnote === note.id) {
        const label = ref.querySelector('a') || ref;
        label.textContent = noteLabel(note, index);
      }
      return el;
    }));
    box.hidden = !notes.length;
    paper.querySelectorAll('.book-contents').forEach((toc) => {
      const wrapper = toc.closest('.book-element');
      if (wrapper?.hasAttribute('data-page-element')) {
        const attrs = { kind: 'toc', label: wrapper.dataset.label, depth: +wrapper.dataset.depth, chapters: wrapper.dataset.chapters !== 'false', align: wrapper.dataset.align, size: +wrapper.dataset.size, italic: wrapper.dataset.italic === 'true' };
        wrapper.innerHTML = elementHTML(attrs);
      }
    });
  }
}

export function editSelectedElement() {
  const sel = app.editor.state.selection;
  if (sel.node?.type.name === 'pageElement') return elementDialog(sel.node.attrs.kind, { editor: app.editor, pos: sel.from });
  if (sel.node?.type.name === 'footnote') return footnoteDialog({ editor: app.editor, pos: sel.from });
  toast('Select a caption, contents block, or footnote reference to edit it. You can also double-click it.', 'info');
}

export async function watermarkDialog() {
  const attrs = app.project.layout.watermark;
  const text = h('input.field', { value: attrs.text, placeholder: 'e.g. DRAFT or CONFIDENTIAL' });
  const color = h('input', { type: 'color', value: attrs.color });
  const opacity = number(Math.round(attrs.opacity * 100), 1, 80);
  const angle = number(attrs.angle, -90, 90);
  const size = number(attrs.size, 12, 160);
  const result = await openDialog({ title: 'Watermark', width: 460,
    body: h('div', {}, field('Text', text), h('div.form-grid', {}, field('Color', color), field('Opacity (%)', opacity), field('Angle (degrees)', angle), field('Size (pt)', size)), h('p.dialog-text', {}, 'Appears behind chapter text and on exported pages. Leave the text blank to remove it.')),
    buttons: [{ label: 'Remove watermark', value: 'remove', danger: true }, { label: 'Cancel', value: null }, { label: 'Apply', value: true, primary: true }],
  });
  if (!result) return;
  updateLayout({ watermark: { text: result === 'remove' ? '' : text.value, color: color.value, opacity: Math.max(1, Math.min(80, +opacity.value || 12)) / 100, angle: Math.max(-90, Math.min(90, +angle.value || 0)), size: Math.max(12, Math.min(160, +size.value || 60)) } });
}

export async function tableOptionsDialog() {
  if (!app.editor.isActive('table')) return toast('Click inside a table to edit its appearance.', 'info');
  const editor = app.editor;
  const attrs = editor.getAttributes('table');
  const border = h('input', { type: 'color', value: attrs.borderColor || '#999999' });
  const background = h('input', { type: 'color', value: '#ffffff' });
  const width = number(attrs.tableWidth || 100, 20, 100);
  const align = select([['left', 'Left'], ['center', 'Center'], ['right', 'Right']], attrs.tableAlign || 'left');
  const result = await openDialog({ title: 'Table appearance', width: 440,
    body: h('div', {}, h('div.form-grid', {}, field('Border color', border), field('Selected cells background', background), field('Width (%)', width), field('Alignment', align)), h('p.dialog-text', {}, 'Use the Table ribbon to add or remove rows and columns, merge or split cells, and toggle headers. Drag a column border to resize it.')),
    buttons: [{ label: 'Cancel', value: null }, { label: 'Apply', value: true, primary: true }],
  });
  if (result && app.editor === editor && editor.isActive('table')) editor.chain().focus().updateAttributes('table', { borderColor: border.value, tableWidth: Math.max(20, Math.min(100, +width.value || 100)), tableAlign: align.value }).setCellAttribute('backgroundColor', background.value).run();
}

export function initPageElements() {
  on('manuscript-rendered', refreshPageElements);
  on('doc-changed', refreshPageElements);
  on('chapters-changed', refreshPageElements);
}
