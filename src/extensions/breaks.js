import { Node, mergeAttributes } from '@tiptap/core';

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': '', class: 'page-break' })];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});

export const SCENE_SYMBOLS = ['* * *', '#', '~', '❧', '◆ ◆ ◆', '⁂'];

export const SceneBreak = Node.create({
  name: 'sceneBreak',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      symbol: {
        default: '* * *',
        parseHTML: (el) => el.getAttribute('data-symbol') || '* * *',
        renderHTML: (attrs) => ({ 'data-symbol': attrs.symbol }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-scene-break]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-scene-break': '', class: 'scene-break' })];
  },

  addCommands() {
    return {
      setSceneBreak:
        (symbol) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { symbol: symbol || '* * *' } }),
    };
  },
});
