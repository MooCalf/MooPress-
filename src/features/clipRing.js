import { Slice } from '@tiptap/pm/model';
import { app, h, icon, emit } from '../app.js';
import { withEditor } from '../editor.js';
import { bindingFor, formatCombo } from '../keybinds.js';
import { popover, closePopover, refreshIcons, toast } from '../ui.js';

export const SLOT_COUNT = 5;
const slots = [];

function capture() {
  const { state } = app.editor;
  if (state.selection.empty) return;
  const slice = state.selection.content();
  let images = 0;
  slice.content.descendants((n) => { if (n.type.name === 'image') images++; });
  const text = state.doc.textBetween(state.selection.from, state.selection.to, ' ', ' ').replace(/\s+/g, ' ').trim();
  const json = slice.toJSON();
  const key = JSON.stringify(json);
  const existing = slots.findIndex((s) => s.key === key);
  if (existing >= 0) slots.splice(existing, 1);
  slots.unshift({ json, key, text, images, at: Date.now() });
  slots.length = Math.min(slots.length, SLOT_COUNT);
  emit('clipring-changed');
}

export function initClipRing() {
  for (const type of ['copy', 'cut']) app.editor.view.dom.addEventListener(type, capture, true);
}

export function pasteSlot(n) {
  const slot = slots[n - 1];
  if (!slot) return toast(`Clipboard slot ${n} is empty. Copy something first — your last ${SLOT_COUNT} copies are kept.`, 'info');
  withEditor((_chain, editor) => {
    const { state, view } = editor;
    view.dispatch(state.tr.replaceSelection(Slice.fromJSON(state.schema, slot.json)).scrollIntoView());
    view.focus();
    return true;
  });
}

function describe(slot) {
  const pics = slot.images ? `${slot.images} picture${slot.images > 1 ? 's' : ''}` : '';
  if (!slot.text) return pics || 'Formatted content';
  return slot.text.length > 70 ? `${slot.text.slice(0, 70)}…` : slot.text;
}

export function clipRingPopover(anchor) {
  const rows = Array.from({ length: SLOT_COUNT }, (_, i) => {
    const slot = slots[i];
    const key = formatCombo(bindingFor(`pasteSlot${i + 1}`));
    return h(
      `button.clip-slot${slot ? '' : '.empty'}`,
      { disabled: !slot, onclick: () => { closePopover(); pasteSlot(i + 1); } },
      h('span.clip-num', {}, i + 1),
      h('span.clip-text', {}, slot ? describe(slot) : 'Empty'),
      slot?.images ? icon('image') : null,
      key && h('kbd', {}, key),
    );
  });
  const el = popover(
    anchor,
    h(
      'div.clip-ring',
      {},
      h('div.menu-heading', {}, 'Clipboard slots'),
      ...rows,
      h('p.clip-hint', {}, 'Everything you copy or cut is kept here — newest in slot 1.'),
      slots.length > 0 && h('button.btn.small', { onclick: () => { slots.length = 0; closePopover(); toast('Clipboard slots cleared.', 'success'); } }, icon('trash-2'), 'Clear slots'),
    ),
  );
  if (el) refreshIcons(el);
}
