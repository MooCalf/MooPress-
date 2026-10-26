import { app, h, icon, on } from './app.js';
import { actions, runAction } from './keybinds.js';
import { colors } from './actions.js';
import { withEditor } from './editor.js';
import { FONT_CHOICES, FONT_SIZES } from './project.js';
import { popover, colorPicker, refreshIcons, promptDialog, closePopover } from './ui.js';
import { fontStack, marginsMenu, sizeMenu, orientationMenu, columnsMenu, lineSpacingMenu, pageNumbersMenu, updateLayout } from './layout.js';
import { tablePicker, shapePicker, symbolPicker, sceneBreakMenu, updateImage, editSelectedGraphic } from './insert.js';
import { selectedImage, imageCss, IMAGE_DEFAULTS } from './extensions/bookImage.js';
import { openBook } from './fileops.js';
import { openSettings } from './settings.js';
import { snippetMenu } from './features/snippets.js';
import { libraryPanel } from './features/library.js';

let activeTab = 'home';
let contextualTab = null;
let tabBeforeContextual = null;
const ribbonEl = () => document.getElementById('ribbon');
const tabsEl = () => document.getElementById('ribbon-tabs');

function large(action, iconName, label, opts = {}) {
  const btn = h(
    `button.rb-large${opts.menu ? '.has-menu' : ''}`,
    { 'data-action': opts.onClick ? null : action, 'data-tip': opts.tip, 'data-desc': opts.desc, 'aria-label': label },
    icon(iconName),
    h('span.rb-label', {}, label, opts.menu && icon('chevron-down', 'caret')),
  );
  if (opts.onClick) btn.addEventListener('click', () => opts.onClick(btn));
  return btn;
}

function small(action, iconName, label, opts = {}) {
  const btn = h(
    `button.rb-small${opts.showLabel ? '.labelled' : ''}${opts.menu ? '.has-menu' : ''}`,
    { 'data-action': opts.onClick ? null : action, 'data-tip': opts.tip, 'data-desc': opts.desc, 'aria-label': label },
    icon(iconName),
    opts.showLabel && h('span', {}, label),
    opts.menu && icon('chevron-down', 'caret'),
  );
  if (opts.onClick) btn.addEventListener('click', () => opts.onClick(btn));
  return btn;
}

const row = (...items) => h('div.rb-row', {}, ...items);
const stack = (...rows) => h('div.rb-stack', {}, ...rows);
const sep = () => h('span.rb-sep');
const group = (label, ...children) => h('div.rb-group', {}, h('div.rb-group-body', {}, ...children), h('div.rb-group-label', {}, label));

function colorButton(action, iconName, label, key, { noneLabel, onNone, onPick }) {
  const bar = h('span.color-bar', { style: { background: colors[key] } });
  const main = h('button.rb-small.split-main', { 'data-action': action, 'aria-label': label }, h('span.color-icon', {}, icon(iconName), bar));
  const arrow = h('button.rb-small.split-arrow', { 'data-tip': `${label} — choose colour`, 'aria-label': `Choose ${label.toLowerCase()}` }, icon('chevron-down', 'caret'));
  arrow.addEventListener('click', () =>
    popover(
      arrow,
      colorPicker({
        noneLabel,
        recentKey: `mp-color-${key}`,
        onPick: (c) => {
          if (c == null) return onNone();
          colors[key] = c;
          bar.style.background = c;
          onPick(c);
        },
      }),
    ),
  );
  return h('div.split', {}, main, arrow);
}

const TABS = [
  { id: 'file', label: 'File', build: buildFile },
  { id: 'home', label: 'Home', build: buildHome },
  { id: 'insert', label: 'Insert', build: buildInsert },
  { id: 'layout', label: 'Layout', build: buildLayout },
  { id: 'review', label: 'Review', build: buildReview },
  { id: 'view', label: 'View', build: buildView },
  { id: 'settings', label: 'Settings', build: buildSettings },
  { id: 'picture', label: 'Picture Format', build: buildPicture, contextual: true },
  { id: 'table', label: 'Table', build: buildTable, contextual: true },
];

