import { app, h, icon } from './app.js';
import { withEditor } from './editor.js';
import { openDialog, popover, closePopover, field, toast, refreshIcons } from './ui.js';
import { SHAPES, DEFAULT_SHAPE, shapeSvg, CHART_TYPES, CHART_PALETTES, DEFAULT_CHART, chartSvg, svgDataUrl } from './graphics.js';
import { selectedImage } from './extensions/bookImage.js';
import { SCENE_SYMBOLS } from './extensions/breaks.js';

export async function insertPicture() {
  if (!app.view || app.view === 'title') return toast('Open a chapter first, then insert your picture.', 'info');
  const img = await window.moopress.pickImage();
  if (!img) return;
  if (img.size > 8 * 1024 * 1024) toast('That picture is large and will make your book file bigger. Consider resizing it first.', 'warn', 6000);
  withEditor((c) => c.setImage({ src: img.dataUrl, alt: img.name.replace(/\.[^.]+$/, '') }).run());
}

export function updateImage(attrs) {
  const node = selectedImage();
  if (!node) return;
  const { state, view } = app.editor;
  const pos = state.selection.from;
  view.dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }));
}

export function tablePicker(anchor) {
  const COLS = 10;
  const ROWS = 8;
  const label = h('div.grid-label', {}, 'Insert table');
  const grid = h('div.table-grid', { style: { gridTemplateColumns: `repeat(${COLS}, 18px)` } });
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = h('button.table-cell', { 'aria-label': `${r + 1} by ${c + 1} table` });
      cell.addEventListener('mouseenter', () => {
        cells.forEach((x) => x.el.classList.toggle('on', x.r <= r && x.c <= c));
        label.textContent = `${c + 1} × ${r + 1} table`;
      });
      cell.addEventListener('click', () => {
        closePopover();
        insertTable(r + 1, c + 1);
      });
      cells.push({ el: cell, r, c });
      grid.append(cell);
    }
  }
  const custom = h('button.menu-item', { onclick: () => { closePopover(); customTableDialog(); } }, h('span.menu-icon', {}, icon('table')), h('span.menu-label', {}, 'Custom size…'));
  popover(anchor, h('div.table-picker', {}, label, grid, h('div.menu-sep'), custom));
}

function insertTable(rows, cols) {
  withEditor((c) => c.insertTable({ rows, cols, withHeaderRow: true }).run());
}

async function customTableDialog() {
  const rows = h('input.field', { type: 'number', min: 1, max: 100, value: 4 });
  const cols = h('input.field', { type: 'number', min: 1, max: 20, value: 3 });
  const r = await openDialog({
    title: 'Insert table',
    width: 340,
    body: h('div.form-grid', {}, field('Columns', cols), field('Rows', rows)),
    buttons: [{ label: 'Cancel', value: null }, { label: 'Insert', value: true, primary: true }],
  });
  if (r) insertTable(Math.max(1, Math.min(100, +rows.value || 1)), Math.max(1, Math.min(20, +cols.value || 1)));
}

export function shapePicker(anchor) {
  const grid = h('div.shape-grid');
  for (const [kind, def] of Object.entries(SHAPES)) {
    const preview = h('span.shape-preview', { html: shapeSvg({ ...DEFAULT_SHAPE, kind, fill: '#e5edf9', stroke: '#2f6fdb', strokeWidth: 8 }) });
    grid.append(h('button.shape-option', { title: def.label, 'aria-label': def.label, onclick: () => { closePopover(); shapeDialog({ ...DEFAULT_SHAPE, kind }); } }, preview));
  }
  popover(anchor, h('div.shape-picker', {}, h('div.menu-heading', {}, 'Shapes'), grid));
}

