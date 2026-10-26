import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export function blockText(node) {
  let s = '';
  node.forEach((child) => {
    s += child.isText ? child.text : '￼';
  });
  return s;
}

export function eachTextblock(doc, fn) {
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      fn(blockText(node), pos + 1, node);
      return false;
    }
    return true;
  });
}

export function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function searchRegExp(query, { caseSensitive = false, wholeWord = false } = {}) {
  if (!query) return null;
  const body = escapeRegExp(query);
  return new RegExp(wholeWord ? `(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])` : body, caseSensitive ? 'gu' : 'giu');
}

export function findMatches(doc, query, opts) {
  const re = searchRegExp(query, opts);
  if (!re) return [];
  const out = [];
  eachTextblock(doc, (text, start) => {
    for (const m of text.matchAll(re)) {
      if (m[0].length) out.push({ from: start + m.index, to: start + m.index + m[0].length });
    }
  });
  return out;
}

export const searchKey = new PluginKey('mp-search');
const EMPTY_SEARCH = { query: '', opts: {}, matches: [], index: -1 };

const searchPlugin = new Plugin({
  key: searchKey,
  state: {
    init: () => EMPTY_SEARCH,
    apply(tr, prev, _old, state) {
      const meta = tr.getMeta(searchKey);
      if (meta) {
        const next = { ...prev, ...meta };
        if ('query' in meta || 'opts' in meta) next.matches = findMatches(state.doc, next.query, next.opts);
        if (next.index >= next.matches.length) next.index = next.matches.length ? 0 : -1;
        if (next.index < 0 && next.matches.length && meta.index === undefined) next.index = 0;
        return next;
      }
      if (tr.docChanged && prev.query) {
        const matches = findMatches(state.doc, prev.query, prev.opts);
        return { ...prev, matches, index: Math.min(prev.index, matches.length - 1) };
      }
      return prev;
    },
  },
  props: {
    decorations(state) {
      const { matches, index } = searchKey.getState(state);
      if (!matches.length) return null;
      return DecorationSet.create(
        state.doc,
        matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === index ? 'search-match current' : 'search-match' })),
      );
    },
  },
});

export const proofKey = new PluginKey('mp-proof');

const proofPlugin = new Plugin({
  key: proofKey,
  state: {
    init: () => DecorationSet.empty,
    apply(tr, set) {
      const meta = tr.getMeta(proofKey);
      if (meta) {
        return DecorationSet.create(
          tr.doc,
          meta.issues.map((i) =>
            Decoration.inline(i.from, i.to, { class: `proof-mark proof-${i.category}`, title: i.message }, { issue: i }),
          ),
        );
      }
      return tr.docChanged ? set.map(tr.mapping, tr.doc) : set;
    },
  },
  props: {
    decorations: (state) => proofKey.getState(state),
  },
});

function highlightLayer(key) {
  return new Plugin({
    key,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, set) {
        const meta = tr.getMeta(key);
        if (meta) {
          const size = tr.doc.content.size;
          return DecorationSet.create(
            tr.doc,
            meta.marks.filter((m) => m.to <= size && m.from < m.to).map((m) => Decoration.inline(m.from, m.to, { class: m.class, ...m.attrs })),
          );
        }
        return tr.docChanged ? set.map(tr.mapping, tr.doc) : set;
      },
    },
    props: { decorations: (state) => key.getState(state) },
  });
}

export const fluffKey = new PluginKey('mp-fluff');
export const bibleKey = new PluginKey('mp-bible');

export function setHighlights(editor, key, marks) {
  editor.view.dispatch(editor.state.tr.setMeta(key, { marks }).setMeta('addToHistory', false));
}

export const EditorDecorations = Extension.create({
  name: 'editorDecorations',
  addProseMirrorPlugins: () => [searchPlugin, proofPlugin, highlightLayer(fluffKey), highlightLayer(bibleKey)],
});
