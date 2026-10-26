import { app, h, icon, on } from '../app.js';
import { refreshIcons } from '../ui.js';
import { TOOLS, moreMenu } from './tools.js';

let el = null;
let idleTimer = null;
let hovering = false;
let docked = false;

function build() {
  const more = h('button.fp-btn.fp-more', { 'aria-label': 'More tools', 'data-tip': 'More tools', style: { '--i': 8 } }, icon('more-horizontal'));
  more.addEventListener('click', () => moreMenu(more));
  el = h(
    'div.focus-palette',
    { role: 'toolbar', 'aria-label': 'Quick tools' },
    TOOLS.map(([id, iconName], i) => h('button.fp-btn', { 'data-action': id, 'data-tool': i, style: { '--i': i } }, icon(iconName))),
    more,
  );
  el.addEventListener('mousedown', (e) => e.preventDefault());
  el.addEventListener('mouseenter', () => { hovering = true; el.classList.add('hover'); });
  el.addEventListener('mouseleave', () => { hovering = false; el.classList.remove('hover'); });
  document.body.append(el);
  refreshIcons(el);
}

function hide() {
  clearTimeout(idleTimer);
  el?.classList.remove('show', 'ghost');
}

function canShow() {
  const { editor } = app;
  return app.settings.focusPalette && editor && app.view && app.view !== 'title' && editor.isFocused && !docked &&
    !document.body.classList.contains('zen') && !document.body.classList.contains('time-machine') &&
    !document.querySelector('.modal-overlay, .syn-pop, .snippet-menu') && !editor.state.selection.node;
}

function place() {
  const { editor } = app;
  const { from, to, empty } = editor.state.selection;
  const a = editor.view.coordsAtPos(from);
  const b = empty ? a : editor.view.coordsAtPos(to);
  const width = el.offsetWidth;
  const centre = empty ? a.left + 40 : (Math.min(a.left, b.left) + Math.max(a.right, b.right)) / 2;
  const left = Math.max(8, Math.min(centre - width / 2, window.innerWidth - width - 8));
  let top = a.top - el.offsetHeight - 12;
  const canvasTop = document.getElementById('canvas').getBoundingClientRect().top;
  if (top < canvasTop + 4) top = b.bottom + 12;
  Object.assign(el.style, { left: `${left}px`, top: `${top}px` });
}

function show(ghost) {
  if (!canShow()) return hide();
  if (!el) build();
  place();
  el.classList.add('show');
  el.classList.toggle('ghost', ghost);
}

function onSelection() {
  if (!app.editor || docked) return;
  clearTimeout(idleTimer);
  if (!canShow()) return hide();
  if (!app.editor.state.selection.empty) {
    show(false);
  } else if (!hovering) {
    el?.classList.remove('show');
    idleTimer = setTimeout(() => show(true), 1400);
  }
}

export function measurePalette() {
  if (!el) build();
  place();
  const centreOf = (b) => {
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width };
  };
  return { slots: [...el.querySelectorAll('[data-tool]')].map(centreOf), more: centreOf(el.querySelector('.fp-more')) };
}

export function dockPalette() {
  if (!app.settings.focusPalette || document.body.classList.contains('zen')) return null;
  if (!el) build();
  clearTimeout(idleTimer);
  const opacity = el.classList.contains('show') ? Number(getComputedStyle(el).opacity) : 0;
  const { slots, more } = measurePalette();
  docked = { wasShowing: el.classList.contains('show'), wasGhost: el.classList.contains('ghost') };
  el.classList.add('docked');
  return { slots, more, opacity };
}

export function undockPalette() {
  if (!docked || !el) return;
  const { wasShowing, wasGhost } = docked;
  docked = false;
  el.classList.remove('docked');
  if (wasShowing && canShow()) {
    el.classList.add('instant');
    show(wasGhost && app.editor.state.selection.empty);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('instant')));
  } else {
    onSelection();
  }
}

export function initFocusPalette() {
  window.addEventListener('keydown', (e) => {
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key) || docked) return;
    hide();
    if (app.editor?.isFocused) idleTimer = setTimeout(onSelection, 1400);
  }, true);
  app.editor.on('blur', () => setTimeout(() => { if (!hovering && !docked) hide(); }, 120));
  document.getElementById('canvas').addEventListener('scroll', () => { if (el?.classList.contains('show')) place(); });
  on('selection-changed', onSelection);
  on('settings-changed', (key) => { if (key === 'focusPalette') onSelection(); });
  on('zen-changed', hide);
}
