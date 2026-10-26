import { app, emit } from './app.js';
import { saveSettings } from './settings.js';
import { toast } from './ui.js';

export const actions = new Map();

export const CATEGORIES = ['File', 'Clipboard & history', 'Text formatting', 'Paragraph', 'Insert', 'Layout', 'Navigation', 'Review & tools', 'View'];

export function defineAction(def) {
  actions.set(def.id, { scope: 'editor', defaultKey: '', ...def });
}

export function runAction(id) {
  const a = actions.get(id);
  if (!a) return;
  if (a.isEnabled && !a.isEnabled()) return;
  try {
    const r = a.run();
    if (r instanceof Promise) r.catch(reportError);
  } catch (err) {
    reportError(err);
  }
}

function reportError(err) {
  console.error(err);
  toast(`Something went wrong: ${err.message || err}`, 'error', 5000);
}

const CODE_NAMES = {
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'",
  Comma: ',', Period: '.', Slash: '/', Backquote: '`', Space: 'Space', Enter: 'Enter', NumpadEnter: 'Enter',
  Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End',
  PageUp: 'PageUp', PageDown: 'PageDown', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Escape: 'Esc', NumpadAdd: 'NumPlus', NumpadSubtract: 'NumMinus', NumpadMultiply: 'NumStar', NumpadDivide: 'NumSlash',
  NumpadDecimal: 'NumDot',
};
const MODIFIER_CODES = new Set(['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'CapsLock']);

export function comboFromEvent(e) {
  if (MODIFIER_CODES.has(e.code) || !e.code) return null;
  let key;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5);
  else if (/^Numpad\d$/.test(e.code)) key = `Num${e.code.slice(6)}`;
  else if (/^F\d{1,2}$/.test(e.code)) key = e.code;
  else key = CODE_NAMES[e.code] || (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Win');
  parts.push(key);
  return parts.join('+');
}

export function formatCombo(combo) {
  return combo ? combo.split('+').join(' + ') : '';
}

export function shortcutProblem(combo) {
  const parts = combo.split('+');
  const key = parts[parts.length - 1];
  const hasMod = parts.some((p) => p === 'Ctrl' || p === 'Alt' || p === 'Win');
  if (!hasMod && !/^F\d+$/.test(key)) return 'Shortcuts need Ctrl, Alt or a function key (F1–F12) so they don’t interfere with typing.';
  if (combo === 'Alt+F4') return 'Alt + F4 is reserved by Windows for closing the app.';
  if (parts[0] === 'Win') return 'Windows-key shortcuts are reserved by Windows.';
  return null;
}

let keymap = new Map();

export function bindingFor(id) {
  const overrides = app.settings.keybinds || {};
  return id in overrides ? overrides[id] : actions.get(id)?.defaultKey || '';
}

export function isCustomized(id) {
  return id in (app.settings.keybinds || {});
}

export function actionForCombo(combo, exceptId) {
  for (const id of actions.keys()) {
    if (id !== exceptId && bindingFor(id) === combo) return actions.get(id);
  }
  return null;
}

export function rebuildKeymap() {
  keymap = new Map();
  for (const id of actions.keys()) {
    const k = bindingFor(id);
    if (k && !keymap.has(k)) keymap.set(k, id);
  }
  emit('keybinds-changed');
}

export function setBinding(id, combo) {
  const kb = { ...(app.settings.keybinds || {}) };
  if (combo) {
    const owner = actionForCombo(combo, id);
    if (owner) kb[owner.id] = '';
  }
  if (combo === actions.get(id).defaultKey) delete kb[id];
  else kb[id] = combo;
  app.settings.keybinds = kb;
  saveSettings();
  rebuildKeymap();
}

export function resetBinding(id) {
  const kb = { ...(app.settings.keybinds || {}) };
  delete kb[id];
  const def = actions.get(id).defaultKey;
  if (def) {
    const owner = actionForCombo(def, id);
    if (owner) kb[owner.id] = '';
  }
  app.settings.keybinds = kb;
  saveSettings();
  rebuildKeymap();
}

export function resetAllBindings() {
  app.settings.keybinds = {};
  saveSettings();
  rebuildKeymap();
}

const ENGINE_SHORTCUTS = new Set([
  'Ctrl+B', 'Ctrl+I', 'Ctrl+U', 'Ctrl+E', 'Ctrl+,', 'Ctrl+.', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+Shift+Z',
  'Ctrl+C', 'Ctrl+X', 'Ctrl+V', 'Ctrl+Shift+V', 'Ctrl+A', 'Ctrl+Shift+S', 'Ctrl+Shift+B', 'Ctrl+Shift+E',
  'Ctrl+Shift+H', 'Ctrl+Shift+J', 'Ctrl+Shift+L', 'Ctrl+Shift+R', 'Ctrl+Shift+7', 'Ctrl+Shift+8', 'Ctrl+Shift+9',
  'Ctrl+Alt+0', 'Ctrl+Alt+1', 'Ctrl+Alt+2', 'Ctrl+Alt+3', 'Ctrl+Alt+4', 'Ctrl+Alt+5', 'Ctrl+Alt+6', 'Ctrl+Alt+C',
]);

function isTextField(el) {
  if (!el) return false;
  if (el.closest?.('.ProseMirror')) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

let suspended = 0;
export function suspendShortcuts() {
  suspended++;
  return () => { suspended = Math.max(0, suspended - 1); };
}

export function initShortcutDispatcher() {
  window.addEventListener(
    'keydown',
    (e) => {
      if (suspended) return;
      if (document.querySelector('.modal-overlay')) return;
      const combo = comboFromEvent(e);
      if (!combo) return;
      const inField = isTextField(document.activeElement);
      const settingsOpen = !document.getElementById('settings-page').hidden;
      const id = keymap.get(combo);

      if (id) {
        const a = actions.get(id);
        if (a.scope === 'editor' && (inField || settingsOpen)) return;
        if (a.native && combo === a.defaultKey) return;
        e.preventDefault();
        e.stopPropagation();
        runAction(id);
        return;
      }
      if (!inField && ENGINE_SHORTCUTS.has(combo)) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );
}
