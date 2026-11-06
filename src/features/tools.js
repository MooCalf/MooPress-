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

export const MORE_TOOLS = [
  ['pastePlain', 'clipboard-type'], ['clipboardSlots', 'layers'], ['clearFormatting', 'remove-formatting'],
  ['heading1', 'heading-1'], ['heading2', 'heading-2'], ['quote', 'quote'], ['link', 'link'],
  ['addBibleEntry', 'notebook-pen'], ['selectAll', 'text-select'], ['picture', 'image'], ['table', 'table'],
  ['tableOfContents', 'list-tree'], ['caption', 'captions'], ['footnote', 'superscript'], ['headerFooter', 'panel-top'],
  ['pageNumbers', 'hash'], ['watermark', 'stamp'], ['shape', 'shapes'], ['chart', 'chart-column'],
  ['pageBreak', 'file-symlink'], ['sceneBreak', 'asterisk'], ['editElement', 'pencil'],
];

export function moreMenu(anchor, beforeRun = () => {}) {
  popover(
    anchor,
    MORE_TOOLS.map(([id]) => actions.get(id)).filter(Boolean).map((a) => ({
      label: a.label,
      detail: formatCombo(bindingFor(a.id)),
      onClick: () => { beforeRun(); runAction(a.id); },
    })),
  );
}
