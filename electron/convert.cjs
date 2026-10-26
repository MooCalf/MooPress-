const path = require('path');

const MAX_PDF_PAGES = 2000;

async function docxToHtml(buffer) {
  const mammoth = require('mammoth');
  const result = await mammoth.convertToHtml(
    { buffer: Buffer.from(buffer) },
    {
      styleMap: [
        "p[style-name='Title'] => h1.book-title:fresh",
        "p[style-name='Subtitle'] => p.book-subtitle:fresh",
        "p[style-name='Quote'] => blockquote > p:fresh",
        "p[style-name='Intense Quote'] => blockquote > p:fresh",
        'u => u',
        'strike => s',
        'br[type="page"] => div.page-break-marker',
      ],
    },
  );
  return result.value;
}

async function docToHtml(buffer) {
  const WordExtractor = require('word-extractor');
  const doc = await new WordExtractor().extract(Buffer.from(buffer));
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  return doc
    .getBody()
    .split(/\r?\n|\r/)
    .map((line) => `<p>${esc(line)}</p>`)
    .join('');
}

async function pdfToHtml(buffer) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true }).promise;
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const out = [];
  for (let p = 1; p <= Math.min(doc.numPages, MAX_PDF_PAGES); p++) {
    const page = await doc.getPage(p);
    const [, , , pageH] = page.view;
    const items = (await page.getTextContent()).items.filter((i) => 'str' in i && i.transform[5] < pageH * 0.93 && i.transform[5] > pageH * 0.07);
    const sizes = items.map((i) => Math.abs(i.transform[3])).filter(Boolean).sort((a, b) => a - b);
    const body = sizes[Math.floor(sizes.length / 2)] || 12;
    let para = '';
    let paraSize = 0;
    let lastY = null;
    const flush = () => {
      const text = para.replace(/\s+/g, ' ').trim();
      if (!text) return;
      const big = text.length < 120;
      if (big && paraSize > body * 1.55) out.push(`<h1>${esc(text)}</h1>`);
      else if (big && paraSize > body * 1.2) out.push(`<h2>${esc(text)}</h2>`);
      else out.push(`<p>${esc(text)}</p>`);
      para = '';
      paraSize = 0;
    };
    for (const it of items) {
      const y = it.transform[5];
      const size = Math.abs(it.transform[3]) || body;
      if (lastY !== null && lastY - y > size * 1.6) flush();
      else if (lastY !== null && Math.abs(lastY - y) > 1 && !para.endsWith('-')) para += ' ';
      para = para.endsWith('-') && lastY !== null && Math.abs(lastY - y) > 1 ? para.slice(0, -1) + it.str : para + it.str;
      paraSize = Math.max(paraSize, size);
      if (it.hasEOL) lastY = y;
      lastY = y;
    }
    flush();
    if (p < doc.numPages) out.push('<div class="page-break-marker"></div>');
  }
  return out.join('');
}

function mdToHtml(text) {
  const { marked } = require('marked');
  return marked.parse(String(text), { gfm: true, breaks: false });
}

function htmlToMd(html) {
  const TurndownService = require('turndown');
  const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '*', hr: '* * *' });
  td.addRule('pageBreak', { filter: (n) => n.nodeName === 'DIV' && /page-break/.test(n.getAttribute('class') || ''), replacement: () => '\n\n---\n\n' });
  td.addRule('sceneBreak', { filter: (n) => n.nodeName === 'DIV' && /scene-break/.test(n.getAttribute('class') || ''), replacement: (_c, n) => `\n\n${n.getAttribute('data-symbol') || '* * *'}\n\n` });
  td.addRule('underline', { filter: ['u'], replacement: (c) => `<u>${c}</u>` });
  return td.turndown(String(html));
}

async function htmlToDocx(html, layout) {
  const mod = require('@turbodocx/html-to-docx');
  const HTMLtoDOCX = mod.default || mod;
  const twip = (inches) => Math.round(inches * 1440);
  const result = await HTMLtoDOCX(html, null, {
    orientation: layout.orientation,
    pageSize: { width: twip(layout.pageWidth), height: twip(layout.pageHeight) },
    margins: {
      top: twip(layout.margins.top), right: twip(layout.margins.right), bottom: twip(layout.margins.bottom), left: twip(layout.margins.left),
      header: twip(Math.min(0.5, layout.margins.top / 2)), footer: twip(Math.min(0.5, layout.margins.bottom / 2)),
    },
    title: layout.title || 'Untitled Book',
    creator: layout.author || 'MooPress',
    font: layout.fontFamily,
    fontSize: Math.round(layout.fontSize * 2),
    pageNumber: !!layout.pageNumbers,
    footer: !!layout.pageNumbers,
    lineNumber: false,
    table: { row: { cantSplit: true } },
  });
  return Buffer.from(result instanceof ArrayBuffer ? new Uint8Array(result) : result);
}

async function toHtml(ext, buffer) {
  switch (ext) {
    case 'docx': case 'docm': case 'dotx': case 'dotm': return docxToHtml(buffer);
    case 'doc': case 'dot': return docToHtml(buffer);
    case 'pdf': return pdfToHtml(buffer);
    case 'md': case 'markdown': return mdToHtml(Buffer.from(buffer).toString('utf8'));
    default: return null;
  }
}

module.exports = { toHtml, htmlToDocx, htmlToMd, extOf: (p) => path.extname(p).slice(1).toLowerCase() };
