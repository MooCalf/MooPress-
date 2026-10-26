export const FORMAT_VERSION = 1;
export const PX_PER_INCH = 96;

export const PAGE_SIZES = {
  letter: { label: 'Letter', detail: '8.5" × 11"', w: 8.5, h: 11 },
  a4: { label: 'A4', detail: '8.27" × 11.69"', w: 8.27, h: 11.69 },
  legal: { label: 'Legal', detail: '8.5" × 14"', w: 8.5, h: 14 },
  a5: { label: 'A5', detail: '5.83" × 8.27"', w: 5.83, h: 8.27 },
  trade6x9: { label: 'Trade paperback', detail: '6" × 9"', w: 6, h: 9 },
  digest: { label: 'Digest', detail: '5.5" × 8.5"', w: 5.5, h: 8.5 },
  pocket: { label: 'Pocket book', detail: '5" × 8"', w: 5, h: 8 },
  massMarket: { label: 'Mass-market paperback', detail: '4.25" × 6.87"', w: 4.25, h: 6.87 },
};

export const MARGIN_PRESETS = {
  normal: { label: 'Normal', detail: '1" all sides', m: { top: 1, right: 1, bottom: 1, left: 1 } },
  narrow: { label: 'Narrow', detail: '0.5" all sides', m: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } },
  moderate: { label: 'Moderate', detail: '1" top/bottom, 0.75" sides', m: { top: 1, right: 0.75, bottom: 1, left: 0.75 } },
  wide: { label: 'Wide', detail: '1" top/bottom, 2" sides', m: { top: 1, right: 2, bottom: 1, left: 2 } },
  book: { label: 'Book interior', detail: '0.75" top/bottom, 0.6" sides', m: { top: 0.75, right: 0.6, bottom: 0.75, left: 0.6 } },
};

export const FONT_CHOICES = [
  'Georgia', 'Garamond', 'Book Antiqua', 'Palatino Linotype', 'Cambria', 'Constantia', 'Times New Roman',
  'Baskerville Old Face', 'Century Schoolbook', 'Calibri', 'Segoe UI', 'Arial', 'Verdana', 'Tahoma',
  'Trebuchet MS', 'Courier New', 'Consolas', 'Comic Sans MS',
];

export const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

export function newChapter(title) {
  return { id: uid(), title, content: EMPTY_DOC };
}

export function defaultLayout() {
  return {
    pageSize: 'letter',
    customSize: { w: 8.5, h: 11 },
    orientation: 'portrait',
    margins: { ...MARGIN_PRESETS.normal.m },
    columns: 1,
    fontFamily: 'Georgia',
    fontSize: 12,
    lineHeight: 1.5,
    paragraphStyle: 'book',
    chapterNewPage: true,
    includeTitlePage: true,
    header: { text: '{title}', align: 'center' },
    footer: { text: '', align: 'center' },
    pageNumbers: { show: true, position: 'footer-center', format: 'n' },
  };
}

export function createProject() {
  return {
    version: FORMAT_VERSION,
    title: '',
    subtitle: '',
    author: '',
    dedication: '',
    layout: defaultLayout(),
    chapters: [newChapter('Chapter 1')],
    ignoredWords: [],
    bible: [],
  };
}

export function normalizeProject(data) {
  const base = createProject();
  const p = { ...base, ...data };
  p.layout = { ...base.layout, ...(data.layout || {}) };
  p.layout.margins = { ...base.layout.margins, ...(data.layout?.margins || {}) };
  p.layout.header = { ...base.layout.header, ...(data.layout?.header || {}) };
  p.layout.footer = { ...base.layout.footer, ...(data.layout?.footer || {}) };
  p.layout.pageNumbers = { ...base.layout.pageNumbers, ...(data.layout?.pageNumbers || {}) };
  if (!Array.isArray(p.chapters) || !p.chapters.length) p.chapters = base.chapters;
  p.chapters = p.chapters.map((c, i) => ({ id: c.id || uid(), title: c.title ?? `Chapter ${i + 1}`, content: c.content || EMPTY_DOC }));
  if (!Array.isArray(p.ignoredWords)) p.ignoredWords = [];
  if (!Array.isArray(p.bible)) p.bible = [];
  return p;
}

export function pageDims(layout) {
  const s = layout.pageSize === 'custom' ? layout.customSize : PAGE_SIZES[layout.pageSize] || PAGE_SIZES.letter;
  const portrait = { w: s.w, h: s.h };
  return layout.orientation === 'landscape' ? { w: portrait.h, h: portrait.w } : portrait;
}

export function bookName(project) {
  return project.title.trim() || 'Untitled Book';
}

export function fillTokens(text, project) {
  return String(text || '')
    .replace(/\{title\}/gi, project.title || 'Untitled Book')
    .replace(/\{author\}/gi, project.author || '');
}

export function pageNumberText(format, n, total) {
  switch (format) {
    case 'page-n': return `Page ${n}`;
    case 'n-of': return `Page ${n} of ${total}`;
    case 'dash': return `– ${n} –`;
    default: return String(n);
  }
}

export const PAGE_NUMBER_FORMATS = {
  n: '1, 2, 3',
  'page-n': 'Page 1',
  'n-of': 'Page 1 of 10',
  dash: '– 1 –',
};