function buildFile() {
  const recent = large(null, 'history', 'Recent', {
    menu: true,
    tip: 'Open a book you worked on recently',
    onClick: (btn) => {
      const list = app.settings.recentFiles || [];
      popover(btn, list.length ? list.map((r) => ({ label: r.title, detail: shortPath(r.path), icon: 'book', onClick: () => openBook(r.path) })) : [{ label: 'No recent books yet', disabled: true }]);
    },
  });
  return [
    group('Book', large('newBook', 'file-plus-2', 'New'), large('openBook', 'folder-open', 'Open'), recent),
    group('Save', large('save', 'save', 'Save'), large('saveAs', 'save-all', 'Save as')),
    group('Share & print', large('exportPdf', 'file-down', 'Export PDF'), large('exportHtml', 'globe', 'Web page'), large('print', 'printer', 'Print')),
    group('Details', large('titlePage', 'book-open', 'Title page', { tip: 'Edit title, subtitle, author and dedication' })),
    ...libraryPanel(group, large),
  ];
}

function shortPath(p) {
  const parts = p.split(/[\\/]/);
  return parts.length > 3 ? `…\\${parts.slice(-2).join('\\')}` : p;
}

function buildHome() {
  const fontSel = h('select.rb-select.font-family', { 'aria-label': 'Font', 'data-tip': 'Font' });
  fontSel.append(h('option', { value: '' }, 'Book font'), ...FONT_CHOICES.map((f) => h('option', { value: f, style: { fontFamily: fontStack(f) } }, f)));
  fontSel.addEventListener('change', () => withEditor((c) => (fontSel.value ? c.setFontFamily(fontSel.value) : c.unsetFontFamily()).run()));

  const sizeInput = h('input.rb-input.font-size', { list: 'mp-font-sizes', 'aria-label': 'Font size', 'data-tip': 'Font size (points)' });
  const sizeList = h('datalist', { id: 'mp-font-sizes' }, FONT_SIZES.map((s) => h('option', { value: s })));
  const applySize = () => {
    const v = parseFloat(sizeInput.value);
    withEditor((c) => (v > 0 && v < 400 ? c.setFontSize(`${v}pt`) : c.unsetFontSize()).run());
  };
  sizeInput.addEventListener('change', applySize);
  sizeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applySize(); } });

  const lineSpacing = small(null, 'list-collapse', 'Line spacing', {
    menu: true,
    tip: 'Line spacing for the selected paragraphs',
    onClick: (btn) => lineSpacingMenu(btn, { forParagraph: true, current: app.editor.getAttributes('paragraph').lineHeight, onPick: (v) => withEditor((c) => c.setLineHeight(v == null ? null : String(v)).run()) }),
  });

  const styleCard = (action, cls, text) => h(`button.style-card.${cls}`, { 'data-action': action }, h('span', {}, text));

  return [
    group(
      'Clipboard',
      large('paste', 'clipboard-paste', 'Paste'),
      stack(small('cut', 'scissors', 'Cut', { showLabel: true }), small('copy', 'copy', 'Copy', { showLabel: true }), small('pastePlain', 'clipboard-type', 'Paste text only', { showLabel: true })),
      stack(small('clipboardSlots', 'layers', 'Clipboard slots', { showLabel: true, tip: 'Clipboard slots' })),
    ),
    group(
      'Font',
      stack(
        row(fontSel, sizeInput, sizeList, small('growFont', 'a-arrow-up', 'Bigger'), small('shrinkFont', 'a-arrow-down', 'Smaller'), small('clearFormatting', 'remove-formatting', 'Clear formatting')),
        row(
          small('bold', 'bold', 'Bold'), small('italic', 'italic', 'Italic'), small('underline', 'underline', 'Underline'), small('strike', 'strikethrough', 'Strikethrough'),
          small('subscript', 'subscript', 'Subscript'), small('superscript', 'superscript', 'Superscript'), sep(),
          colorButton('textColor', 'baseline', 'Font colour', 'text', { noneLabel: 'Automatic', onNone: () => withEditor((c) => c.unsetColor().run()), onPick: (c) => withEditor((ch) => ch.setColor(c).run()) }),
          colorButton('highlight', 'highlighter', 'Highlight', 'highlight', { noneLabel: 'No highlight', onNone: () => withEditor((c) => c.unsetHighlight().run()), onPick: (c) => withEditor((ch) => ch.setHighlight({ color: c }).run()) }),
        ),
      ),
    ),
    group(
      'Paragraph',
      stack(
        row(small('bulletList', 'list', 'Bullets'), small('orderedList', 'list-ordered', 'Numbering'), sep(), small('outdent', 'indent-decrease', 'Decrease indent'), small('indent', 'indent-increase', 'Increase indent'), sep(), lineSpacing),
        row(small('alignLeft', 'align-left', 'Left'), small('alignCenter', 'align-center', 'Center'), small('alignRight', 'align-right', 'Right'), small('justify', 'align-justify', 'Justify'), sep(), small('quote', 'quote', 'Quote')),
      ),
    ),
    group('Styles', h('div.style-gallery', {}, styleCard('normalText', 'st-normal', 'Normal'), styleCard('heading1', 'st-h1', 'Heading 1'), styleCard('heading2', 'st-h2', 'Heading 2'), styleCard('heading3', 'st-h3', 'Heading 3'), styleCard('quote', 'st-quote', 'Quote'))),
    group('Editing', stack(small('find', 'search', 'Find', { showLabel: true }), small('replace', 'replace', 'Replace', { showLabel: true }), small('selectAll', 'text-select', 'Select all', { showLabel: true }))),
  ];
}

