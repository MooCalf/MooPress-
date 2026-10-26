import { TextSelection } from '@tiptap/pm/state';
import { app, h } from '../app.js';
import { blockText } from '../extensions/decorations.js';
import { toast } from '../ui.js';

let pop = null;

const DETERMINERS = new Set('the a an this that these those my your his her its our their some every each no any another'.split(' '));
const VERB_LEADS = new Set('to will would could should can may might must did does do i you we they he she it not never always often'.split(' '));
const ADJ_LEADS = new Set('was were is are be been am seemed seems looked looks felt feels became very so too more most less quite'.split(' '));

function guessPos(prev, word, next) {
  const w = word.toLowerCase();
  if (/ly$/.test(w) && w.length > 4) return 'r';
  if (DETERMINERS.has(prev)) return /(ous|ful|ive|able|ible|less|ish|ic|al)$/.test(w) && next && /^[a-z]/.test(next) ? 'a' : 'n';
  if (ADJ_LEADS.has(prev) && !/(ed|ing)$/.test(w)) return 'a';
  if (VERB_LEADS.has(prev) || /(ed|ing)$/.test(w)) return 'v';
  return '';
}

function matchCase(original, replacement) {
  if (original === original.toUpperCase() && original.length > 1) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

function wordRange(state) {
  const { $from, $to } = state.selection;
  if (!$from.parent.isTextblock || $from.parent !== $to.parent) return null;
  const text = blockText($from.parent);
  let start = $from.parentOffset;
  let end = $to.parentOffset;
  const isWordChar = (c) => /[\p{L}'’-]/u.test(c || '');
  while (end > start && /\s/.test(text[end - 1])) end--;
  while (start < end && /\s/.test(text[start])) start++;
  while (start > 0 && isWordChar(text[start - 1])) start--;
  while (end < text.length && isWordChar(text[end])) end++;
  while (end > start && /[\s'’-]/.test(text[end - 1])) end--;
  while (start < end && /['’-]/.test(text[start])) start++;
  const word = text.slice(start, end);
  if (!/^\p{L}[\p{L}'’-]*$/u.test(word)) return null;
  const base = $from.start();
  return { from: base + start, to: base + end, word, text, start, end };
}

function sentenceAround(text, start, end) {
  const before = text.slice(0, start);
  const s = Math.max(before.lastIndexOf('. '), before.lastIndexOf('! '), before.lastIndexOf('? ')) + 1;
  const rest = text.slice(end);
  const m = rest.search(/[.!?](\s|$)/);
  return text.slice(s, m < 0 ? text.length : end + m + 1).trim();
}

export function closeSynonyms() {
  if (!pop) return;
  pop.el.remove();
  document.removeEventListener('mousedown', pop.outside, true);
  document.removeEventListener('keydown', pop.key, true);
  document.getElementById('canvas').removeEventListener('scroll', closeSynonyms);
  pop = null;
}

export async function showSynonyms() {
  const { editor } = app;
  if (!editor || !app.view || app.view === 'title') return;
  const range = wordRange(editor.state);
  if (!range) return;
  closeSynonyms();
  const before = range.text.slice(0, range.start).match(/([\p{L}'’]+)\W*$/u)?.[1]?.toLowerCase() || '';
  const after = range.text.slice(range.end).match(/^\W*([\p{L}'’]+)/u)?.[1] || '';
  const full = sentenceAround(range.text, range.start, range.end);
  const at = full.indexOf(range.word);
  const left = full.slice(0, Math.max(0, at)).split(/\s+/).slice(-8).join(' ');
  const right = at >= 0 ? full.slice(at + range.word.length).split(/\s+/).slice(0, 9).join(' ') : '';
  const sentence = `${left} ${range.word} ${right}`;
  const senses = await window.moopress.synonyms(range.word, sentence, guessPos(before, range.word, after));
  if (editor.state.doc.textBetween(range.from, range.to) !== range.word) return;
  if (!senses.length) {
    toast(`No synonyms found for “${range.word}”.`, 'info', 2000);
    return;
  }
  render(range, senses);
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, range.from, range.to)));
}

function render(range, senses) {
  const { editor } = app;
  const apply = (word) => {
    closeSynonyms();
    const rep = matchCase(range.word, word);
    const { state, view } = editor;
    if (state.doc.textBetween(range.from, range.to) !== range.word) return;
    const tr = state.tr.insertText(rep, range.from, range.to);
    tr.setSelection(TextSelection.create(tr.doc, range.from + rep.length));
    view.dispatch(tr);
    view.focus();
  };
  const [best, ...others] = senses;
  const chip = (w) => h('button.syn-chip', { onclick: () => apply(w) }, matchCase(range.word, w));
  const el = h(
    'div.syn-pop',
    { role: 'listbox', 'aria-label': `Synonyms for ${range.word}` },
    h('div.syn-head', {}, h('span.syn-gloss', {}, `as in “${best.gloss}”`)),
    h('div.syn-chips', {}, best.words.slice(0, 8).map(chip)),
    others.length > 0 &&
      h(
        'details.syn-more',
        {},
        h('summary', {}, 'Other meanings'),
        others.slice(0, 3).map((s) => h('div.syn-sense', {}, h('div.syn-gloss', {}, s.gloss), h('div.syn-chips', {}, s.words.slice(0, 5).map(chip)))),
      ),
  );
  document.body.append(el);
  const c = editor.view.coordsAtPos(range.from);
  const left = Math.max(8, Math.min(c.left - 8, window.innerWidth - el.offsetWidth - 8));
  let top = c.bottom + 6;
  if (top + el.offsetHeight > window.innerHeight - 8) top = c.top - el.offsetHeight - 6;
  Object.assign(el.style, { left: `${left}px`, top: `${top}px` });
  requestAnimationFrame(() => el.classList.add('show'));

  const outside = (e) => { if (!el.contains(e.target)) closeSynonyms(); };
  const key = (e) => {
    const chips = [...el.querySelectorAll('.syn-chip')].filter((b) => b.offsetParent);
    const i = chips.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeSynonyms();
      editor.commands.focus();
    } else if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key) && (i >= 0 || e.key === 'ArrowDown')) {
      e.preventDefault();
      e.stopPropagation();
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      chips[(i + step + chips.length) % chips.length]?.focus();
    } else if (i < 0 && !e.ctrlKey && !e.altKey) {
      closeSynonyms();
    }
  };
  document.addEventListener('mousedown', outside, true);
  document.addEventListener('keydown', key, true);
  document.getElementById('canvas').addEventListener('scroll', closeSynonyms, { once: true });
  pop = { el, outside, key };
}

export function initSynonyms() {
  app.editor.view.dom.addEventListener('dblclick', (e) => {
    if (!app.settings.smartSynonyms || e.target.closest('.img-node, .bible-term-skip')) return;
    setTimeout(showSynonyms, 0);
  });
}
