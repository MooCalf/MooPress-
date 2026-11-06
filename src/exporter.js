import { DOMSerializer } from '@tiptap/pm/model';
import { app, escapeHtml } from './app.js';
import { chapterDoc, syncChapters } from './editor.js';
import { pageDims, fillTokens } from './project.js';
import { fontStack } from './layout.js';
import { titleArtworkHTML } from './titleArtwork.js';
import { footnotes, noteLabel } from './pageElements.js';

const cssString = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`;

function pageNumberCss(format) {
  switch (format) {
    case 'page-n': return '"Page " counter(page)';
    case 'n-of': return '"Page " counter(page) " of " counter(pages)';
    case 'dash': return '"– " counter(page) " –"';
    default: return 'counter(page)';
  }
}

function marginBoxes(L, project) {
  const boxes = {};
  const add = (zone, align, piece) => {
    const key = `${zone === 'header' ? 'top' : 'bottom'}-${align}`;
    (boxes[key] ||= []).push(piece);
  };
  const header = fillTokens(L.header.text, project).trim();
  const footer = fillTokens(L.footer.text, project).trim();
  if (header) add('header', L.header.align, cssString(header));
  if (footer) add('footer', L.footer.align, cssString(footer));
  if (L.pageNumbers.show) {
    const [zone, align] = L.pageNumbers.position.split('-');
    add(zone, align, pageNumberCss(L.pageNumbers.format));
  }
  const style = `font-family: ${fontStack(L.fontFamily)}; font-size: 9pt; color: #555;`;
  const css = Object.entries(boxes).map(([k, pieces]) => `@${k} { content: ${pieces.join(' "   ·   " ')}; ${style} }`);
  const blank = Object.keys(boxes).map((k) => `@${k} { content: none; }`);
  return { css: css.join('\n  '), blank: blank.join('\n  ') };
}