function buildInsert() {
  return [
    group('Pages', large('pageBreak', 'file-symlink', 'Page break'), large(null, 'asterisk', 'Scene break', { menu: true, tip: 'Scene break', desc: 'Insert a centred divider between scenes. Click to pick a style.', onClick: sceneBreakMenu })),
    group(
      'Illustrations',
      large('picture', 'image', 'Picture'),
      large(null, 'shapes', 'Shapes', { menu: true, tip: 'Shapes', desc: 'Boxes, arrows, stars, speech bubbles and more.', onClick: shapePicker }),
      large('chart', 'bar-chart-3', 'Chart'),
    ),
    group('Tables', large(null, 'table', 'Table', { menu: true, tip: 'Table', desc: 'Pick a size from the grid to insert a table.', onClick: tablePicker })),
    group('Links & symbols', large('link', 'link', 'Link'), large(null, 'omega', 'Symbol', { menu: true, tip: 'Symbol', desc: 'Em dashes, curly quotes, accented letters and other special characters.', onClick: symbolPicker })),
    group('Snippets', large(null, 'text-cursor-input', 'Snippets', { menu: true, tip: 'Snippets', desc: 'Insert a saved text block. Tip: type / and a trigger such as /sig right in your text.', onClick: snippetMenu })),
    group('Chapters', large('newChapter', 'book-plus', 'New chapter')),
  ];
}

