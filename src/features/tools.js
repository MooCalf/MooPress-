import { actions, runAction, bindingFor, formatCombo } from '../keybinds.js';
import { popover } from '../ui.js';

export const TOOLS = [
  ['bold', 'bold'],
  ['italic', 'italic'],
  ['underline', 'underline'],
  ['highlight', 'highlighter'],
  ['paste', 'clipboard-paste'],
  ['copy', 'copy'],
  ['cut', 'scissors'],
  ['synonyms', 'book-a'],
];

const MORE = ['pastePlain', 'clipboardSlots', 'clearFormatting', 'heading1', 'heading2', 'quote', 'link', 'addBibleEntry', 'selectAll'];

export function moreMenu(anchor, beforeRun = () => {}) {
  popover(
    anchor,
    MORE.map((id) => actions.get(id)).filter(Boolean).map((a) => ({
      label: a.label,
      detail: formatCombo(bindingFor(a.id)),
      onClick: () => { beforeRun(); runAction(a.id); },
    })),
  );
}