export function buildBookHTML() {
  syncChapters();
  const p = app.project;
  const L = p.layout;
  const { w, h } = pageDims(L);
  const m = L.margins;
  const serializer = DOMSerializer.fromSchema(app.editor.schema);
  const toHtml = (doc) => {
    const div = document.createElement('div');
    div.append(serializer.serializeFragment(doc.content));
    const notes = footnotes(doc);
    const references = [...div.querySelectorAll('[data-footnote]')];
    notes.forEach((note, index) => { const ref = references[index]; if (ref) ref.querySelector('a').textContent = noteLabel(note, index); });
    if (notes.length) div.insertAdjacentHTML('beforeend', `<aside class="chapter-notes" aria-label="Footnotes">${notes.map((note, index) => `<p id="note-${escapeHtml(note.id)}"><sup>${escapeHtml(noteLabel(note, index))}</sup> ${escapeHtml(note.text).replace(/\n/g, '<br>')}</p>`).join('')}</aside>`);
    return div.innerHTML;
  };
  const boxes = marginBoxes(L, p);
  const title = p.title.trim() || 'Untitled Book';

  const titlePage = L.includeTitlePage
    ? `<section class="title-page">
        ${titleArtworkHTML(p, 'above')}
        <h1 class="book-title">${escapeHtml(title)}</h1>
        ${p.subtitle ? `<p class="book-subtitle">${escapeHtml(p.subtitle)}</p>` : ''}
        ${p.author ? `<p class="book-author">${escapeHtml(p.author)}</p>` : ''}
        ${titleArtworkHTML(p, 'below')}
      </section>
      ${p.dedication?.trim() ? `<section class="dedication"><p>${escapeHtml(p.dedication).replace(/\n/g, '<br>')}</p></section>` : ''}`
    : '';

  const chapters = p.chapters
    .map(
      (ch, i) => `<section id="chapter-${escapeHtml(ch.id)}" class="chapter${i === 0 && !L.includeTitlePage ? ' first' : ''}">
        ${ch.title ? `<h1 class="chapter-title">${escapeHtml(ch.title)}</h1>` : ''}
        <div class="chapter-body">${toHtml(chapterDoc(ch.id))}</div>
      </section>`,
    )
    .join('\n');

  const contentH = h - m.top - m.bottom;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page {
  size: ${w}in ${h}in;
  margin: ${m.top}in ${m.right}in ${m.bottom}in ${m.left}in;
  ${boxes.css}
}
${L.includeTitlePage ? `@page :first {\n  ${boxes.blank}\n}` : ''}
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: ${fontStack(L.fontFamily)}; font-size: ${L.fontSize}pt; line-height: ${L.lineHeight}; color: #111; }
.title-page { height: ${(contentH - 0.1).toFixed(2)}in; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; break-after: page; }
.book-title { font-size: 30pt; line-height: 1.2; margin: 0 0 0.3in; font-weight: 600; }
.book-subtitle { font-size: 15pt; font-style: italic; margin: 0 0 0.6in; text-indent: 0; }
.book-author { font-size: 14pt; letter-spacing: 0.05em; text-transform: uppercase; margin: 0; text-indent: 0; }
.dedication { height: ${(contentH * 0.6).toFixed(2)}in; display: flex; align-items: center; justify-content: center; text-align: center; font-style: italic; break-after: page; }
.dedication p { text-indent: 0; }
.chapter { ${L.chapterNewPage ? 'break-before: page;' : 'margin-top: 0.6in;'} }
.chapter.first { break-before: auto; margin-top: 0; }
.chapter-title { text-align: center; font-size: 20pt; font-weight: 600; margin: ${L.chapterNewPage ? '1.2in' : '0'} 0 0.4in; break-after: avoid; }
.chapter-body { column-count: ${L.columns}; column-gap: 0.35in; }
p { margin: 0 0 ${L.paragraphStyle === 'block' ? '0.8em' : '0'}; ${L.paragraphStyle === 'book' ? 'text-indent: 0.3in;' : ''} orphans: 2; widows: 2; }
${L.paragraphStyle === 'book' ? '.chapter-body > p:first-child, h1 + p, h2 + p, h3 + p, .scene-break + p, .page-break + p, blockquote p, li p, td p, th p { text-indent: 0; }' : ''}
h1, h2, h3 { line-height: 1.25; break-after: avoid; }
h1 { font-size: 18pt; margin: 1em 0 0.5em; }
h2 { font-size: 15pt; margin: 1em 0 0.4em; }
h3 { font-size: 13pt; margin: 0.9em 0 0.3em; }
blockquote { margin: 0.8em 0.4in; font-style: italic; }
ul, ol { margin: 0.4em 0; padding-left: 0.35in; }
a { color: inherit; }
mark { padding: 0 1px; }
img { max-width: 100%; break-inside: avoid; }
table { border-collapse: collapse; width: 100%; margin: 0.8em 0; break-inside: auto; font-size: 0.92em; }
td, th { border: 1px solid var(--table-border, #999); padding: 4px 8px; vertical-align: top; }
th { background: #f0eeeb; font-weight: 600; }
.scene-break { text-align: center; margin: 1em 0; break-after: avoid; }
.scene-break::before { content: attr(data-symbol); letter-spacing: 0.2em; }
.page-break { break-after: page; height: 0; margin: 0; border: 0; }
.book-element { break-inside: avoid; }
.book-contents { margin: 1em 0 2em; }
.book-contents h2 { font-size: 1.5em; }
.book-contents ol { list-style: none; padding-left: 0; }
.book-contents li { padding: 0.2em 0; }
.book-contents a { text-decoration: none; }
.inline-caption { text-indent: 0; margin: 0.5em 0 1em; }
.chapter-notes { border-top: 1px solid #aaa; margin-top: 2em; padding-top: 0.5em; font-size: 9pt; }
.chapter-notes p { text-indent: 0; margin-bottom: 0.4em; }
.footnote-reference { font-size: 0.75em; }
.title-art { margin-top: 0; margin-bottom: 0.3in; break-inside: avoid; }
.title-art img { display: block; }
.title-art figcaption { font-size: 10pt; margin-top: 0.3em; }
.book-watermark { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 10; }
.book-watermark span { transform: rotate(${Number(L.watermark.angle) || 0}deg); font-size: ${Number(L.watermark.size) || 60}pt; opacity: ${Number(L.watermark.opacity) || 0.12}; color: ${L.watermark.color}; white-space: nowrap; }
@media screen {
  body { background: #e9e6e1; padding: 32px 0; }
  .title-page, .dedication, .chapter { width: ${w}in; max-width: 100%; margin: 0 auto 32px; padding: ${m.top}in ${m.right}in ${m.bottom}in ${m.left}in; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.12); }
  .title-page, .dedication { height: auto; min-height: ${h}in; }
}
</style>
</head>
<body>
${L.watermark.text ? `<div class="book-watermark" aria-hidden="true"><span>${escapeHtml(L.watermark.text)}</span></div>` : ''}
${titlePage}
${chapters}
</body>
</html>`;
}
