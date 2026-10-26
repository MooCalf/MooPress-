import { h, icon, emit } from './app.js';
import { refreshIcons } from './ui.js';

let current = null;

export function showPanel(id, title, content, { onClose } = {}) {
  const panel = document.getElementById('side-panel');
  current?.onClose?.();
  current = { id, onClose };
  panel.replaceChildren(
    h('div.panel-header', {}, h('h2', {}, title), h('button.icon-btn', { 'aria-label': 'Close panel', onclick: closePanel }, icon('x'))),
    h('div.panel-body', {}, content),
  );
  panel.hidden = false;
  refreshIcons(panel);
  emit('panel-changed');
}

export function closePanel() {
  const panel = document.getElementById('side-panel');
  current?.onClose?.();
  current = null;
  panel.hidden = true;
  panel.replaceChildren();
  emit('panel-changed');
}

export function panelOpen(id) {
  return current?.id === id;
}