function buildLayout() {
  const L = app.project.layout;
  const select = (label, value, options, onChange, cls = '') => {
    const s = h(`select.rb-select${cls}`, { 'aria-label': label, 'data-tip': label }, options.map(([v, l, style]) => h('option', { value: v, selected: String(v) === String(value), style }, l)));
    s.addEventListener('change', () => onChange(s.value));
    return s;
  };
  const labelled = (label, control) => h('label.rb-labelled', {}, h('span', {}, label), control);
  return [
    group(
      'Page setup',
      large(null, 'square-dashed', 'Margins', { menu: true, tip: 'Margins', desc: 'The blank space around the edges of each page.', onClick: marginsMenu }),
      large(null, 'rotate-ccw-square', 'Orientation', { menu: true, tip: 'Orientation', desc: 'Portrait (tall) or landscape (wide) pages.', onClick: orientationMenu }),
      large(null, 'file', 'Size', { menu: true, tip: 'Page size', desc: 'Standard paper or book trim sizes like 6" × 9".', onClick: sizeMenu }),
      large(null, 'columns-2', 'Columns', { menu: true, tip: 'Columns', desc: 'Split the text into one, two or three columns.', onClick: columnsMenu }),
    ),
    group(
      'Header & footer',
      large('headerFooter', 'panel-top', 'Header & footer'),
      large(null, 'hash', 'Page numbers', { menu: true, tip: 'Page numbers', desc: 'Choose where page numbers go and how they look.', onClick: pageNumbersMenu }),
    ),
    group(
      'Body text',
      stack(
        row(labelled('Font', select('Book font', L.fontFamily, FONT_CHOICES.map((f) => [f, f, { fontFamily: fontStack(f) }]), (v) => updateLayout({ fontFamily: v }), '.font-family'))),
        row(
          labelled('Size', select('Book font size', L.fontSize, [10, 10.5, 11, 11.5, 12, 13, 14, 16].map((s) => [s, `${s} pt`]), (v) => updateLayout({ fontSize: +v }))),
          labelled('Spacing', select('Book line spacing', L.lineHeight, [1, 1.15, 1.3, 1.5, 2].map((s) => [s, String(s)]), (v) => updateLayout({ lineHeight: +v }))),
        ),
        row(labelled('Paragraphs', select('Paragraph style', L.paragraphStyle, [['book', 'Indented (novel style)'], ['block', 'Spaced (block style)']], (v) => updateLayout({ paragraphStyle: v })))),
      ),
    ),
    group('Book', stack(small('toggleChapterNewPage', 'file-stack', 'Chapters on new page', { showLabel: true }), small('toggleTitlePage', 'book-open', 'Title page', { showLabel: true }), small('pageBreak', 'file-symlink', 'Page break', { showLabel: true }))),
  ];
}

function buildReview() {
  return [
    group('Proofing', large('proofing', 'spell-check', 'Spelling & grammar'), large('wordCount', 'whole-word', 'Word count')),
    group('Writing aids', large('synonyms', 'book-a', 'Synonyms'), large('fluffDetector', 'scan-text', 'Cliché & fluff'), large('timeMachine', 'history', 'Time Machine')),
    group('Story Settings', large('addBibleEntry', 'user-round-plus', 'Add entry'), stack(small('toggleBibleHighlights', 'underline', 'Underline names', { showLabel: true }))),
    group('As you type', stack(small('toggleSpellcheck', 'check-check', 'Spelling', { showLabel: true }), small('toggleGrammar', 'wand-2', 'Grammar', { showLabel: true }), small('toggleStyle', 'feather', 'Style tips', { showLabel: true }))),
    group('Language', large(null, 'languages', 'Language', { tip: 'Dictionary language', onClick: () => openSettings('writing') })),
    group('Find', large('find', 'search', 'Find'), large('replace', 'replace', 'Replace')),
  ];
}

function buildView() {
  return [
    group('Writing', large('zenMode', 'flower-2', 'Zen mode'), large('focusMode', 'maximize-2', 'Focus mode'), stack(small('typewriter', 'align-vertical-justify-center', 'Typewriter scrolling', { showLabel: true }), small('toggleFocusPalette', 'panel-top-dashed', 'Floating palette', { showLabel: true }), small('toggleRadialMenu', 'circle-dot', 'Radial menu', { showLabel: true }))),
    group('Show', stack(small('toggleSidebar', 'panel-left', 'Chapter list', { showLabel: true }), small('togglePageGuides', 'separator-horizontal', 'Page guides', { showLabel: true }), small('toggleRibbon', 'panel-top-close', 'Collapse ribbon', { showLabel: true }))),
    group('Zoom', large('zoomReset', 'search', '100%'), stack(small('zoomIn', 'zoom-in', 'Zoom in', { showLabel: true }), small('zoomOut', 'zoom-out', 'Zoom out', { showLabel: true }), small('zoomWidth', 'move-horizontal', 'Page width', { showLabel: true }))),
    group('Appearance', large('toggleTheme', 'moon', 'Dark mode')),
  ];
}