export async function shapeDialog(spec, editing = false) {
  const s = { ...DEFAULT_SHAPE, ...spec };
  const preview = h('div.graphic-preview.shape');
  const kind = h('select.field', {}, Object.entries(SHAPES).map(([k, d]) => h('option', { value: k, selected: k === s.kind }, d.label)));
  const fill = h('input', { type: 'color', value: s.fill });
  const noFill = h('input', { type: 'checkbox', checked: s.noFill });
  const stroke = h('input', { type: 'color', value: s.stroke });
  const strokeWidth = h('input', { type: 'range', min: 0, max: 16, value: s.strokeWidth });
  const text = h('input.field', { value: s.text, placeholder: 'Optional text inside the shape' });
  const textColor = h('input', { type: 'color', value: s.textColor });
  const fontSize = h('input', { type: 'range', min: 10, max: 60, value: s.fontSize });

  const read = () => ({
    kind: kind.value, fill: fill.value, noFill: noFill.checked, stroke: stroke.value, strokeWidth: +strokeWidth.value,
    text: text.value, textColor: textColor.value, fontSize: +fontSize.value,
  });
  const draw = () => { preview.innerHTML = shapeSvg(read()); };
  const body = h(
    'div.graphic-editor',
    {},
    preview,
    h(
      'div.graphic-form',
      {},
      field('Shape', kind),
      h('div.form-inline', {}, field('Fill', fill), h('label.check', {}, noFill, 'No fill'), field('Outline', stroke)),
      field('Outline thickness', strokeWidth),
      field('Text', text),
      h('div.form-inline', {}, field('Text colour', textColor), field('Text size', fontSize)),
    ),
  );
  body.addEventListener('input', draw);
  draw();
  const r = await openDialog({
    title: editing ? 'Edit shape' : 'Insert shape',
    width: 640,
    body,
    buttons: [{ label: 'Cancel', value: null }, { label: editing ? 'Update shape' : 'Insert shape', value: true, primary: true }],
  });
  if (!r) return;
  const out = read();
  const attrs = { src: svgDataUrl(shapeSvg(out)), alt: `${SHAPES[out.kind].label}${out.text ? `: ${out.text}` : ''}`, shape: JSON.stringify(out), chart: null };
  if (editing) updateImage(attrs);
  else withEditor((c) => c.insertContent({ type: 'image', attrs: { ...attrs, width: 200 } }).run());
}

export async function chartDialog(spec, editing = false) {
  const c = structuredClone({ ...DEFAULT_CHART, ...spec });
  const preview = h('div.graphic-preview.chart');
  const title = h('input.field', { value: c.title, placeholder: 'Chart title' });
  const palette = h('select.field', {}, Object.keys(CHART_PALETTES).map((p) => h('option', { value: p, selected: p === c.palette }, p[0].toUpperCase() + p.slice(1))));
  const showValues = h('input', { type: 'checkbox', checked: c.showValues });
  const typeBar = h('div.segmented');
  const rowsBox = h('div.data-rows');

  const draw = () => { preview.innerHTML = chartSvg(c); };
  const drawTypes = () => {
    typeBar.replaceChildren(
      ...Object.entries(CHART_TYPES).map(([k, t]) =>
        h(`button.seg${c.type === k ? '.active' : ''}`, { type: 'button', onclick: () => { c.type = k; drawTypes(); draw(); } }, icon(t.icon), t.label),
      ),
    );
    refreshIcons(typeBar);
  };
  const drawRows = () => {
    rowsBox.replaceChildren(
      h('div.data-row.head', {}, h('span', {}, 'Label'), h('span', {}, 'Value'), h('span')),
      ...c.rows.map((row, i) => {
        const l = h('input.field', { value: row.label, placeholder: `Item ${i + 1}` });
        const v = h('input.field', { type: 'number', value: row.value, step: 'any' });
        l.addEventListener('input', () => { row.label = l.value; draw(); });
        v.addEventListener('input', () => { row.value = v.value === '' ? 0 : +v.value; draw(); });
        return h(
          'div.data-row',
          {},
          l,
          v,
          h('button.icon-btn.small', { type: 'button', title: 'Remove row', disabled: c.rows.length <= 1, onclick: () => { c.rows.splice(i, 1); drawRows(); draw(); } }, icon('trash-2')),
        );
      }),
      h('button.btn.small', { type: 'button', onclick: () => { c.rows.push({ label: '', value: 0 }); drawRows(); draw(); rowsBox.querySelector('.data-row:last-of-type input')?.focus(); } }, icon('plus'), 'Add row'),
    );
    refreshIcons(rowsBox);
  };
  title.addEventListener('input', () => { c.title = title.value; draw(); });
  palette.addEventListener('change', () => { c.palette = palette.value; draw(); });
  showValues.addEventListener('change', () => { c.showValues = showValues.checked; draw(); });

  drawTypes();
  drawRows();
  draw();
  const body = h(
    'div.graphic-editor.chart-editor',
    {},
    h('div.chart-left', {}, typeBar, preview),
    h('div.graphic-form', {}, field('Title', title), h('div.form-inline', {}, field('Colours', palette), h('label.check', {}, showValues, 'Show values')), h('div.form-label', {}, 'Data'), rowsBox),
  );
  const r = await openDialog({
    title: editing ? 'Edit chart' : 'Insert chart',
    width: 980,
    body,
    buttons: [{ label: 'Cancel', value: null }, { label: editing ? 'Update chart' : 'Insert chart', value: true, primary: true }],
  });
  if (!r) return;
  const attrs = { src: svgDataUrl(chartSvg(c)), alt: c.title || 'Chart', chart: JSON.stringify(c), shape: null };
  if (editing) updateImage(attrs);
  else withEditor((ch) => ch.insertContent({ type: 'image', attrs: { ...attrs, width: 520 } }).run());
}

