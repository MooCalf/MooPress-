import { DOMParser as PMDOMParser, DOMSerializer } from '@tiptap/pm/model';
import { app } from '../app.js';
import { chapterDoc, syncChapters } from '../editor.js';
import { createProject, newChapter, pageDims, EMPTY_DOC } from '../project.js';
import { buildBookHTML } from '../exporter.js';
import { rtfToHtml, bookToRtf } from './rtf.js';
import { odtToHtml, bookToOdt } from './odt.js';

export const FORMAT_NAMES = {
  moopress: 'MooPress Book', docx: 'Word Document', docm: 'Word Macro-Enabled Document', dotx: 'Word Template', dotm: 'Word Template',
  doc: 'Word 97–2003 Document', dot: 'Word 97–2003 Template', odt: 'OpenDocument Text', rtf: 'Rich Text Format', txt: 'Plain Text',
  md: 'Markdown', markdown: 'Markdown', html: 'Web Page', htm: 'Web Page', pdf: 'PDF',
};

export const WRITABLE = ['moopress', 'docx', 'odt', 'rtf', 'txt', 'md', 'html', 'htm', 'pdf'];

export const FORMAT_LIMITS = {
  docx: 'Chapters, formatting, pictures, tables and page size are kept.',
  odt: 'Chapters, formatting, pictures, tables and page size are kept.',
  rtf: 'Chapters, basic formatting and pictures are kept; tables become plain text.',
  txt: 'Only the words are kept — no formatting or pictures.',
  md: 'Chapters, headings, bold/italic, lists and links are kept; layout is not.',
  html: 'Everything shows as a web page, but it can’t store MooPress settings.',
  htm: 'Everything shows as a web page, but it can’t store MooPress settings.',
  pdf: 'A print-ready copy. PDFs can’t be edited again in full detail.',
};

function decodeText(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(bytes) : utf8;
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const CHAPTER_LINE = /^\s*(chapter|part|book|prologue|epilogue|interlude|afterword|foreword|preface|introduction)\b.{0,80}$/i;

function textToHtml(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let blanks = 0;
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) {
      blanks++;
      return;
    }
    const nextBlank = !lines[i + 1]?.trim();
    const titleLike = t.length <= 60 && !/[.!?,;:"”’)]$/.test(t);
    const isHeading = CHAPTER_LINE.test(t) || (titleLike && blanks >= 2 && nextBlank && out.length > 0);
    out.push(isHeading ? `<h1>${esc(t)}</h1>` : `<p>${esc(line)}</p>`);
    blanks = 0;
  });
  return out.join('');
}

async function toHtml(file) {
  if (file.html != null) return file.html;
  const bytes = file.bytes;
  switch (file.ext) {
    case 'odt': return odtToHtml(bytes);
    case 'rtf': return rtfToHtml(decodeText(bytes));
    case 'txt': return textToHtml(decodeText(bytes));
    case 'html': case 'htm': {
      const doc = new DOMParser().parseFromString(decodeText(bytes), 'text/html');
      doc.querySelectorAll('script, style, link, meta, noscript, iframe, object, embed').forEach((n) => n.remove());
      return doc.body.innerHTML;
    }
    default: throw new Error(`MooPress can’t open .${file.ext} files.`);
  }
}

const WRAPPERS = new Set(['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER', 'BODY', 'CENTER', 'FONT', 'SPAN']);
function* blocks(el) {
  for (const child of [...el.childNodes]) {
    if (child.nodeType === 3) {
      if (child.nodeValue.trim()) {
        const p = document.createElement('p');
        p.textContent = child.nodeValue;
        yield p;
      }
      continue;
    }
    if (child.nodeType !== 1) continue;
    const isBreak = /page-break|scene-break/.test(child.className) || child.hasAttribute('data-page-break') || child.hasAttribute('data-scene-break');
    if (WRAPPERS.has(child.tagName) && !isBreak && child.querySelector('p, h1, h2, h3, h4, li, table, img, div')) yield* blocks(child);
    else yield child;
  }
}

function isPageBreak(el) {
  return el.classList?.contains('page-break-marker') || el.classList?.contains('page-break') || el.hasAttribute?.('data-page-break') ||
    /page-break-(after|before):\s*always/i.test(el.getAttribute?.('style') || '');
}

