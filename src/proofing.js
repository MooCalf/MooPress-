import { TextSelection } from '@tiptap/pm/state';
import { app, h, icon, on, debounce, markDirty } from './app.js';
import { openView } from './editor.js';
import { eachTextblock, proofKey } from './extensions/decorations.js';
import { checkText } from './grammar.js';
import { showPanel, panelOpen } from './panel.js';
import { refreshIcons, toast } from './ui.js';
import { getSpeller, normalizeWord, suggestionsFor, rememberWord } from './spelling.js';
import { isBibleWord } from './features/bible.js';

const ignored = new Set();
let panelBody = null;
let filter = 'all';

function grammarIssues(doc) {
  const out = [];
  eachTextblock(doc, (text, start) => {
    for (const i of checkText(text, { style: app.settings.styleSuggestions })) {
      const snippet = text.slice(i.start, i.end);
      if (ignored.has(`${snippet}|${i.message}`)) continue;
      out.push({ ...i, from: start + i.start, to: start + i.end, text: snippet, context: contextOf(text, i.start, i.end) });
    }
  });
  return out;
}

function spellingIssues(doc, speller) {
  const out = [];
  const cache = new Map();
  const ignoredWords = new Set(app.project.ignoredWords.map((w) => w.toLowerCase()));
  const word = /[\p{L}][\p{L}'’]*[\p{L}]|[\p{L}]/gu;
  eachTextblock(doc, (text, start) => {
    for (const m of text.matchAll(word)) {
      const w = m[0].replace(/[’']$/, '');
      if (w.length < 2 || ignoredWords.has(w.toLowerCase()) || /^[A-Z]{2,}$/.test(w)) continue;
      let bad = cache.get(w);
      if (bad === undefined) {
        bad = !speller.correct(normalizeWord(w)) && !isBibleWord(w);
        cache.set(w, bad);
      }
      if (bad) out.push({ category: 'spelling', from: start + m.index, to: start + m.index + w.length, text: w, message: `“${w}” may be misspelled.`, context: contextOf(text, m.index, m.index + w.length) });
    }
  });
  return out;
}

function contextOf(text, s, e) {
  const before = text.slice(Math.max(0, s - 30), s).replace(/^\S*\s/, '');
  const after = text.slice(e, e + 30).replace(/\s\S*$/, '');
  return { before: (s > 30 ? '…' : '') + before, match: text.slice(s, e), after: after + (e + 30 < text.length ? '…' : '') };
}

function updateMarks() {
  const { editor } = app;
  if (!editor || !app.view || app.view === 'title') return;
  const issues = app.settings.grammarAsYouType || panelOpen('proofing') ? grammarIssues(editor.state.doc) : [];
  editor.view.dispatch(editor.state.tr.setMeta(proofKey, { issues }).setMeta('addToHistory', false));
}

export const scheduleMarks = debounce(() => {
  updateMarks();
  if (panelOpen('proofing')) renderPanel();
}, 700);

on('doc-changed', scheduleMarks);
on('view-changed', () => {
  updateMarks();
  if (panelOpen('proofing')) renderPanel();
});
on('settings-changed', (key) => {
  if (key === 'grammarAsYouType' || key === 'styleSuggestions') updateMarks();
  if (key === 'spellcheck' && app.editor) app.editor.view.dom.spellcheck = app.settings.spellcheck;
});

export function openProofing() {
  if (!app.view || app.view === 'title') openView(app.project.chapters[0].id);
  const body = h('div.proof-panel');
  const onClose = () => {
    if (panelBody === body) panelBody = null;
    updateMarks();
  };
  showPanel('proofing', 'Spelling & Grammar', body, { onClose });
  panelBody = body;
  updateMarks();
  renderPanel();
}

let renderToken = 0;

async function renderPanel() {
  if (!panelBody) return;
  const token = ++renderToken;
  if (!panelBody.childElementCount) panelBody.append(h('p.empty', {}, 'Checking this chapter…'));
  const speller = await getSpeller();
  if (!panelBody || token !== renderToken) return;
  const doc = app.editor.state.doc;
  const all = [...spellingIssues(doc, speller), ...grammarIssues(doc)].sort((a, b) => a.from - b.from);
  const counts = { all: all.length, spelling: 0, grammar: 0, style: 0 };
  for (const i of all) counts[i.category]++;
  const shown = filter === 'all' ? all : all.filter((i) => i.category === filter);

  const chip = (key, label) => h(`button.filter-chip.${key}${filter === key ? '.active' : ''}`, { onclick: () => { filter = key; renderPanel(); } }, label, h('span.badge', {}, counts[key]));
  const list = h('div.issue-list');
  if (!all.length) {
    list.append(h('div.all-clear', {}, icon('party-popper'), h('strong', {}, 'Looking good!'), h('span', {}, 'No spelling or grammar issues found in this chapter.')));
  } else if (!shown.length) {
    list.append(h('p.empty', {}, 'Nothing in this category.'));
  }
  shown.slice(0, 200).forEach((issue, i) => list.append(issueCard(issue, i < 30)));
  if (shown.length > 200) list.append(h('p.empty', {}, `Showing the first 200 of ${shown.length}. Fix some to see more.`));

  panelBody.replaceChildren(
    h('div.filter-chips', {}, chip('all', 'All'), chip('spelling', 'Spelling'), chip('grammar', 'Grammar'), app.settings.styleSuggestions && chip('style', 'Style')),
    !app.settings.styleSuggestions && h('p.panel-hint', {}, 'Want tips on passive voice and filler words? Turn on style suggestions in Settings → Writing & proofing.'),
    list,
  );
  refreshIcons(panelBody);
}

function issueCard(issue, eagerSuggestions) {
  const fixes = h('span.issue-fixes');
  const fixButton = (s) => h('button.btn.small.primary', { onclick: () => applyFix(issue, s) }, s === '' ? 'Remove' : s);
  const showSuggestions = async () => {
    fixes.replaceChildren(h('span.muted', {}, 'Finding suggestions…'));
    const list = await suggestionsFor(issue.text);
    fixes.replaceChildren(...(list.length ? list.slice(0, 4).map(fixButton) : [h('span.muted', {}, 'No suggestions')]));
  };
  if (issue.category !== 'spelling') fixes.append(...(issue.replacements || []).slice(0, 4).map(fixButton));
  else if (eagerSuggestions) setTimeout(showSuggestions, 0);
  else fixes.append(h('button.btn.small', { onclick: showSuggestions }, 'Suggest'));

  return h(
    `div.issue-card.${issue.category}`,
    { tabindex: 0, onclick: (e) => { if (!e.target.closest('button')) reveal(issue); } },
    h('div.issue-kind', {}, { spelling: 'Spelling', grammar: 'Grammar', style: 'Style' }[issue.category]),
    h('div.issue-context', {}, issue.context.before, h('mark', {}, issue.context.match), issue.context.after),
    h('div.issue-msg', {}, issue.message),
    h(
      'div.issue-actions',
      {},
      fixes,
      h('button.btn.small', { onclick: () => ignore(issue) }, 'Ignore'),
      issue.category === 'spelling' && h('button.btn.small', { onclick: () => addToDictionary(issue.text) }, 'Add to dictionary'),
    ),
  );
}

function reveal(issue) {
  const { view } = app.editor;
  if (issue.to > view.state.doc.content.size) return;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, issue.from, issue.to)).scrollIntoView());
  view.focus();
}

function applyFix(issue, replacement) {
  const { view } = app.editor;
  const current = view.state.doc.textBetween(issue.from, issue.to, '￼');
  if (current !== issue.text) {
    toast('That text has changed since it was checked. Rechecking…', 'info');
    renderPanel();
    return;
  }
  const tr = replacement === '' ? view.state.tr.delete(issue.from, issue.to) : view.state.tr.insertText(replacement, issue.from, issue.to);
  view.dispatch(tr);
  updateMarks();
  renderPanel();
}

function ignore(issue) {
  if (issue.category === 'spelling') {
    if (!app.project.ignoredWords.includes(issue.text)) app.project.ignoredWords.push(issue.text);
    markDirty();
  } else {
    ignored.add(`${issue.text}|${issue.message}`);
    updateMarks();
  }
  renderPanel();
}

async function addToDictionary(word) {
  await window.moopress.addWord(word);
  await rememberWord(word);
  markDirty();
  toast(`“${word}” was added to your dictionary.`, 'success');
  renderPanel();
}
