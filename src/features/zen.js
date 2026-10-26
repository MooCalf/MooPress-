import { app, h, emit } from '../app.js';
import { schedulePageGuides } from '../layout.js';
import { bindingFor, formatCombo } from '../keybinds.js';

let hintTimer = null;

export function isZen() {
  return document.body.classList.contains('zen');
}

export function toggleZen(force) {
  const on = force ?? !isZen();
  document.body.classList.toggle('zen', on);
  document.body.classList.remove('focus-mode');
  window.moopress.setFullScreen(on);
  if (app.editor) app.editor.view.dom.spellcheck = on ? false : app.settings.spellcheck;
  document.getElementById('zen-hint')?.remove();
  clearTimeout(hintTimer);
  if (on) {
    const key = formatCombo(bindingFor('zenMode'));
    const hint = h('div', { id: 'zen-hint' }, `Press Esc${key ? ` or ${key}` : ''} to leave Zen mode`);
    document.body.append(hint);
    hintTimer = setTimeout(() => hint.classList.add('gone'), 2200);
    if (app.view === 'title' && app.project.chapters[0]) import('../editor.js').then((m) => m.openView(app.project.chapters[0].id));
    setTimeout(() => app.editor?.commands.focus(), 50);
  }
  emit('zen-changed');
  schedulePageGuides();
}

window.addEventListener('keydown', (e) => {
  if (!isZen()) return;
  if (e.key === 'Escape' && !document.querySelector('.modal-overlay, .popover')) {
    toggleZen(false);
    return;
  }
  document.body.classList.add('zen-typing');
}, true);
window.addEventListener('mousemove', () => document.body.classList.remove('zen-typing'));