function htmlToProject(html, fileName) {
  const project = createProject();
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const body = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  const schema = app.editor.schema;
  const parser = PMDOMParser.fromSchema(schema);

  const sections = [{ title: null, nodes: [] }];
  for (const el of blocks(body)) {
    if (el.tagName === 'H1' && el.classList.contains('book-title')) {
      project.title = el.textContent.trim();
      continue;
    }
    if (el.classList?.contains('book-subtitle')) {
      project.subtitle = el.textContent.trim();
      continue;
    }
    if (el.tagName === 'H1') {
      sections.push({ title: el.textContent.trim(), nodes: [] });
      continue;
    }
    if (isPageBreak(el)) {
      const marker = document.createElement('div');
      marker.setAttribute('data-page-break', '');
      sections.at(-1).nodes.push(marker);
      continue;
    }
    sections.at(-1).nodes.push(el);
  }

  const [front, ...chapters] = sections;
  const firstLines = chapters[0]?.nodes.map((n) => n.textContent.trim()).filter(Boolean) || [];
  if (!front.nodes.some((n) => n.textContent.trim()) && chapters.length > 1 && firstLines.length <= 3 &&
      firstLines.join(' ').split(/\s+/).length <= 20 && !chapters[0].nodes.some((n) => n.querySelector?.('img, table'))) {
    const titleSection = chapters.shift();
    front.nodes = [Object.assign(document.createElement('p'), { textContent: titleSection.title }), ...titleSection.nodes];
  }
  const frontText = front.nodes.map((n) => n.textContent.trim()).filter(Boolean);
  const frontWords = frontText.join(' ').split(/\s+/).filter(Boolean).length;
  if (chapters.length && frontText.length && frontText.length <= 6 && frontWords <= 60) {
    for (const line of frontText) {
      const by = /^by\s+(.+)$/i.exec(line);
      if (by && !project.author) project.author = by[1].trim();
      else if (!project.title) project.title = line;
      else if (!project.subtitle) project.subtitle = line;
      else if (!project.author) project.author = line;
    }
  } else if (frontText.length || front.nodes.some((n) => n.querySelector?.('img, table'))) {
    chapters.unshift({ title: chapters.length ? 'Opening' : baseName, nodes: front.nodes });
  }
  if (!project.title) project.title = chapters.length > 1 ? baseName : '';

  const toDoc = (nodes) => {
    while (nodes.length && nodes[0].hasAttribute?.('data-page-break')) nodes.shift();
    while (nodes.length && nodes.at(-1).hasAttribute?.('data-page-break')) nodes.pop();
    if (!nodes.length) return EMPTY_DOC;
    const container = document.createElement('div');
    nodes.forEach((n) => container.append(n));
    try {
      return parser.parse(container).toJSON();
    } catch (err) {
      console.warn('Part of this document could not be converted.', err);
      return EMPTY_DOC;
    }
  };

  project.chapters = (chapters.length ? chapters : [{ title: 'Chapter 1', nodes: [] }]).map((s, i) => ({
    ...newChapter(s.title || `Chapter ${i + 1}`),
    content: toDoc(s.nodes),
  }));
  return project;
}

export async function importDocument(file) {
  const html = await toHtml(file);
  const name = file.path.split(/[\\/]/).pop();
  return htmlToProject(html, name);
}

async function rasterizeImages(docs) {
  const srcs = new Map();
  const walk = (n) => {
    if (n.type === 'image' && n.attrs?.src) srcs.set(n.attrs.src, n.attrs.width);
    (n.content || []).forEach(walk);
  };
  docs.forEach(walk);
  const maxW = (pageDims(app.project.layout).w - app.project.layout.margins.left - app.project.layout.margins.right) * 96;
  const out = new Map();
  for (const [src, width] of srcs) {
    try {
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = src;
      });
      const natW = img.naturalWidth || 600;
      const natH = img.naturalHeight || 400;
      const widthPx = Math.min(maxW, width || natW);
      const heightPx = (widthPx / natW) * natH;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(widthPx * 2);
      canvas.height = Math.round(heightPx * 2);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      const bin = atob(base64);
      let hex = '';
      for (let i = 0; i < bin.length; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, '0');
      out.set(src, { dataUrl, base64, hex, widthPx, heightPx });
    } catch {
    }
  }
  return out;
}

