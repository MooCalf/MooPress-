import { app, h, emit, markDirty, debounce } from './app.js';
import {
  PX_PER_INCH, PAGE_SIZES, MARGIN_PRESETS, FONT_CHOICES, PAGE_NUMBER_FORMATS,
  pageDims, fillTokens, pageNumberText,
} from './project.js';
import { openDialog, field, popover } from './ui.js';

const $ = (id) => document.getElementById(id);

export function layout() {
  return app.project.layout;
}

export function updateLayout(patch) {
  Object.assign(app.project.layout, patch);
  markDirty();
  applyLayout();
  emit('layout-changed');
}

export function applyLayout() {
  const L = layout();
  const { w, h: ph } = pageDims(L);
  const m = L.margins;
  for (const paper of [$('paper'), $('title-page')]) {
    paper.style.width = `${w * PX_PER_INCH}px`;
    paper.style.minHeight = `${ph * PX_PER_INCH}px`;
    paper.style.padding = `${m.top * PX_PER_INCH}px ${m.right * PX_PER_INCH}px ${m.bottom * PX_PER_INCH}px ${m.left * PX_PER_INCH}px`;
  }
  const doc = $('paper');
  doc.style.setProperty('--body-font', fontStack(L.fontFamily));
  doc.style.setProperty('--body-size', `${L.fontSize}pt`);
  doc.style.setProperty('--body-leading', L.lineHeight);
  doc.style.setProperty('--columns', L.columns);
  doc.classList.toggle('para-book', L.paragraphStyle === 'book');
  doc.classList.toggle('para-block', L.paragraphStyle === 'block');
  $('title-page').style.setProperty('--body-font', fontStack(L.fontFamily));
  renderHeaderFooter();
  schedulePageGuides();
}

export function fontStack(name) {
  const serif = ['Georgia', 'Garamond', 'Book Antiqua', 'Palatino Linotype', 'Cambria', 'Constantia', 'Times New Roman', 'Baskerville Old Face', 'Century Schoolbook'];
  const fallback = serif.includes(name) ? 'Georgia, serif' : name.includes('Courier') || name === 'Consolas' ? 'monospace' : 'Segoe UI, sans-serif';
  return `"${name}", ${fallback}`;
}

function renderHeaderFooter(totalPages = 1) {
  const L = layout();
  const m = L.margins;
  const header = $('header-preview');
  const footer = $('footer-preview');
  const parts = hfParts(L, totalPages);
  header.replaceChildren(...['left', 'center', 'right'].map((a) => h(`span.hf-${a}`, {}, parts.header[a])));
  footer.replaceChildren(...['left', 'center', 'right'].map((a) => h(`span.hf-${a}`, {}, parts.footer[a])));
  header.style.cssText = `top:0; height:${m.top * PX_PER_INCH}px; left:${m.left * PX_PER_INCH}px; right:${m.right * PX_PER_INCH}px`;
  footer.style.cssText = `bottom:0; height:${m.bottom * PX_PER_INCH}px; left:${m.left * PX_PER_INCH}px; right:${m.right * PX_PER_INCH}px`;
}

export function hfParts(L, totalPages, page = 1) {
  const slots = { header: { left: '', center: '', right: '' }, footer: { left: '', center: '', right: '' } };
  const add = (zone, align, text) => {
    if (!text) return;
    slots[zone][align] = slots[zone][align] ? `${slots[zone][align]}  ·  ${text}` : text;
  };
  add('header', L.header.align, fillTokens(L.header.text, app.project));
  add('footer', L.footer.align, fillTokens(L.footer.text, app.project));
  if (L.pageNumbers.show) {
    const [zone, align] = L.pageNumbers.position.split('-');
    add(zone, align, pageNumberText(L.pageNumbers.format, page, totalPages));
  }
  return slots;
}

export let pageCount = 1;
export let currentPage = 1;

export const schedulePageGuides = debounce(drawPageGuides, 120);