function buildSettings() {
  return [
    group('Customise', large('shortcuts', 'keyboard', 'Keyboard shortcuts'), large(null, 'sliders-horizontal', 'Preferences', { tip: 'Theme, autosave and other preferences', onClick: () => openSettings('general') })),
    group('Writing', large(null, 'spell-check', 'Proofing options', { tip: 'Spelling, grammar and typing preferences', onClick: () => openSettings('writing') })),
    group('Help', large(null, 'info', 'About', { tip: 'About MooPress', onClick: () => openSettings('about') })),
  ];
}

const PRESETS = {
  Original: {},
  'Black & white': { grayscale: 100, contrast: 110 },
  Sepia: { sepia: 80, contrast: 95 },
  Vintage: { sepia: 40, saturate: 70, contrast: 90, brightness: 105 },
  Vivid: { saturate: 160, contrast: 115 },
  Faded: { saturate: 60, contrast: 80, brightness: 115 },
  'Soft focus': { blur: 1.5, brightness: 105 },
};
const EFFECT_KEYS = ['brightness', 'contrast', 'saturate', 'grayscale', 'sepia', 'blur'];

function previewImage(attrs) {
  const { state, view } = app.editor;
  const dom = view.nodeDOM(state.selection.from);
  const img = dom?.querySelector?.('img');
  if (img) img.style.cssText = imageCss(attrs);
}

function slider(label, key, min, max, step, node, suffix = '%') {
  const value = h('span.rb-slider-value', {}, `${node.attrs[key] ?? IMAGE_DEFAULTS[key]}${suffix}`);
  const input = h('input', { type: 'range', min, max, step, value: node.attrs[key] ?? IMAGE_DEFAULTS[key], 'aria-label': label });
  input.addEventListener('input', () => {
    value.textContent = `${input.value}${suffix}`;
    previewImage({ ...selectedImage().attrs, [key]: +input.value });
  });
  input.addEventListener('change', () => updateImage({ [key]: +input.value }));
  return h('label.rb-slider', {}, h('span', {}, label), input, value);
}