function bookData() {
  syncChapters();
  const p = app.project;
  const { w, h } = pageDims(p.layout);
  return {
    title: p.title,
    subtitle: p.subtitle,
    author: p.author,
    layout: { ...p.layout, pageWidth: w, pageHeight: h },
    chapters: p.chapters.map((c) => ({ title: c.title, doc: chapterDoc(c.id).toJSON() })),
  };
}

function portableHtml(book, images) {
  const serializer = DOMSerializer.fromSchema(app.editor.schema);
  const pageBreak = '<div class="page-break" style="page-break-after: always;"></div>';
  const parts = [];
  if (book.layout.includeTitlePage) {
    parts.push(`<p style="text-align:center"><strong><span style="font-size:28pt">${esc(book.title || 'Untitled Book')}</span></strong></p>`);
    if (book.subtitle) parts.push(`<p style="text-align:center"><em>${esc(book.subtitle)}</em></p>`);
    if (book.author) parts.push(`<p style="text-align:center">by ${esc(book.author)}</p>`);
  }
  book.chapters.forEach((ch, i) => {
    if (i > 0 || book.layout.includeTitlePage) if (book.layout.chapterNewPage || i === 0) parts.push(pageBreak);
    const div = document.createElement('div');
    div.append(serializer.serializeFragment(app.editor.schema.nodeFromJSON(ch.doc).content));
    div.querySelectorAll('[data-page-break]').forEach((el) => el.replaceWith(Object.assign(document.createElement('div'), { className: 'page-break', style: 'page-break-after: always;' })));
    div.querySelectorAll('[data-scene-break]').forEach((el) => {
      const p = document.createElement('p');
      p.style.textAlign = 'center';
      p.textContent = el.getAttribute('data-symbol') || '* * *';
      el.replaceWith(p);
    });
    div.querySelectorAll('img').forEach((img) => {
      const r = images.get(img.getAttribute('src'));
      if (!r) return img.remove();
      img.setAttribute('src', r.dataUrl);
      img.setAttribute('width', Math.round(r.widthPx));
      img.setAttribute('height', Math.round(r.heightPx));
      img.removeAttribute('style');
    });
    if (ch.title) parts.push(`<h1>${esc(ch.title)}</h1>`);
    parts.push(div.innerHTML);
  });
  return parts.join('');
}

function bookToText(book) {
  const lines = [];
  if (book.layout.includeTitlePage) {
    lines.push(book.title || 'Untitled Book');
    if (book.subtitle) lines.push(book.subtitle);
    if (book.author) lines.push(`by ${book.author}`);
    lines.push('', '');
  }
  const walk = (n) => {
    if (n.type === 'sceneBreak') return lines.push('', n.attrs.symbol || '* * *', '');
    if (n.isTextblock || ['paragraph', 'heading'].includes(n.type)) {
      const text = (n.content || []).map((c) => (c.type === 'text' ? c.text : c.type === 'hardBreak' ? '\n' : '')).join('');
      return lines.push(text);
    }
    (n.content || []).forEach(walk);
  };
  book.chapters.forEach((ch) => {
    if (ch.title) lines.push(ch.title, '');
    (ch.doc.content || []).forEach(walk);
    lines.push('', '');
  });
  return lines.join('\r\n');
}

export async function exportPayload(ext) {
  if (ext === 'moopress') {
    syncChapters();
    return { json: { ...app.project, savedAt: new Date().toISOString() } };
  }
  if (ext === 'html' || ext === 'htm' || ext === 'pdf') return { html: buildBookHTML() };
  const book = bookData();
  if (ext === 'txt') return { text: bookToText(book) };
  const images = await rasterizeImages(book.chapters.map((c) => c.doc));
  if (ext === 'rtf') return { text: bookToRtf(book, images) };
  if (ext === 'odt') return { bytes: await bookToOdt(book, images) };
  const html = portableHtml(book, images);
  if (ext === 'md') return { html };
  if (ext === 'docx') {
    return {
      html,
      layout: {
        ...book.layout,
        title: book.title,
        author: book.author,
        pageNumbers: book.layout.pageNumbers.show,
      },
    };
  }
  throw new Error(`MooPress can’t save .${ext} files.`);
}