function drawPageGuides() {
  const paper = $('paper');
  const overlay = $('page-overlay');
  if (!app.project || paper.hidden) return;
  const L = layout();
  const { h: pageH } = pageDims(L);
  const padTop = L.margins.top * PX_PER_INCH;
  const padBottom = L.margins.bottom * PX_PER_INCH;
  const contentH = (pageH - L.margins.top - L.margins.bottom) * PX_PER_INCH;
  const pm = paper.querySelector('.ProseMirror');
  if (!pm || contentH <= 40) return;

  const contentEnd = pm.offsetTop + pm.offsetHeight;
  const breaks = [...pm.querySelectorAll(':scope > .page-break')].map((el) => el.offsetTop + el.offsetHeight);
  const marks = [];
  let segStart = padTop;
  for (const b of [...breaks, Infinity]) {
    const end = Math.min(b, contentEnd);
    while (segStart + contentH < end) {
      segStart += contentH;
      marks.push({ y: segStart, forced: false });
    }
    if (b === Infinity || b > contentEnd) break;
    segStart = b;
    marks.push({ y: b, forced: true });
  }
  pageCount = marks.length + 1;
  paper.style.minHeight = `${Math.max(pageH * PX_PER_INCH, segStart + contentH + padBottom)}px`;

  overlay.replaceChildren();
  if (app.settings.showPageGuides) {
    marks.forEach((mk, i) => {
      overlay.append(
        h(
          `div.page-guide${mk.forced ? '.forced' : ''}`,
          { style: { top: `${mk.y}px` } },
          h('span.page-guide-label', {}, `Page ${i + 2}`),
        ),
      );
    });
  }
  renderHeaderFooter(pageCount);
  updateCurrentPage();
  emit('pages-changed');
}

export function updateCurrentPage() {
  const { editor } = app;
  if (!editor || !app.view || app.view === 'title') return;
  const paper = $('paper');
  const L = layout();
  const contentH = (pageDims(L).h - L.margins.top - L.margins.bottom) * PX_PER_INCH;
  try {
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    const rect = paper.getBoundingClientRect();
    const scale = rect.height / paper.offsetHeight || 1;
    const y = (coords.top - rect.top) / scale - L.margins.top * PX_PER_INCH;
    const guides = [...$('page-overlay').children].map((g) => parseFloat(g.style.top));
    let page = 1;
    if (guides.length) for (const g of guides) { if (y + L.margins.top * PX_PER_INCH >= g) page++; }
    else page = Math.max(1, Math.floor(y / contentH) + 1);
    currentPage = Math.min(page, pageCount);
  } catch {
    currentPage = 1;
  }
}

const sameMargins = (a, b) => ['top', 'right', 'bottom', 'left'].every((k) => Math.abs(a[k] - b[k]) < 0.001);

export function marginsMenu(anchor) {
  const L = layout();
  popover(anchor, [
    ...Object.values(MARGIN_PRESETS).map((p) => ({ label: p.label, detail: p.detail, checked: sameMargins(L.margins, p.m), onClick: () => updateLayout({ margins: { ...p.m } }) })),
    'separator',
    { label: 'Custom margins…', icon: 'square-dashed', onClick: customMarginsDialog },
  ]);
}

export function sizeMenu(anchor) {
  const L = layout();
  popover(anchor, [
    { heading: 'Standard' },
    ...['letter', 'a4', 'legal', 'a5'].map(sizeItem),
    { heading: 'Book trim sizes' },
    ...['trade6x9', 'digest', 'pocket', 'massMarket'].map(sizeItem),
    'separator',
    { label: 'Custom size…', icon: 'ruler', checked: L.pageSize === 'custom', onClick: customSizeDialog },
  ]);
  function sizeItem(k) {
    return { label: PAGE_SIZES[k].label, detail: PAGE_SIZES[k].detail, checked: L.pageSize === k, onClick: () => updateLayout({ pageSize: k }) };
  }
}

export function orientationMenu(anchor) {
  const L = layout();
  popover(anchor, [
    { label: 'Portrait', icon: 'rectangle-vertical', checked: L.orientation === 'portrait', onClick: () => updateLayout({ orientation: 'portrait' }) },
    { label: 'Landscape', icon: 'rectangle-horizontal', checked: L.orientation === 'landscape', onClick: () => updateLayout({ orientation: 'landscape' }) },
  ]);
}

export function columnsMenu(anchor) {
  const L = layout();
  popover(anchor, [1, 2, 3].map((n) => ({ label: ['One', 'Two', 'Three'][n - 1], icon: n === 1 ? 'rectangle-vertical' : 'columns-' + n, checked: L.columns === n, onClick: () => updateLayout({ columns: n }) })));
}

export function lineSpacingMenu(anchor, { forParagraph, onPick, current }) {
  popover(anchor, [
    ...[1, 1.15, 1.5, 2, 2.5, 3].map((v) => ({ label: v.toFixed(v % 1 ? 2 : 1).replace(/0$/, ''), checked: String(current) === String(v), onClick: () => onPick(v) })),
    forParagraph && 'separator',
    forParagraph && { label: 'Use the book’s default', icon: 'rotate-ccw', onClick: () => onPick(null) },
  ].filter(Boolean));
}

function inchInput(value, min = 0, max = 4) {
  return h('input.field', { type: 'number', min, max, step: 0.05, value });
}

