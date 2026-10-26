import { app, h, icon, on, emit, markDirty, debounce } from '../app.js';
import { uid } from '../project.js';
import { eachTextblock, bibleKey, setHighlights, escapeRegExp } from '../extensions/decorations.js';
import { openDialog, confirmDialog, field, refreshIcons, toast } from '../ui.js';
import { setSetting } from '../settings.js';

export const TYPES = {
  character: { label: 'Character', icon: 'user-round' },
  place: { label: 'Place', icon: 'map-pin' },
  term: { label: 'Term or object', icon: 'sparkles' },
  other: { label: 'Other', icon: 'bookmark' },
};

const entries = () => app.project.bible;

function namesOf(e) {
  return [e.name, ...(e.aliases || [])].map((n) => n.trim()).filter((n) => n.length > 1);
}

export function isBibleWord(word) {
  const w = word.toLowerCase();
  return (app.project?.bible || []).some((e) => namesOf(e).some((n) => n.toLowerCase().split(/[\s-]+/).includes(w)));
}

function buildMatchers() {
  const exact = new Map();
  const loose = new Map();
  for (const e of entries()) {
    for (const n of namesOf(e)) {
      if (/\p{Lu}/u.test(n)) exact.set(n, e);
      else loose.set(n.toLowerCase(), e);
    }
  }
  const re = (names, flags) => {
    if (!names.length) return null;
    const alt = names.sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');
    return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt})(?![\\p{L}\\p{N}])`, flags);
  };
  return { exact, loose, exactRe: re([...exact.keys()], 'gu'), looseRe: re([...loose.keys()], 'giu') };
}

function refresh() {
  const { editor } = app;
  if (!editor || !app.view || app.view === 'title') return;
  const marks = [];
  if (app.settings.bibleHighlights && entries().length) {
    const m = buildMatchers();
    eachTextblock(editor.state.doc, (text, start) => {
      for (const [re, map, norm] of [[m.exactRe, m.exact, (s) => s], [m.looseRe, m.loose, (s) => s.toLowerCase()]]) {
        if (!re) continue;
        for (const hit of text.matchAll(re)) {
          const e = map.get(norm(hit[0]));
          if (e) marks.push({ from: start + hit.index, to: start + hit.index + hit[0].length, class: `bible-term bible-${e.type}`, attrs: { 'data-bible': e.id } });
        }
      }
    });
  }
  setHighlights(editor, bibleKey, marks);
}

const scheduleRefresh = debounce(refresh, 300);

let card = null;
let showTimer = null;
let hideTimer = null;

function hideCard() {
  clearTimeout(showTimer);
  hideTimer = setTimeout(() => { card?.remove(); card = null; }, 200);
}

function showCard(target) {
  const e = entries().find((x) => x.id === target.dataset.bible);
  if (!e) return;
  clearTimeout(hideTimer);
  card?.remove();
  const t = TYPES[e.type] || TYPES.other;
  card = h(
    `div.bible-card.bible-${e.type}`,
    { onmouseenter: () => clearTimeout(hideTimer), onmouseleave: hideCard },
    e.image && h('img.bible-pic', { src: e.image, alt: e.name }),
    h(
      'div.bible-body',
      {},
      h('div.bible-type', {}, icon(t.icon), t.label),
      h('div.bible-name', {}, e.name),
      e.aliases?.length > 0 && h('div.bible-aliases', {}, `Also: ${e.aliases.join(', ')}`),
      h('div.bible-notes', {}, e.notes || h('span.muted', {}, 'No notes yet.')),
      h('button.btn.small', { onclick: () => { card?.remove(); card = null; editEntry(e); } }, icon('pencil'), 'Edit'),
    ),
  );
  document.body.append(card);
  refreshIcons(card);
  const r = target.getBoundingClientRect();
  const left = Math.max(8, Math.min(r.left, window.innerWidth - card.offsetWidth - 8));
  let top = r.bottom + 8;
  if (top + card.offsetHeight > window.innerHeight - 8) top = r.top - card.offsetHeight - 8;
  Object.assign(card.style, { left: `${left}px`, top: `${top}px` });
  requestAnimationFrame(() => card?.classList.add('show'));
}

export function initBible() {
  const dom = app.editor.view.dom;
  dom.addEventListener('mouseover', (e) => {
    const t = e.target.closest?.('.bible-term');
    if (!t) return;
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    showTimer = setTimeout(() => showCard(t), 350);
  });
  dom.addEventListener('mouseout', (e) => {
    if (e.target.closest?.('.bible-term')) hideCard();
  });
  window.addEventListener('keydown', () => { clearTimeout(showTimer); if (card) hideCard(); }, true);
  on('doc-changed', scheduleRefresh);
  on('view-changed', refresh);
  on('project-loaded', refresh);
  on('bible-changed', refresh);
  on('settings-changed', (key) => { if (key === 'bibleHighlights') refresh(); });
}

function shrinkImage(dataUrl, max = 480) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/webp', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function editEntry(existing, prefillName = '') {
  const e = existing ? { ...existing } : { id: uid(), name: prefillName, aliases: [], type: 'character', image: null, notes: '' };
  const name = h('input.field', { value: e.name, placeholder: 'e.g. Elara Vance', autofocus: true });
  const aliases = h('input.field', { value: (e.aliases || []).join(', '), placeholder: 'e.g. Elara, Captain Vance, the Keeper' });
  const type = h('select.field', {}, Object.entries(TYPES).map(([k, t]) => h('option', { value: k, selected: e.type === k }, t.label)));
  const notes = h('textarea.field.bible-notes-input', { value: e.notes || '', rows: 7, placeholder: 'Appearance, personality, history, how they speak, what they want…' });
  const pic = h('div.bible-pic-edit');
  const drawPic = () => {
    pic.replaceChildren(
      e.image ? h('img', { src: e.image, alt: '' }) : h('div.bible-pic-empty', {}, icon(TYPES[type.value]?.icon || 'user-round')),
      h(
        'div.bible-pic-actions',
        {},
        h('button.btn.small', { type: 'button', onclick: async () => { const r = await window.moopress.pickImage(); if (r) { e.image = await shrinkImage(r.dataUrl); drawPic(); } } }, icon('image'), e.image ? 'Change picture' : 'Add picture'),
        e.image && h('button.btn.small', { type: 'button', onclick: () => { e.image = null; drawPic(); } }, 'Remove'),
      ),
    );
    refreshIcons(pic);
  };
  type.addEventListener('change', drawPic);
  drawPic();

  const buttons = [{ label: 'Cancel', value: null }];
  if (existing) buttons.unshift({ label: 'Delete', value: 'delete', danger: true });
  buttons.push({ label: existing ? 'Save' : 'Add to Story Settings', value: 'save', primary: true });
  const r = await openDialog({
    title: existing ? `Edit ${existing.name}` : 'New Story Settings entry',
    width: 620,
    className: 'bible-dialog',
    body: h(
      'div.bible-form',
      {},
      pic,
      h(
        'div',
        {},
        field('Name', name),
        field('Also known as', aliases, 'Separate nicknames or other spellings with commas. They’ll be recognised too.'),
        field('Type', type),
        field('Notes', notes),
      ),
    ),
    buttons,
    validate: (v) => {
      if (v === 'save' && !name.value.trim()) {
        name.focus();
        toast('Give the entry a name first.', 'warn');
        return false;
      }
      return true;
    },
  });
  if (r === 'delete') {
    if (await confirmDialog('Delete this entry?', `“${existing.name}” will be removed from your Story Settings. Your manuscript isn’t changed.`, { okLabel: 'Delete', danger: true })) {
      app.project.bible = entries().filter((x) => x.id !== existing.id);
      markDirty();
      emit('bible-changed');
    }
    return;
  }
  if (r !== 'save') return;
  Object.assign(e, {
    name: name.value.trim(),
    aliases: aliases.value.split(',').map((a) => a.trim()).filter(Boolean),
    type: type.value,
    notes: notes.value.trim(),
  });
  const list = entries();
  const i = list.findIndex((x) => x.id === e.id);
  if (i >= 0) list[i] = e;
  else list.push(e);
  list.sort((a, b) => a.name.localeCompare(b.name));
  markDirty();
  emit('bible-changed');
  if (!existing) toast(`“${e.name}” added. Hover the name in your text to see the card.`, 'success');
}

export function addEntryFromSelection() {
  const { editor } = app;
  let name = '';
  if (editor && app.view !== 'title') {
    const { from, to } = editor.state.selection;
    name = editor.state.doc.textBetween(from, to, ' ').trim().slice(0, 60);
  }
  const existing = entries().find((x) => namesOf(x).some((n) => n.toLowerCase() === name.toLowerCase()));
  return editEntry(existing || null, name);
}

export function toggleBibleHighlights() {
  setSetting('bibleHighlights', !app.settings.bibleHighlights);
}

export function bibleSection() {
  const list = entries();
  return h(
    'div.sb-bible',
    {},
    h('div.sb-section', {}, h('span', {}, 'Story Settings'), h('button.icon-btn.small', { 'data-action': 'addBibleEntry', 'aria-label': 'Add to Story Settings' }, icon('plus'))),
    list.length
      ? h(
          'ul.bible-list',
          {},
          list.map((e) =>
            h(
              'li',
              {},
              h(
                'button.sb-item.bible-item',
                { onclick: () => editEntry(e), title: e.notes || e.name },
                e.image ? h('img.bible-thumb', { src: e.image, alt: '' }) : h('span.sb-icon', {}, icon((TYPES[e.type] || TYPES.other).icon)),
                h('span.sb-text', {}, h('strong', {}, e.name), h('small', {}, e.aliases?.length ? e.aliases.join(', ') : (TYPES[e.type] || TYPES.other).label)),
              ),
            ),
          ),
        )
      : h('p.sb-empty', {}, 'Add characters, places and terms. Hover their names in your writing to see your notes.'),
  );
}