function buildPicture() {
  const node = selectedImage();
  if (!node) return [];
  const a = node.attrs;
  const alignBtn = (align, iconName, label) => {
    const b = small(null, iconName, label, { tip: label, onClick: () => updateImage({ align }) });
    b.classList.toggle('active', a.align === align);
    return b;
  };
  const toggleBtn = (key, iconName, label, on, off) => {
    const b = small(null, iconName, label, { showLabel: true, tip: label, onClick: () => updateImage({ [key]: a[key] ? off : on }) });
    b.classList.toggle('active', !!a[key]);
    return b;
  };
  const widthInput = h('input.rb-input', { type: 'number', min: 40, max: 2000, value: a.width || '', placeholder: 'Auto', 'aria-label': 'Width in pixels' });
  widthInput.addEventListener('change', () => updateImage({ width: widthInput.value ? Math.max(40, +widthInput.value) : null }));

  const effects = large(null, 'sparkles', 'Effects', {
    menu: true,
    tip: 'Picture effects',
    desc: 'One-click looks such as black & white, sepia or vintage.',
    onClick: (btn) =>
      popover(btn, Object.entries(PRESETS).map(([name, p]) => ({
        label: name,
        onClick: () => updateImage({ ...Object.fromEntries(EFFECT_KEYS.map((k) => [k, IMAGE_DEFAULTS[k]])), ...p }),
      }))),
  });

  const isGraphic = a.chart || a.shape;
  return [
    isGraphic && group('Edit', large(null, a.chart ? 'bar-chart-3' : 'shapes', a.chart ? 'Edit chart' : 'Edit shape', { tip: 'Change the data, colours or text', onClick: editSelectedGraphic })),
    group('Size', stack(h('label.rb-labelled', {}, h('span', {}, 'Width'), widthInput, h('span.muted', {}, 'px')), small(null, 'scan', 'Original size', { showLabel: true, tip: 'Reset to the picture’s natural size', onClick: () => updateImage({ width: null }) }), h('span.rb-hint', {}, 'Tip: drag the corner handle'))),
    group('Position', stack(
      row(alignBtn('left', 'align-start-vertical', 'Left'), alignBtn('center', 'align-center-vertical', 'Center'), alignBtn('right', 'align-end-vertical', 'Right')),
      row(alignBtn('wrap-left', 'wrap-text', 'Wrap text — picture on the left'), alignBtn('wrap-right', 'text-wrap', 'Wrap text — picture on the right')),
    )),
    group('Adjust', stack(slider('Brightness', 'brightness', 30, 200, 1, node), slider('Contrast', 'contrast', 30, 200, 1, node), slider('Saturation', 'saturate', 0, 250, 1, node))),
    group('Style', effects, stack(toggleBtn('shadow', 'square', 'Shadow', true, false), toggleBtn('border', 'frame', 'Frame', true, false), toggleBtn('rounded', 'squircle', 'Rounded', 16, 0))),
    group('Arrange', stack(
      small(null, 'rotate-ccw', 'Rotate left', { showLabel: true, tip: 'Rotate 90° left', onClick: () => updateImage({ rotate: ((a.rotate || 0) - 90 + 360) % 360 }) }),
      small(null, 'rotate-cw', 'Rotate right', { showLabel: true, tip: 'Rotate 90° right', onClick: () => updateImage({ rotate: ((a.rotate || 0) + 90) % 360 }) }),
      small(null, 'flip-horizontal-2', 'Flip', { showLabel: true, tip: 'Mirror the picture', onClick: () => updateImage({ flipH: !a.flipH }) }),
    )),
    group('Picture', stack(
      small(null, 'text', 'Alt text…', { showLabel: true, tip: 'Describe the picture for screen readers and e-books', onClick: async () => { const t = await promptDialog('Alt text', 'Describe this picture', a.alt || ''); if (t != null) updateImage({ alt: t }); } }),
      small(null, 'undo-dot', 'Reset picture', { showLabel: true, tip: 'Remove all adjustments and effects', onClick: () => updateImage({ ...IMAGE_DEFAULTS, chart: a.chart, shape: a.shape, width: a.width }) }),
      small(null, 'trash-2', 'Delete', { showLabel: true, tip: 'Delete the picture', onClick: () => withEditor((c) => c.deleteSelection().run()) }),
    )),
  ].filter(Boolean);
}

function buildTable() {
  const t = (cmd, iconName, label) => small(null, iconName, label, { showLabel: true, tip: label, onClick: () => withEditor((c) => c[cmd]().run()) });
  return [
    group('Rows', stack(t('addRowBefore', 'between-horizontal-start', 'Insert above'), t('addRowAfter', 'between-horizontal-end', 'Insert below'), t('deleteRow', 'trash', 'Delete row'))),
    group('Columns', stack(t('addColumnBefore', 'between-vertical-start', 'Insert left'), t('addColumnAfter', 'between-vertical-end', 'Insert right'), t('deleteColumn', 'trash', 'Delete column'))),
    group('Cells', stack(t('mergeCells', 'merge', 'Merge cells'), t('splitCell', 'split', 'Split cell'))),
    group('Headers', stack(t('toggleHeaderRow', 'panel-top', 'Header row'), t('toggleHeaderColumn', 'panel-left', 'Header column'))),
    group('Table', large(null, 'trash-2', 'Delete table', { tip: 'Delete the whole table', onClick: () => withEditor((c) => c.deleteTable().run()) })),
  ];
}

