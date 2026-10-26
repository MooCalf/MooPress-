import { app, emit, h, icon, debounce } from './app.js';
import {
  actions, CATEGORIES, bindingFor, isCustomized, formatCombo, comboFromEvent, shortcutProblem,
  actionForCombo, setBinding, resetBinding, resetAllBindings, suspendShortcuts,
} from './keybinds.js';
import { refreshIcons, confirmDialog, toast } from './ui.js';
import { renderSnippetSettings } from './features/snippets.js';
import { logoLockup } from './assets.js';
import { saveFolder } from './folders.js';
import { changeSaveFolder, openSaveFolder } from './features/library.js';
import { startTour } from './features/tour.js';

export const DEFAULT_SETTINGS = {
  theme: 'system',
  autosave: true,
  autosaveMinutes: 3,
  spellcheck: true,
  spellLanguage: '',
  grammarAsYouType: true,
  styleSuggestions: false,
  smartQuotes: true,
  zoom: 1,
  showPageGuides: true,
  ribbonCollapsed: false,
  sidebarVisible: true,
  tourDone: false,
  saveFolder: '',
  recentFiles: [],
  keybinds: {},
  typewriter: false,
  fluffDetector: false,
  focusPalette: true,
  radialMenu: true,
  smartSynonyms: true,
  bibleHighlights: true,
  snippets: null,
};

export async function loadSettings() {
  const saved = (await window.moopress.loadSettings()) || {};
  app.settings = { ...DEFAULT_SETTINGS, ...saved, keybinds: { ...(saved.keybinds || {}) } };
}

const persist = debounce(() => window.moopress.saveSettings(app.settings).catch(console.error), 250);

export function saveSettings() {
  persist();
}

export function setSetting(key, value) {
  app.settings[key] = value;
  saveSettings();
  emit('settings-changed', key, value);
}

const SECTIONS = [
  { id: 'general', label: 'General', icon: 'sliders-horizontal' },
  { id: 'writing', label: 'Writing & proofing', icon: 'spell-check' },
  { id: 'tools', label: 'Writing tools', icon: 'wand-sparkles' },
  { id: 'snippets', label: 'Snippets', icon: 'text-cursor-input' },
  { id: 'shortcuts', label: 'Keyboard shortcuts', icon: 'keyboard' },
  { id: 'about', label: 'About', icon: 'info' },
];

let currentSection = 'general';

export function openSettings(section = 'general') {
  currentSection = section;
  const page = document.getElementById('settings-page');
  page.hidden = false;
  page.className = 'settings-page';
  renderSettings();
  document.addEventListener('keydown', escToClose, true);
}

export function closeSettings() {
  const page = document.getElementById('settings-page');
  page.hidden = true;
  page.replaceChildren();
  document.removeEventListener('keydown', escToClose, true);
  emit('settings-closed');
}

function escToClose(e) {
  if (e.key === 'Escape' && !document.querySelector('.recording, .modal-overlay')) {
    e.preventDefault();
    closeSettings();
  }
}

function renderSettings() {
  const page = document.getElementById('settings-page');
  const nav = h(
    'nav.settings-nav',
    {},
    h('button.settings-back', { onclick: closeSettings }, icon('arrow-left'), 'Back to my book'),
    h('h1', {}, 'Settings'),
    SECTIONS.map((s) =>
      h(
        `button.settings-nav-item${s.id === currentSection ? '.active' : ''}`,
        { onclick: () => { currentSection = s.id; renderSettings(); } },
        icon(s.icon),
        s.label,
      ),
    ),
  );
  const body = h('section.settings-content');
  ({ general: renderGeneral, writing: renderWriting, tools: renderTools, snippets: renderSnippetSettings, shortcuts: renderShortcuts, about: renderAbout })[currentSection](body);
  page.replaceChildren(nav, body);
  refreshIcons(page);
}

