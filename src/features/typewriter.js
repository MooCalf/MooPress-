import { app, on } from '../app.js';
import { setSetting } from '../settings.js';

let lastKey = 0;

function centreCaret() {
  const { editor } = app;
  if (!app.settings.typewriter || !editor || !app.view || app.view === 'title' || !editor.isFocused) return;
  if (Date.now() - lastKey > 400) return;
  const canvas = document.getElementById('canvas');
  try {
    const { top, bottom } = editor.view.coordsAtPos(editor.state.selection.head);
    const box = canvas.getBoundingClientRect();
    const delta = (top + bottom) / 2 - (box.top + box.height / 2);
    if (Math.abs(delta) > 2) canvas.scrollTop += delta;
  } catch {
  }
}

export function applyTypewriter() {
  document.body.classList.toggle('typewriter', !!app.settings.typewriter);
}

export function toggleTypewriter() {
  setSetting('typewriter', !app.settings.typewriter);
}

for (const type of ['keydown', 'beforeinput']) window.addEventListener(type, () => { lastKey = Date.now(); }, true);
on('transaction', centreCaret);
on('settings-changed', (key) => {
  if (key !== 'typewriter') return;
  applyTypewriter();
  if (app.settings.typewriter) {
    lastKey = Date.now();
    requestAnimationFrame(centreCaret);
  }
});