export function buildRibbon() {
  renderTabs();
  renderPanel();
  tabsEl().addEventListener('dblclick', (e) => {
    if (e.target.closest('.rb-tab')) runAction('toggleRibbon');
  });
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled || btn.closest('.settings-page')) return;
    closePopover();
    runAction(btn.dataset.action);
    if (ribbonEl().classList.contains('peek') && btn.closest('#ribbon')) ribbonEl().classList.remove('peek');
  });
  ribbonEl().addEventListener('mousedown', (e) => {
    if (e.target.closest('button') && !e.target.closest('input, select')) e.preventDefault();
  });
  document.addEventListener('mousedown', (e) => {
    if (ribbonEl().classList.contains('peek') && !e.target.closest('#ribbon, #topbar, .popover, .modal-overlay')) ribbonEl().classList.remove('peek');
  });
}

function renderTabs() {
  tabsEl().replaceChildren(
    ...TABS.filter((t) => !t.contextual || t.id === contextualTab).map((t) =>
      h(
        `button.rb-tab${t.id === activeTab ? '.active' : ''}${t.contextual ? '.contextual' : ''}`,
        { role: 'tab', 'aria-selected': String(t.id === activeTab), onclick: () => selectTab(t.id) },
        t.label,
      ),
    ),
  );
}

export function selectTab(id) {
  activeTab = id;
  if (app.settings.ribbonCollapsed) ribbonEl().classList.add('peek');
  renderTabs();
  renderPanel();
}

function renderPanel() {
  const tab = TABS.find((t) => t.id === activeTab) || TABS[1];
  const panel = h('div.rb-panel', { role: 'tabpanel', 'data-tab': tab.id }, ...tab.build());
  ribbonEl().replaceChildren(panel);
  refreshIcons(ribbonEl());
  refreshState();
}

export function refreshState() {
  const inChapter = app.view && app.view !== 'title';
  for (const el of document.querySelectorAll('[data-action]')) {
    const a = actions.get(el.dataset.action);
    if (!a) continue;
    if (a.isActive) el.classList.toggle('active', !!a.isActive());
    const disabled = (a.scope === 'editor' && !inChapter) || (a.isEnabled && !a.isEnabled());
    el.toggleAttribute('disabled', !!disabled);
  }
  const fontSel = ribbonEl().querySelector('.rb-panel[data-tab="home"] .font-family');
  if (fontSel && document.activeElement !== fontSel) {
    const f = inChapter ? app.editor.getAttributes('textStyle').fontFamily || '' : '';
    fontSel.value = FONT_CHOICES.includes(f) ? f : '';
    fontSel.options[0].textContent = `Book font (${app.project.layout.fontFamily})`;
  }
  const sizeInput = ribbonEl().querySelector('.font-size');
  if (sizeInput && document.activeElement !== sizeInput) {
    const s = inChapter ? app.editor.getAttributes('textStyle').fontSize : null;
    sizeInput.value = s ? parseFloat(s) : app.project.layout.fontSize;
  }
}

function updateContextual() {
  const img = app.view !== 'title' && selectedImage();
  const inTable = app.view !== 'title' && app.editor.isActive('table');
  const next = img ? 'picture' : inTable ? 'table' : null;
  if (next === contextualTab) {
    if (next === 'picture' && activeTab === 'picture') renderPanel();
    else refreshState();
    return;
  }
  const wasOnContextual = activeTab === contextualTab;
  if (!contextualTab || !wasOnContextual) tabBeforeContextual = activeTab;
  contextualTab = next;
  if (next === 'picture') activeTab = 'picture';
  else if (wasOnContextual) activeTab = next || tabBeforeContextual || 'home';
  renderTabs();
  renderPanel();
}

let pending = false;
function scheduleRefresh() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    if (app.editor) updateContextual();
  });
}

on('transaction', scheduleRefresh);
on('selection-changed', scheduleRefresh);
on('view-changed', scheduleRefresh);
on('settings-changed', scheduleRefresh);
on('layout-changed', () => { if (activeTab === 'layout') renderPanel(); else refreshState(); });
on('project-loaded', () => renderPanel());
on('focus-changed', scheduleRefresh);
