import { TextSelection } from '@tiptap/pm/state';
import { app, h, icon, on } from '../app.js';
import { withEditor, activeChapter } from '../editor.js';
import { setSetting } from '../settings.js';
import { popover, refreshIcons, confirmDialog, toast } from '../ui.js';

export const DEFAULT_SNIPPETS = [
  { trigger: 'sig', name: 'Signature', body: 'With gratitude,\n{author}' },
  { trigger: 'intro', name: 'Introduction', body: '# Introduction\n{cursor}' },
  { trigger: 'chapter', name: 'Chapter outline', body: '## Opening scene\nWhere are we, who is here, and what do they want? {cursor}\n* * *\n## Turning point\nWhat changes, and what does it cost?\n* * *\n## Closing hook\nWhat makes the reader turn the page?' },
  { trigger: 'scene', name: 'Scene break', body: '* * *\n{cursor}' },
  { trigger: 'date', name: 'Today’s date', body: '{date}' },
  { trigger: 'ack', name: 'Acknowledgements', body: '# Acknowledgements\nI am deeply grateful to {cursor}' },
  { trigger: 'about', name: 'About the author', body: '# About the Author\n{author} {cursor}' },
  { trigger: 'letter', name: 'Letter', body: 'Dear {cursor},\n\nYours sincerely,\n{author}' },
];

const CURSOR = '⁣';

export function snippets() {
  return app.settings.snippets || DEFAULT_SNIPPETS;
}

