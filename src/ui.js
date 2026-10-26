import { createIcons, icons } from 'lucide';
import { h, icon } from './app.js';

export function refreshIcons(root = document) {
  createIcons({ icons, attrs: { 'stroke-width': 1.75 }, root });
}

export function toast(message, type = 'info', ms = 3200) {
  const names = { info: 'info', success: 'check-circle-2', error: 'alert-triangle', warn: 'alert-circle' };
  const el = h(`div.toast.toast-${type}`, {}, icon(names[type] || 'info'), h('span', {}, message));
  document.getElementById('toasts').append(el);
  refreshIcons(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

export function openDialog({ title, body, buttons = [{ label: 'OK', value: true, primary: true }], width = 460, onOpen, validate, className = '' }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const previousFocus = document.activeElement;
    const content = typeof body === 'string' ? h('div', { html: body }) : body;

    const close = (value) => {
      overlay.classList.remove('show');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(() => overlay.remove(), 160);
      previousFocus?.focus?.();
      resolve(value);
    };
    const choose = async (b) => {
      if (b.value != null && b.value !== false && validate) {
        const ok = await validate(b.value);
        if (!ok) return;
      }
      close(b.value ?? null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(null);
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLButtonElement)) {
        const primary = buttons.find((b) => b.primary);
        if (primary) {
          e.preventDefault();
          e.stopPropagation();
          choose(primary);
        }
      }
    };

    const footer = h(
      'div.dialog-footer',
      {},
      buttons.map((b) => h(`button.btn${b.primary ? '.primary' : ''}${b.danger ? '.danger' : ''}`, { onclick: () => choose(b) }, b.label)),
    );
    const dialog = h(
      `div.dialog${className ? `.${className}` : ''}`,
      { role: 'dialog', 'aria-modal': 'true', 'aria-label': title, style: { width: `${width}px` } },
      h('div.dialog-header', {}, h('h2', {}, title), h('button.icon-btn', { onclick: () => close(null), 'aria-label': 'Close' }, icon('x'))),
      h('div.dialog-body', {}, content),
      footer,
    );
    const overlay = h('div.modal-overlay', { onmousedown: (e) => e.target === overlay && close(null) }, dialog);
    root.append(overlay);
    refreshIcons(overlay);
    document.addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => {
      overlay.classList.add('show');
      const first = dialog.querySelector('[autofocus], input, select, textarea, .dialog-footer .primary');
      first?.focus();
      first?.select?.();
    });
    onOpen?.(dialog, close);
  });
}

export async function confirmDialog(title, message, { okLabel = 'OK', cancelLabel = 'Cancel', danger = false } = {}) {
  const r = await openDialog({
    title,
    body: h('p.dialog-text', {}, message),
    buttons: [
      { label: cancelLabel, value: null },
      { label: okLabel, value: true, primary: true, danger },
    ],
  });
  return r === true;
}

export async function promptDialog(title, label, value = '', placeholder = '') {
  const input = h('input.field', { value, placeholder, autofocus: true });
  const r = await openDialog({
    title,
    body: h('label.form-row', {}, h('span', {}, label), input),
    buttons: [
      { label: 'Cancel', value: null },
      { label: 'OK', value: 'ok', primary: true },
    ],
  });
  return r ? input.value : null;
}

export function field(label, control, hint) {
  return h('label.form-row', {}, h('span', {}, label), control, hint && h('small.hint', {}, hint));
}

let openPopover = null;

export function closePopover() {
  if (!openPopover) return;
  openPopover.el.remove();
  openPopover.anchor?.classList.remove('open');
  document.removeEventListener('mousedown', openPopover.outside, true);
  document.removeEventListener('keydown', openPopover.key, true);
  openPopover = null;
}

export function popover(anchor, content, { align = 'start', className = '' } = {}) {
  if (openPopover?.anchor === anchor) {
    closePopover();
    return null;
  }
  closePopover();
  const el = h(`div.popover${className ? `.${className}` : ''}`, { role: 'menu' });
  el.append(Array.isArray(content) ? menuList(content) : content);
  document.getElementById('popover-root').append(el);
  refreshIcons(el);

  const r = anchor.getBoundingClientRect();
  const pw = el.offsetWidth;
  const ph = el.offsetHeight;
  let left = align === 'end' ? r.right - pw : r.left;
  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  let top = r.bottom + 4;
  if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 4);
  Object.assign(el.style, { left: `${left}px`, top: `${top}px` });
  anchor.classList.add('open');

  const outside = (e) => {
    if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover();
  };
  const key = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closePopover();
      anchor.focus?.();
    }
  };
  document.addEventListener('mousedown', outside, true);
  document.addEventListener('keydown', key, true);
  openPopover = { el, anchor, outside, key };
  el.querySelector('button:not([disabled]), input')?.focus({ preventScroll: true });
  return el;
}