async function customMarginsDialog() {
  const m = layout().margins;
  const inputs = Object.fromEntries(['top', 'bottom', 'left', 'right'].map((k) => [k, inchInput(m[k])]));
  const r = await openDialog({
    title: 'Custom margins',
    width: 380,
    body: h('div', {}, h('p.dialog-text', {}, 'Margins are in inches.'), h('div.form-grid', {}, ...Object.entries(inputs).map(([k, el]) => field(k[0].toUpperCase() + k.slice(1), el)))),
    buttons: [{ label: 'Cancel', value: null }, { label: 'Apply', value: true, primary: true }],
  });
  if (!r) return;
  const margins = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, Math.max(0, Math.min(4, parseFloat(el.value) || 0))]));
  updateLayout({ margins });
}

async function customSizeDialog() {
  const cur = pageDims({ ...layout(), orientation: 'portrait' });
  const w = inchInput(cur.w, 2, 20);
  const hh = inchInput(cur.h, 2, 30);
  const r = await openDialog({
    title: 'Custom page size',
    width: 360,
    body: h('div', {}, h('p.dialog-text', {}, 'Width and height in inches (portrait).'), h('div.form-grid', {}, field('Width', w), field('Height', hh))),
    buttons: [{ label: 'Cancel', value: null }, { label: 'Apply', value: true, primary: true }],
  });
  if (!r) return;
  updateLayout({ pageSize: 'custom', customSize: { w: Math.max(2, Math.min(20, +w.value || 6)), h: Math.max(2, Math.min(30, +hh.value || 9)) } });
}

export async function headerFooterDialog() {
  const L = layout();
  const alignSel = (v) => h('select.field', {}, ['left', 'center', 'right'].map((a) => h('option', { value: a, selected: v === a }, a[0].toUpperCase() + a.slice(1))));
  const headerText = h('input.field', { value: L.header.text, placeholder: 'e.g. {title}' });
  const headerAlign = alignSel(L.header.align);
  const footerText = h('input.field', { value: L.footer.text, placeholder: 'e.g. {author}' });
  const footerAlign = alignSel(L.footer.align);
  const showNums = h('input', { type: 'checkbox', checked: L.pageNumbers.show });
  const pos = h(
    'select.field',
    {},
    ['header-left', 'header-center', 'header-right', 'footer-left', 'footer-center', 'footer-right'].map((p) =>
      h('option', { value: p, selected: L.pageNumbers.position === p }, p.replace('-', ' – ').replace(/^./, (c) => c.toUpperCase())),
    ),
  );
  const fmt = h('select.field', {}, Object.entries(PAGE_NUMBER_FORMATS).map(([k, v]) => h('option', { value: k, selected: L.pageNumbers.format === k }, v)));
  const body = h(
    'div.hf-dialog',
    {},
    h('p.dialog-text', {}, 'Use ', h('code', {}, '{title}'), ' and ', h('code', {}, '{author}'), ' to insert your book’s details. Headers and footers appear on every page except the title page.'),
    h('div.form-section', {}, h('h4', {}, 'Header'), h('div.form-inline.grow', {}, field('Text', headerText), field('Position', headerAlign))),
    h('div.form-section', {}, h('h4', {}, 'Footer'), h('div.form-inline.grow', {}, field('Text', footerText), field('Position', footerAlign))),
    h('div.form-section', {}, h('h4', {}, 'Page numbers'), h('label.check', {}, showNums, 'Show page numbers'), h('div.form-inline.grow', {}, field('Position', pos), field('Style', fmt))),
  );
  const r = await openDialog({
    title: 'Header, footer & page numbers',
    width: 520,
    body,
    buttons: [{ label: 'Cancel', value: null }, { label: 'Apply', value: true, primary: true }],
  });
  if (!r) return;
  updateLayout({
    header: { text: headerText.value, align: headerAlign.value },
    footer: { text: footerText.value, align: footerAlign.value },
    pageNumbers: { show: showNums.checked, position: pos.value, format: fmt.value },
  });
}

export function pageNumbersMenu(anchor) {
  const pn = layout().pageNumbers;
  const set = (patch) => updateLayout({ pageNumbers: { ...pn, ...patch } });
  popover(anchor, [
    { heading: 'Position' },
    ...['footer-center', 'footer-right', 'footer-left', 'header-center', 'header-right', 'header-left'].map((p) => ({
      label: p.replace('-', ' – ').replace(/^./, (c) => c.toUpperCase()),
      checked: pn.show && pn.position === p,
      onClick: () => set({ show: true, position: p }),
    })),
    { label: 'No page numbers', checked: !pn.show, onClick: () => set({ show: false }) },
    { heading: 'Style' },
    ...Object.entries(PAGE_NUMBER_FORMATS).map(([k, v]) => ({ label: v, checked: pn.format === k, onClick: () => set({ format: k, show: true }) })),
  ]);
}

export const BODY_FONTS = FONT_CHOICES;
