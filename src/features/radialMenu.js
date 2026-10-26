import { TextSelection } from '@tiptap/pm/state';
import { app, h, icon } from '../app.js';
import { actions, runAction, bindingFor, formatCombo } from '../keybinds.js';
import { blockText } from '../extensions/decorations.js';
import { getSpeller, normalizeWord, suggestionsFor, rememberWord } from '../spelling.js';
import { closePopover, refreshIcons, toast } from '../ui.js';
import { isBibleWord } from './bible.js';
import { TOOLS, moreMenu } from './tools.js';
import { dockPalette, undockPalette, measurePalette } from './focusPalette.js';

const RADIUS = 86;
const ITEM_SIZE = 46;
const RETURN_MS = 250;

let menu = null;

export function closeRadial() {
  if (!menu) return;
  const { el, docked, cx, cy } = menu;
  if (docked) {
    const { slots, more } = measurePalette();
    el.querySelectorAll('.radial-item').forEach((b, i) => {
      b.style.setProperty('--sx', `${slots[i].x - cx}px`);
      b.style.setProperty('--sy', `${slots[i].y - cy}px`);
    });
    const c = el.querySelector('.radial-centre');
    c.style.setProperty('--sx', `${more.x - cx}px`);
    c.style.setProperty('--sy', `${more.y - cy}px`);
  }
  el.classList.remove('show');
  el.classList.add('closing');
  setTimeout(() => {
    el.remove();
    if (docked) undockPalette();
  }, RETURN_MS);
  document.removeEventListener('mousedown', menu.outside, true);
  document.removeEventListener('keydown', menu.key, true);
  window.removeEventListener('blur', closeRadial);
  menu = null;
}

function wordAt(pos) {
  const $p = app.editor.state.doc.resolve(pos);
  if (!$p.parent.isTextblock) return null;
  const text = blockText($p.parent);
  let s = $p.parentOffset;
  let e = s;
  while (s > 0 && /[\p{L}'’]/u.test(text[s - 1])) s--;
  while (e < text.length && /[\p{L}'’]/u.test(text[e])) e++;
  const word = text.slice(s, e).replace(/['’]+$/, '');
  if (!word || !/^\p{L}/u.test(word)) return null;
  return { word, from: $p.start() + s, to: $p.start() + s + word.length };
}

function startVars(slot, cx, cy, opacity, size) {
  if (!slot) return { '--sx': '0px', '--sy': '0px', '--ss': 0.4, '--so': 0 };
  return { '--sx': `${slot.x - cx}px`, '--sy': `${slot.y - cy}px`, '--ss': slot.size / size, '--so': opacity };
}

function open(x, y, clickPos, dock) {
  closeRadial();
  const size = (RADIUS + 34) * 2;
  const cx = Math.max(size / 2 + 4, Math.min(x, window.innerWidth - size / 2 - 4));
  const cy = Math.max(size / 2 + 4, Math.min(y, window.innerHeight - size / 2 - 4));
  const label = h('div.radial-label', {}, 'Right-click menu');
  const centre = h('button.radial-centre', { 'aria-label': 'More options', style: startVars(dock?.more, cx, cy, dock?.opacity ?? 0, 38) }, icon('more-horizontal'));
  const el = h('div.radial-menu', { role: 'menu' }, label, centre);
  TOOLS.forEach(([id, iconName], i) => {
    const a = actions.get(id);
    const angle = (i / TOOLS.length) * Math.PI * 2 - Math.PI / 2;
    const btn = h(
      'button.radial-item',
      {
        'aria-label': a.label,
        style: {
          '--x': `${Math.cos(angle) * RADIUS}px`,
          '--y': `${Math.sin(angle) * RADIUS}px`,
          '--i': i,
          ...startVars(dock?.slots[i], cx, cy, dock?.opacity ?? 0, ITEM_SIZE),
        },
      },
      icon(iconName),
    );
    if (a.isActive?.()) btn.classList.add('active');
    btn.addEventListener('mouseenter', () => { label.textContent = a.label; const k = formatCombo(bindingFor(id)); if (k) label.append(h('kbd', {}, k)); });
    btn.addEventListener('click', () => { closeRadial(); runAction(id); });
    el.append(btn);
  });
  centre.addEventListener('mouseenter', () => { label.textContent = 'More…'; });
  centre.addEventListener('click', () => moreMenu(centre, closeRadial));
  el.addEventListener('mouseleave', () => { label.textContent = 'Right-click menu'; });

  Object.assign(el.style, { left: `${cx}px`, top: `${cy}px` });
  el.addEventListener('mousedown', (e) => e.preventDefault());
  document.body.append(el);
  refreshIcons(el);
  void el.offsetWidth;
  el.classList.add('show');

  const outside = (e) => {
    if (el.contains(e.target) || e.target.closest?.('.popover')) return;
    closeRadial();
  };
  const key = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closePopover();
      closeRadial();
    }
  };
  document.addEventListener('mousedown', outside, true);
  document.addEventListener('keydown', key, true);
  window.addEventListener('blur', closeRadial);
  menu = { el, outside, key, docked: !!dock, cx, cy };
  addSpelling(el, clickPos);
}

async function addSpelling(el, pos) {
  if (pos == null || !app.settings.spellcheck) return;
  const w = wordAt(pos);
  if (!w || w.word.length < 2 || isBibleWord(w.word)) return;
  const speller = await getSpeller();
  if (!menu || menu.el !== el || speller.correct(normalizeWord(w.word))) return;
  const list = await suggestionsFor(w.word);
  if (!menu || menu.el !== el) return;
  const replace = (s) => {
    closeRadial();
    const { state, view } = app.editor;
    if (state.doc.textBetween(w.from, w.to) !== w.word) return;
    view.dispatch(state.tr.insertText(s, w.from, w.to));
    view.focus();
  };
  el.append(
    h(
      'div.radial-spelling',
      {},
      h('span.radial-spell-label', {}, `“${w.word}”`),
      list.length ? list.slice(0, 4).map((s) => h('button.syn-chip', { onclick: () => replace(s) }, s)) : h('span.muted', {}, 'No suggestions'),
      h('button.syn-chip.subtle', { onclick: async () => { closeRadial(); await window.moopress.addWord(w.word); await rememberWord(w.word); toast(`“${w.word}” added to your dictionary.`, 'success'); } }, '+ Dictionary'),
    ),
  );
}

export function initRadialMenu() {
  document.getElementById('paper').addEventListener('contextmenu', (e) => {
    if (!app.settings.radialMenu || e.shiftKey || !app.editor.view.dom.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    const dock = menu ? null : dockPalette();
    const { view, state } = app.editor;
    const hit = view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (hit && (hit.pos < state.selection.from || hit.pos > state.selection.to)) {
      view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(hit.pos))));
    }
    view.focus();
    open(e.clientX, e.clientY, hit?.pos, dock);
  });
}
