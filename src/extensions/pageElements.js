import { Node, mergeAttributes } from '@tiptap/core';
import { app, h, escapeHtml } from '../app.js';

export function contentsEntries(project, depth = 1, includeChapters = true) {
  const entries = [];
  for (const chapter of project.chapters) {
    if (includeChapters) entries.push({ title: chapter.title || 'Untitled chapter', level: 1, chapterId: chapter.id });
    const walk = (node) => {
      if (node.type === 'heading' && node.attrs?.level <= depth) {
        const text = (node.content || []).map((child) => child.text || '').join('');
        if (text) entries.push({ title: text, level: node.attrs.level + (includeChapters ? 1 : 0), chapterId: chapter.id });
      }
      for (const child of node.content || []) walk(child);
    };
    if (depth) walk(chapter.content);
  }
  return entries;
}

export function elementHTML(attrs, project = app.project) {
  const align = ['left', 'center', 'right'].includes(attrs.align) ? attrs.align : 'left';
  const size = Math.max(8, Math.min(48, +attrs.size || 11));
  const style = `text-align:${align};font-size:${size}pt;font-style:${attrs.italic ? 'italic' : 'normal'}`;
  if (attrs.kind === 'toc') {
    const entries = contentsEntries(project, +attrs.depth || 0, attrs.chapters !== false);
    return `<nav class="book-contents" style="${style}" aria-label="Table of contents"><h2>${escapeHtml(attrs.label || 'Contents')}</h2><ol>${entries.map((entry) => `<li style="margin-left:${(entry.level - 1) * 16}px"><a href="#chapter-${escapeHtml(entry.chapterId)}">${escapeHtml(entry.title)}</a></li>`).join('')}</ol></nav>`;
  }
  return `<p class="inline-caption" style="${style}">${attrs.label ? `<strong>${escapeHtml(attrs.label)} </strong>` : ''}${escapeHtml(attrs.text)}</p>`;
}

const attrs = {
  kind: { default: 'caption' }, label: { default: '' }, text: { default: '' },
  align: { default: 'center' }, size: { default: 11 }, italic: { default: true },
  depth: { default: 0 }, chapters: { default: true },
};

export const PageElement = Node.create({
  name: 'pageElement', group: 'block', atom: true, draggable: true,
  addAttributes() { return Object.fromEntries(Object.entries(attrs).map(([key, spec]) => [key, { ...spec, rendered: false, parseHTML: (el) => {
    const value = el.getAttribute(`data-${key}`);
    if (value == null) return spec.default;
    return typeof spec.default === 'boolean' ? value === 'true' : typeof spec.default === 'number' ? +value : value;
  } }])); },
  parseHTML() { return [{ tag: 'div[data-page-element]' }]; },
  renderHTML({ node }) {
    const data = Object.fromEntries(Object.keys(attrs).map((key) => [`data-${key}`, String(node.attrs[key])]));
    const dom = h('div.book-element', { 'data-page-element': node.attrs.kind, ...data, html: elementHTML(node.attrs) });
    return { dom };
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current = node;
      const dom = h('div.book-element', { tabindex: 0, role: 'button', 'aria-label': 'Edit page element', contenteditable: 'false' });
      const render = () => { dom.innerHTML = elementHTML(current.attrs); dom.dataset.pageElement = current.attrs.kind; for (const key of Object.keys(attrs)) dom.dataset[key] = String(current.attrs[key]); dom.title = 'Double-click to edit, or use Insert → Edit element'; };
      const edit = (e) => { e.preventDefault(); import('../pageElements.js').then(({ elementDialog }) => elementDialog(current.attrs.kind, { editor, pos: getPos() })); };
      dom.addEventListener('dblclick', edit);
      dom.addEventListener('keydown', (e) => { if (e.key === 'Enter') edit(e); });
      dom.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) { e.preventDefault(); import('../editor.js').then(({ openView }) => openView(link.hash.replace('#chapter-', ''))); }
      });
      render();
      return { dom, update(next) { if (next.type !== current.type) return false; current = next; render(); return true; }, selectNode: () => dom.classList.add('ProseMirror-selectednode'), deselectNode: () => dom.classList.remove('ProseMirror-selectednode'), ignoreMutation: () => true };
    };
  },
});

export const Footnote = Node.create({
  name: 'footnote', group: 'inline', inline: true, atom: true,
  addAttributes() { return { id: { default: '', rendered: false }, text: { default: '', rendered: false }, label: { default: '', rendered: false }, style: { default: 'decimal', rendered: false } }; },
  parseHTML() { return [{ tag: 'sup[data-footnote]', getAttrs: (el) => ({ id: el.dataset.footnote, text: el.dataset.text || '', label: el.dataset.label || '', style: el.dataset.style || 'decimal' }) }]; },
  renderHTML({ node, HTMLAttributes }) { return ['sup', mergeAttributes(HTMLAttributes, { class: 'footnote-reference', 'data-footnote': node.attrs.id, 'data-text': node.attrs.text, 'data-label': node.attrs.label, 'data-style': node.attrs.style, title: node.attrs.text }), ['a', { href: `#note-${node.attrs.id}` }, node.attrs.label || '*']]; },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current = node;
      const dom = h('sup.footnote-reference', { tabindex: 0, role: 'button', 'aria-label': 'Edit footnote', contenteditable: 'false' });
      const render = () => { dom.textContent = current.attrs.label || '*'; dom.title = current.attrs.text; dom.dataset.footnote = current.attrs.id; dom.dataset.style = current.attrs.style; };
      const edit = (e) => { e.preventDefault(); import('../pageElements.js').then(({ footnoteDialog }) => footnoteDialog({ editor, pos: getPos() })); };
      dom.addEventListener('dblclick', edit);
      dom.addEventListener('keydown', (e) => { if (e.key === 'Enter') edit(e); });
      render();
      return { dom, update(next) { if (next.type !== current.type) return false; current = next; render(); return true; }, ignoreMutation: () => true };
    };
  },
});