function toggle(key, label, description, onChange) {
  const input = h('input', { type: 'checkbox', checked: !!app.settings[key] });
  input.addEventListener('change', () => {
    setSetting(key, input.checked);
    onChange?.(input.checked);
  });
  return h('label.setting-row', {}, h('div.setting-text', {}, h('strong', {}, label), description && h('small', {}, description)), h('span.switch', {}, input, h('span.slider')));
}

function selectRow(key, label, description, options, { parse = (v) => v } = {}) {
  const sel = h('select.field', {}, options.map(([v, l]) => h('option', { value: v, selected: String(app.settings[key]) === String(v) }, l)));
  sel.addEventListener('change', () => setSetting(key, parse(sel.value)));
  return h('label.setting-row', {}, h('div.setting-text', {}, h('strong', {}, label), description && h('small', {}, description)), sel);
}

function card(title, ...rows) {
  return h('div.settings-card', {}, title && h('h3', {}, title), ...rows);
}

function renderGeneral(body) {
  body.append(
    h('h2', {}, 'General'),
    card(
      'Appearance',
      selectRow('theme', 'Theme', 'Choose how MooPress looks. "Match Windows" follows your system setting.', [
        ['system', 'Match Windows'],
        ['light', 'Light'],
        ['dark', 'Dark'],
      ]),
      toggle('ribbonCollapsed', 'Start with the ribbon collapsed', 'Gives you more room to write. Click any tab to open it.'),
      toggle('showPageGuides', 'Show page guides', 'Dashed lines showing roughly where each printed page ends.'),
    ),
    card(
      'Saving',
      toggle('autosave', 'Save automatically', 'Once your book has been saved to a file, MooPress keeps it saved for you.'),
      selectRow('autosaveMinutes', 'Autosave every', null, [[1, '1 minute'], [2, '2 minutes'], [3, '3 minutes'], [5, '5 minutes'], [10, '10 minutes']], { parse: Number }),
      folderRow(),
      h('p.settings-note', {}, icon('life-buoy'), 'Even before your first save, MooPress keeps a recovery copy so nothing is lost if the app closes unexpectedly.'),
    ),
    card(
      'Tutorial',
      h(
        'div.setting-row.tour-row',
        {},
        h('div.tour-row-icon', {}, icon('graduation-cap')),
        h(
          'div.setting-text',
          {},
          h('strong', {}, 'Take the MooPress tour'),
          h('small', {}, 'A two-minute guided tour of every feature: chapters, Story Settings, synonyms, snippets, the Time Machine, Zen mode, your Library and more.'),
        ),
        h('button.btn.primary', { onclick: () => { closeSettings(); startTour(); } }, icon('play'), 'Start tour'),
      ),
    ),
  );
}

function folderRow() {
  const pathEl = h('code.folder-path', {}, 'Loading…');
  saveFolder().then((p) => { pathEl.textContent = p; });
  const redraw = () => renderSettings();
  return h(
    'div.setting-row.folder-row',
    {},
    h(
      'div.setting-text',
      {},
      h('strong', {}, 'Default save location'),
      h('small', {}, 'New books are saved here, and the File tab shows every book in this folder.'),
      pathEl,
    ),
    h(
      'div.folder-actions',
      {},
      h('button.btn', { onclick: async () => { if (await changeSaveFolder()) redraw(); } }, icon('folder-cog'), 'Change…'),
      h('button.btn', { onclick: openSaveFolder }, icon('folder-open'), 'Open'),
      app.settings.saveFolder && h('button.btn', { onclick: () => { setSetting('saveFolder', ''); redraw(); toast('Back to the default save location.', 'success'); } }, 'Use default'),
    ),
  );
}

