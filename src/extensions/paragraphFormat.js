import { Extension } from '@tiptap/core';

const TYPES = ['paragraph', 'heading'];

export const ParagraphFormat = Extension.create({
  name: 'paragraphFormat',

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => el.style.lineHeight || null,
            renderHTML: (a) => (a.lineHeight ? { style: `line-height: ${a.lineHeight}` } : {}),
          },
          indent: {
            default: 0,
            parseHTML: (el) => Math.round((parseFloat(el.style.marginLeft) || 0) / 0.5),
            renderHTML: (a) => (a.indent ? { style: `margin-left: ${a.indent * 0.5}in` } : {}),
          },
        },
      },
    ];
  },

  addCommands() {
    const updateAll = (attrs) => ({ commands }) => TYPES.map((t) => commands.updateAttributes(t, attrs)).some(Boolean);
    return {
      setLineHeight: (lineHeight) => updateAll({ lineHeight }),
      changeIndent:
        (delta) =>
        ({ state, tr, dispatch }) => {
          const { from, to } = state.selection;
          let changed = false;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!TYPES.includes(node.type.name)) return;
            const indent = Math.max(0, Math.min(8, (node.attrs.indent || 0) + delta));
            if (indent !== node.attrs.indent) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
              changed = true;
            }
          });
          if (changed && dispatch) dispatch(tr);
          return changed;
        },
    };
  },
});