function menuList(items) {
  const list = h('div.menu');
  for (const it of items) {
    if (it === 'separator') list.append(h('div.menu-sep'));
    else if (it.heading) list.append(h('div.menu-heading', {}, it.heading));
    else {
      list.append(
        h(
          `button.menu-item${it.checked ? '.checked' : ''}`,
          {
            role: 'menuitem',
            disabled: it.disabled,
            onclick: () => {
              closePopover();
              it.onClick?.();
            },
          },
          h('span.menu-icon', {}, it.checked ? icon('check') : it.icon ? icon(it.icon) : null),
          h('span.menu-label', { style: it.style }, it.label),
          it.detail && h('span.menu-detail', {}, it.detail),
        ),
      );
    }
  }
  list.addEventListener('keydown', (e) => {
    const buttons = [...list.querySelectorAll('.menu-item:not([disabled])')];
    const i = buttons.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') buttons[(i + 1) % buttons.length]?.focus();
    else if (e.key === 'ArrowUp') buttons[(i - 1 + buttons.length) % buttons.length]?.focus();
    else return;
    e.preventDefault();
  });
  return list;
}

const PALETTE = [
  ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#d9d9d9', '#efefef', '#ffffff'],
  ['#7f1d1d', '#b91c1c', '#c2410c', '#b45309', '#15803d', '#0f766e', '#1d4ed8', '#6d28d9'],
  ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#a855f7'],
  ['#fecaca', '#fed7aa', '#fde68a', '#fef08a', '#bbf7d0', '#99f6e4', '#bfdbfe', '#e9d5ff'],
];

export function colorPicker({ onPick, noneLabel = 'Automatic', recentKey }) {
  const wrap = h('div.color-picker');
  wrap.append(
    h('button.color-none', { onclick: () => { closePopover(); onPick(null); } }, h('span.swatch.none'), noneLabel),
  );
  const grid = h('div.color-grid');
  for (const row of PALETTE) {
    for (const c of row) {
      grid.append(h('button.swatch', { style: { background: c }, title: c, 'aria-label': c, onclick: () => { closePopover(); onPick(c); } }));
    }
  }
  wrap.append(grid);
  const custom = h('input', { type: 'color', value: localStorage.getItem(recentKey) || '#2f6fdb' });
  custom.addEventListener('change', () => {
    try { localStorage.setItem(recentKey, custom.value); } catch {}
    closePopover();
    onPick(custom.value);
  });
  wrap.append(h('label.color-custom', {}, icon('palette'), 'More colours…', custom));
  return wrap;
}

export function initTooltips(resolver) {
  const tip = document.getElementById('tooltip');
  let timer = null;
  let target = null;

  const hide = () => {
    clearTimeout(timer);
    tip.hidden = true;
    target = null;
  };

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest?.('[data-tip], [data-action]');
    if (el === target) return;
    hide();
    if (!el || el.closest('.popover, .settings-page')) return;
    target = el;
    timer = setTimeout(() => {
      const info = resolver(el) || { title: el.dataset.tip };
      if (!info?.title || !document.body.contains(el)) return;
      tip.replaceChildren(
        h('div.tip-title', {}, info.title, info.shortcut && h('kbd', {}, info.shortcut)),
        info.description && h('div.tip-desc', {}, info.description),
      );
      tip.hidden = false;
      const r = el.getBoundingClientRect();
      const left = Math.max(8, Math.min(r.left + r.width / 2 - tip.offsetWidth / 2, window.innerWidth - tip.offsetWidth - 8));
      let top = r.bottom + 8;
      if (top + tip.offsetHeight > window.innerHeight - 8) top = r.top - tip.offsetHeight - 8;
      Object.assign(tip.style, { left: `${left}px`, top: `${top}px` });
    }, 450);
  });
  document.addEventListener('mousedown', hide, true);
  document.addEventListener('keydown', hide, true);
  window.addEventListener('blur', hide);
}