function renderWriting(body) {
  const langSel = h('select.field', {}, h('option', { value: '' }, 'Loading…'));
  window.moopress.spellLanguages().then(({ available, current }) => {
    const list = available?.length ? available : current || [];
    langSel.replaceChildren(...list.map((l) => h('option', { value: l, selected: (app.settings.spellLanguage || current?.[0]) === l }, languageName(l))));
    if (!list.length) langSel.append(h('option', { value: '' }, 'Windows default'));
  });
  langSel.addEventListener('change', async () => {
    const ok = await window.moopress.setSpellLanguage(langSel.value);
    if (ok) setSetting('spellLanguage', langSel.value);
    else toast('That language could not be enabled on this computer.', 'warn');
  });

  body.append(
    h('h2', {}, 'Writing & proofing'),
    card(
      'Spelling',
      toggle('spellcheck', 'Check spelling as I type', 'Misspelled words get a red underline. Right-click one for suggestions.'),
      h('label.setting-row', {}, h('div.setting-text', {}, h('strong', {}, 'Dictionary language')), langSel),
    ),
    card(
      'Grammar & style',
      toggle('grammarAsYouType', 'Mark grammar issues as I type', 'Likely grammar problems get a blue underline. Hover to see why.'),
      toggle('styleSuggestions', 'Include style suggestions', 'Also flag passive voice, very long sentences and filler words like "very".'),
    ),
    card(
      'Typing',
      toggle('smartQuotes', 'Smart quotes & dashes', 'Turns "quotes" into “curly quotes”, -- into an em dash and ... into an ellipsis. Takes effect after restarting MooPress.'),
    ),
  );
}

function renderTools(body) {
  body.append(
    h('h2', {}, 'Writing tools'),
    card(
      'While you write',
      toggle('typewriter', 'Typewriter scrolling', 'Keeps the line you are typing in the middle of the screen.'),
      toggle('focusPalette', 'Floating formatting palette', 'A faint toolbar near your cursor. It vanishes while you type.'),
      toggle('radialMenu', 'Radial right-click menu', 'Right-click shows a ring of tools around the pointer. Hold Shift for the classic menu.'),
    ),
    card(
      'Words & story',
      toggle('smartSynonyms', 'Smart synonyms on double-click', 'Double-click a word to see synonyms that fit its sentence.'),
      toggle('fluffDetector', 'Cliché & fluff detector', 'Highlights clichés, passive voice, filler and repeated words, with a readability score in the status bar.'),
      toggle('bibleHighlights', 'Underline Story Settings names', 'Hover an underlined name to see its card.'),
    ),
  );
}

function languageName(code) {
  try {
    return `${new Intl.DisplayNames(['en'], { type: 'language' }).of(code)} (${code})`;
  } catch {
    return code;
  }
}

function renderAbout(body) {
  body.append(
    h('h2', {}, 'About MooPress'),
    logoLockup('about-logo'),
    card(
      null,
      h('p', {}, 'MooPress is a word processor built for book authors: chapters, title pages, book page sizes, scene breaks and print-ready PDFs.'),
      h('p.settings-note', {}, icon('folder'), 'Books are saved as .moopress files. MooPress also opens and saves Word (.docx, .doc), PDF, OpenDocument (.odt), Rich Text (.rtf), plain text and Markdown files. Settings and recovery copies are stored in your Windows user profile.'),
      h('p', {}, h('small', {}, 'Version 0.1.0')),
    ),
  );
}

let shortcutFilter = '';