function fillTokens(body) {
  const now = new Date();
  return body
    .replace(/\{date\}/gi, now.toLocaleDateString(undefined, { dateStyle: 'long' }))
    .replace(/\{time\}/gi, now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
    .replace(/\{title\}/gi, app.project.title || 'Untitled Book')
    .replace(/\{author\}/gi, app.project.author || 'Your Name')
    .replace(/\{chapter\}/gi, activeChapter()?.title || '')
    .replace(/\{cursor\}/gi, CURSOR);
}

const BLOCK_LINE = /^(#{1,3} |> |\* \* \*$|\*\*\*$|---$)/;

function toContent(body) {
  const lines = fillTokens(body).split('\n');
  if (lines.length === 1 && !BLOCK_LINE.test(lines[0])) return lines[0];
  return lines.map((line) => {
    const text = (s) => (s ? [{ type: 'text', text: s }] : []);
    const heading = line.match(/^(#{1,3}) (.*)$/);
    if (heading) return { type: 'heading', attrs: { level: heading[1].length }, content: text(heading[2]) };
    if (/^(\* \* \*|\*\*\*)$/.test(line)) return { type: 'sceneBreak' };
    if (line === '---') return { type: 'pageBreak' };
    if (line.startsWith('> ')) return { type: 'blockquote', content: [{ type: 'paragraph', content: text(line.slice(2)) }] };
    return { type: 'paragraph', content: text(line) };
  });
}

export function insertSnippet(snippet, from, to) {
  withEditor((chain, editor) => {
    const start = from ?? editor.state.selection.from;
    chain.insertContentAt({ from: start, to: to ?? editor.state.selection.to }, toContent(snippet.body)).run();
    const { state, view } = editor;
    let marker = -1;
    state.doc.nodesBetween(Math.max(0, start - 2), state.doc.content.size, (node, pos) => {
      if (marker >= 0 || !node.isText) return marker < 0;
      const i = node.text.indexOf(CURSOR);
      if (i >= 0) marker = pos + i;
      return false;
    });
    if (marker >= 0) {
      const tr = state.tr.delete(marker, marker + 1);
      tr.setSelection(TextSelection.create(tr.doc, marker));
      view.dispatch(tr);
    }
    return true;
  });
}

let menu = null;
let dismissedAt = -1;

function triggerAtCaret() {
  const { state } = app.editor;
  const { selection } = state;
  if (!selection.empty || !selection.$from.parent.isTextblock) return null;
  const $p = selection.$from;
  const before = $p.parent.textBetween(Math.max(0, $p.parentOffset - 40), $p.parentOffset, null, '￼');
  const m = before.match(/(?:^|\s)\/([\w-]{0,30})$/);
  if (!m) return null;
  return { query: m[1].toLowerCase(), from: selection.from - m[1].length - 1, to: selection.from };
}

function closeMenu() {
  menu?.el.remove();
  menu = null;
}

function updateMenu() {
  if (!app.editor || !app.view || app.view === 'title' || !app.editor.isFocused) return closeMenu();
  const t = triggerAtCaret();
  if (!t || t.from === dismissedAt) return closeMenu();
  const items = snippets().filter((s) => s.trigger.toLowerCase().startsWith(t.query) || s.name.toLowerCase().includes(t.query));
  if (!items.length) return closeMenu();
  const index = menu && menu.query === t.query ? Math.min(menu.index, items.length - 1) : 0;
  const el = menu?.el || h('div.snippet-menu', { role: 'listbox' });
  el.replaceChildren(
    h('div.snippet-head', {}, 'Snippets', h('span', {}, '↵ insert · Esc close')),
    ...items.slice(0, 8).map((s, i) =>
      h(
        `button.snippet-item${i === index ? '.active' : ''}`,
        { onmousedown: (e) => { e.preventDefault(); expand(s); } },
        h('span.snippet-trigger', {}, `/${s.trigger}`),
        h('span.snippet-name', {}, s.name),
        h('span.snippet-preview', {}, s.body.replace(/\n/g, ' ⏎ ').slice(0, 60)),
      ),
    ),
  );
  if (!el.isConnected) document.body.append(el);
  const c = app.editor.view.coordsAtPos(t.from);
  let top = c.bottom + 6;
  if (top + el.offsetHeight > window.innerHeight - 8) top = c.top - el.offsetHeight - 6;
  Object.assign(el.style, { left: `${Math.min(c.left, window.innerWidth - el.offsetWidth - 8)}px`, top: `${top}px` });
  menu = { el, items: items.slice(0, 8), index, ...t };
}

function expand(s) {
  if (!menu) return;
  const { from, to } = menu;
  closeMenu();
  insertSnippet(s, from, to);
}

export function initSnippets() {
  document.getElementById('editor-mount').addEventListener(
    'keydown',
    (e) => {
      if (!menu) return;
      const stop = () => { e.preventDefault(); e.stopPropagation(); };
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        stop();
        menu.index = (menu.index + (e.key === 'ArrowDown' ? 1 : -1) + menu.items.length) % menu.items.length;
        updateMenu();
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        stop();
        expand(menu.items[menu.index]);
      } else if (e.key === ' ') {
        const exact = menu.items.find((s) => s.trigger.toLowerCase() === menu.query);
        if (exact) {
          stop();
          expand(exact);
        }
      } else if (e.key === 'Escape') {
        stop();
        dismissedAt = menu.from;
        closeMenu();
      }
    },
    true,
  );
  on('transaction', () => requestAnimationFrame(updateMenu));
  app.editor.on('blur', () => setTimeout(closeMenu, 100));
}

export function snippetMenu(anchor) {
  popover(anchor, [
    ...snippets().map((s) => ({ label: s.name, detail: `/${s.trigger}`, icon: 'text-cursor-input', onClick: () => insertSnippet(s) })),
    'separator',
    { label: 'Manage snippets…', icon: 'settings-2', onClick: () => import('../settings.js').then((m) => m.openSettings('snippets')) },
  ]);
}

export function renderSnippetSettings(body) {
  const list = h('div.snippet-list');
  const save = (items) => setSetting('snippets', items.map((s) => ({ ...s })));
  const draw = () => {
    const items = snippets().map((s) => ({ ...s }));
    list.replaceChildren(
      ...items.map((s, i) => {
        const trigger = h('input.field.snippet-trigger-input', { value: s.trigger, 'aria-label': 'Trigger word', spellcheck: 'false' });
        const name = h('input.field', { value: s.name, 'aria-label': 'Snippet name', placeholder: 'Name' });
        const text = h('textarea.field.snippet-body', { value: s.body, rows: Math.min(8, Math.max(2, s.body.split('\n').length)), spellcheck: 'true' });
        const msg = h('small.snippet-msg');
        const commit = () => {
          const t = trigger.value.trim().replace(/^\//, '').toLowerCase();
          if (!/^[a-z0-9-]{1,30}$/.test(t)) return (msg.textContent = 'Triggers can use letters, numbers and dashes only.');
          if (items.some((o, j) => j !== i && o.trigger === t)) return (msg.textContent = `/${t} is already used by another snippet.`);
          msg.textContent = '';
          items[i] = { trigger: t, name: name.value.trim() || t, body: text.value };
          save(items);
        };
        for (const el of [trigger, name, text]) el.addEventListener('change', commit);
        return h(
          'div.snippet-card',
          {},
          h('div.snippet-row', {}, h('span.slash', {}, '/'), trigger, name, h('button.icon-btn.small', { title: 'Delete snippet', onclick: () => { items.splice(i, 1); save(items); draw(); } }, icon('trash-2'))),
          text,
          msg,
        );
      }),
    );
    refreshIcons(list);
  };
  draw();
  body.append(
    h('h2', {}, 'Snippets'),
    h('p.settings-lead', {}, 'Type ', h('kbd', {}, '/'), ' followed by a trigger (for example ', h('kbd', {}, '/sig'), ') in your chapter, then press Enter, Tab or Space to insert it.'),
    h(
      'div.settings-card.snippet-help',
      {},
      h('p', {}, h('strong', {}, 'Placeholders: '), h('code', {}, '{author}'), ' ', h('code', {}, '{title}'), ' ', h('code', {}, '{chapter}'), ' ', h('code', {}, '{date}'), ' ', h('code', {}, '{time}'), ' and ', h('code', {}, '{cursor}'), ' (where the cursor ends up).'),
      h('p', {}, h('strong', {}, 'Layout: '), 'each line becomes a paragraph. Start a line with ', h('code', {}, '# '), ' or ', h('code', {}, '## '), ' for headings, ', h('code', {}, '> '), ' for a quote, use ', h('code', {}, '* * *'), ' for a scene break and ', h('code', {}, '---'), ' for a page break.'),
    ),
    h(
      'div.shortcut-toolbar',
      {},
      h('button.btn.primary', { onclick: () => { save([...snippets(), { trigger: `new${snippets().length + 1}`, name: 'New snippet', body: '' }]); draw(); list.lastElementChild?.querySelector('input')?.focus(); } }, icon('plus'), 'Add snippet'),
      h('button.btn', { onclick: async () => { if (await confirmDialog('Restore default snippets?', 'Your snippets will be replaced by the original set.', { okLabel: 'Restore defaults', danger: true })) { setSetting('snippets', null); draw(); toast('Default snippets restored.', 'success'); } } }, icon('rotate-ccw'), 'Restore defaults'),
    ),
    list,
  );
  refreshIcons(body);
}
