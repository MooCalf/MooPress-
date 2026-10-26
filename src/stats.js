import { app, h } from './app.js';
import { chapterDoc } from './editor.js';
import { pageCount } from './layout.js';
import { openDialog } from './ui.js';

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

export function countWords(text) {
  return text.match(WORD)?.length || 0;
}

export function docStats(doc) {
  let words = 0;
  let chars = 0;
  let charsNoSpaces = 0;
  let paragraphs = 0;
  doc.descendants((node) => {
    if (!node.isTextblock) return true;
    const t = node.textContent;
    if (t.trim()) paragraphs++;
    words += countWords(t);
    chars += t.length;
    charsNoSpaces += t.replace(/\s/g, '').length;
    return false;
  });
  return { words, chars, charsNoSpaces, paragraphs };
}

const wordCache = new Map();

export function chapterWords(id) {
  const doc = chapterDoc(id);
  const hit = wordCache.get(id);
  if (hit && hit.doc === doc) return hit.words;
  const words = docStats(doc).words;
  wordCache.set(id, { doc, words });
  return words;
}

export function bookWords() {
  return app.project.chapters.reduce((sum, ch) => sum + chapterWords(ch.id), 0);
}

const n = (v) => v.toLocaleString();

export function wordCountDialog() {
  const chapter = app.project.chapters.find((c) => c.id === app.view);
  const ch = chapter ? docStats(chapterDoc(chapter.id)) : null;
  const book = app.project.chapters.reduce(
    (acc, c) => {
      const s = docStats(chapterDoc(c.id));
      for (const k of Object.keys(acc)) acc[k] += s[k];
      return acc;
    },
    { words: 0, chars: 0, charsNoSpaces: 0, paragraphs: 0 },
  );
  const minutes = Math.max(1, Math.round(book.words / 250));
  const reading = minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
  const table = (rows) => h('table.stats-table', {}, rows.map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, v))));

  openDialog({
    title: 'Word count',
    width: 520,
    body: h(
      'div.stats',
      {},
      ch &&
        h(
          'div.stats-col',
          {},
          h('h4', {}, 'This chapter'),
          table([
            ['Words', n(ch.words)],
            ['Characters', n(ch.chars)],
            ['Characters (no spaces)', n(ch.charsNoSpaces)],
            ['Paragraphs', n(ch.paragraphs)],
            ['Pages (approx.)', n(pageCount)],
          ]),
        ),
      h(
        'div.stats-col',
        {},
        h('h4', {}, 'Whole book'),
        table([
          ['Words', n(book.words)],
          ['Characters', n(book.chars)],
          ['Chapters', n(app.project.chapters.length)],
          ['Paragraphs', n(book.paragraphs)],
          ['Reading time', reading],
        ]),
      ),
    ),
    buttons: [{ label: 'Close', value: true, primary: true }],
  });
}