function renderShortcuts(body) {
  const search = h('input.field.search', { type: 'search', placeholder: 'Search commands or keys…', value: shortcutFilter });
  const list = h('div.shortcut-list');
  const draw = () => {
    list.replaceChildren();
    const q = shortcutFilter.trim().toLowerCase();
    for (const cat of CATEGORIES) {
      const rows = [...actions.values()]
        .filter((a) => a.category === cat)
        .filter((a) => !q || a.label.toLowerCase().includes(q) || formatCombo(bindingFor(a.id)).toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q));
      if (!rows.length) continue;
      list.append(h('h3.shortcut-cat', {}, cat), ...rows.map((a) => shortcutRow(a, draw)));
    }
    if (!list.children.length) list.append(h('p.empty', {}, 'No commands match your search.'));
    refreshIcons(list);
  };
  search.addEventListener('input', () => {
    shortcutFilter = search.value;
    draw();
  });

  body.append(
    h('h2', {}, 'Keyboard shortcuts'),
    h(
      'p.settings-lead',
      {},
      'Click a shortcut, then press the keys you want to use. Press ',
      h('kbd', {}, 'Esc'),
      ' to cancel or ',
      h('kbd', {}, 'Backspace'),
      ' to remove a shortcut. Every command in the ribbon can have one.',
    ),
    h(
      'div.shortcut-toolbar',
      {},
      search,
      h(
        'button.btn',
        {
          onclick: async () => {
            if (await confirmDialog('Reset all shortcuts?', 'Every keyboard shortcut will go back to its original setting.', { okLabel: 'Reset all', danger: true })) {
              resetAllBindings();
              draw();
              toast('All shortcuts were reset.', 'success');
            }
          },
        },
        icon('rotate-ccw'),
        'Reset all',
      ),
    ),
    list,
  );
  draw();
}

function shortcutRow(a, redraw) {
  const combo = bindingFor(a.id);
  const chip = h('button.key-chip', { 'aria-label': `Change shortcut for ${a.label}` }, combo ? formatCombo(combo) : h('span.unset', {}, 'Add shortcut'));
  const message = h('div.shortcut-msg');
  const row = h(
    'div.shortcut-row',
    {},
    h('div.shortcut-text', {}, h('strong', {}, a.label), a.description && h('small', {}, a.description)),
    h(
      'div.shortcut-keys',
      {},
      chip,
      isCustomized(a.id) &&
        h('button.icon-btn.small', { title: `Reset to default (${formatCombo(a.defaultKey) || 'none'})`, onclick: () => { resetBinding(a.id); redraw(); } }, icon('rotate-ccw')),
    ),
    message,
  );
  chip.addEventListener('click', () => record(a, chip, message, row, redraw));
  return row;
}

function record(a, chip, message, row, redraw) {
  if (document.querySelector('.recording')) return;
  const resume = suspendShortcuts();
  row.classList.add('recording');
  chip.textContent = 'Press a shortcut…';
  message.replaceChildren();

  const stop = () => {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('mousedown', onClickAway, true);
    row.classList.remove('recording');
    resume();
  };
  const onClickAway = (e) => {
    if (!row.contains(e.target)) {
      stop();
      redraw();
    }
  };
  const onKey = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const plain = !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;
    if (plain && e.key === 'Escape') {
      stop();
      redraw();
      return;
    }
    if (plain && (e.key === 'Backspace' || e.key === 'Delete')) {
      stop();
      setBinding(a.id, '');
      redraw();
      return;
    }
    const combo = comboFromEvent(e);
    if (!combo) return;
    chip.textContent = formatCombo(combo);
    const problem = shortcutProblem(combo);
    if (problem) {
      message.replaceChildren(h('span.warn', {}, icon('alert-circle'), problem, ' Try another combination.'));
      refreshIcons(message);
      return;
    }
    const owner = actionForCombo(combo, a.id);
    stop();
    if (!owner) {
      setBinding(a.id, combo);
      redraw();
      toast(`“${a.label}” is now ${formatCombo(combo)}.`, 'success');
      return;
    }
    message.replaceChildren(
      h('span.warn', {}, icon('alert-circle'), `${formatCombo(combo)} is already used by “${owner.label}”.`),
      h('button.btn.small.primary', { onclick: () => { setBinding(a.id, combo); redraw(); toast(`“${owner.label}” no longer has a shortcut.`, 'info'); } }, 'Use it here instead'),
      h('button.btn.small', { onclick: () => redraw() }, 'Cancel'),
    );
    refreshIcons(message);
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('mousedown', onClickAway, true);
}