export function editSelectedGraphic() {
  const node = selectedImage();
  if (!node) return;
  if (node.attrs.chart) chartDialog(JSON.parse(node.attrs.chart), true);
  else if (node.attrs.shape) shapeDialog(JSON.parse(node.attrs.shape), true);
}

export async function linkDialog() {
  const { editor } = app;
  if (!app.view || app.view === 'title') return;
  const existing = editor.getAttributes('link').href || '';
  const { from, to, empty } = editor.state.selection;
  const url = h('input.field', { value: existing, placeholder: 'https://example.com', autofocus: true });
  const text = h('input.field', { value: editor.state.doc.textBetween(from, to, ' '), placeholder: 'Text to show' });
  const buttons = [{ label: 'Cancel', value: null }];
  if (existing) buttons.push({ label: 'Remove link', value: 'remove', danger: true });
  buttons.push({ label: existing ? 'Update' : 'Insert link', value: 'ok', primary: true });
  const r = await openDialog({ title: existing ? 'Edit link' : 'Insert link', width: 420, body: h('div', {}, field('Address', url), empty && field('Text to display', text)), buttons });
  if (r === 'remove') return withEditor((c) => c.extendMarkRange('link').unsetLink().run());
  if (r !== 'ok' || !url.value.trim()) return;
  let href = url.value.trim();
  if (!/^[a-z]+:/i.test(href)) href = `https://${href}`;
  if (empty) {
    const label = text.value.trim() || href;
    withEditor((c) => c.insertContent({ type: 'text', text: label, marks: [{ type: 'link', attrs: { href } }] }).run());
  } else {
    withEditor((c) => c.extendMarkRange('link').setLink({ href }).run());
  }
}

const SYMBOLS = [
  ['—', 'Em dash'], ['–', 'En dash'], ['…', 'Ellipsis'], ['“', 'Left double quote'], ['”', 'Right double quote'],
  ['‘', 'Left single quote'], ['’', 'Right single quote / apostrophe'], ['«', 'Left guillemet'], ['»', 'Right guillemet'],
  ['§', 'Section'], ['¶', 'Pilcrow'], ['†', 'Dagger'], ['‡', 'Double dagger'], ['•', 'Bullet'], ['·', 'Middle dot'],
  ['©', 'Copyright'], ['®', 'Registered'], ['™', 'Trademark'], ['°', 'Degree'], ['×', 'Multiplication'],
  ['½', 'One half'], ['¼', 'One quarter'], ['¾', 'Three quarters'], ['€', 'Euro'], ['£', 'Pound'], ['¥', 'Yen'],
  ['é', 'e acute'], ['è', 'e grave'], ['ñ', 'n tilde'], ['ü', 'u umlaut'], ['ç', 'c cedilla'], ['æ', 'ae'],
  ['❧', 'Floral heart'], ['⁂', 'Asterism'], ['♥', 'Heart'], ['★', 'Star'],
];

export function symbolPicker(anchor) {
  const grid = h('div.symbol-grid');
  for (const [ch, name] of SYMBOLS) {
    grid.append(h('button.symbol', { title: name, 'aria-label': name, onclick: () => { closePopover(); withEditor((c) => c.insertContent(ch).run()); } }, ch));
  }
  popover(anchor, h('div.symbol-picker', {}, h('div.menu-heading', {}, 'Symbols & special characters'), grid));
}

export function sceneBreakMenu(anchor) {
  popover(
    anchor,
    SCENE_SYMBOLS.map((s) => ({ label: s, onClick: () => withEditor((c) => c.setSceneBreak(s).run()), style: { fontFamily: 'Georgia, serif', letterSpacing: '2px' } })),
  );
}
