import { app, h, on, emit, debounce } from '../app.js';
import { eachTextblock, fluffKey, setHighlights } from '../extensions/decorations.js';
import { popover } from '../ui.js';
import { setSetting } from '../settings.js';

const CLICHES = [
  'at the end of the day', 'avoid like the plague', 'back to square one', 'beat around the bush', 'better late than never',
  'bite the bullet', 'break the ice', 'by the skin of (?:his|her|my|their|your) teeth', 'calm before the storm', 'cold as ice',
  'cool as a cucumber', 'crystal clear', 'dead as a doornail', 'déjà vu', 'easier said than done', 'every cloud has a silver lining',
  'few and far between', 'fit as a fiddle', 'for all intents and purposes', 'free as a bird', 'frozen in fear', 'gave (?:him|her|me|them) the creeps',
  'hard as nails', 'heart of gold', 'heart skipped a beat', 'hit the nail on the head', 'in the nick of time', 'in the blink of an eye',
  'it goes without saying', 'last but not least', 'let the cat out of the bag', 'light as a feather', 'little did (?:he|she|they|i|we) know',
  'loud and clear', 'needle in a haystack', 'only time will tell', 'opened a can of worms', 'out of the blue', 'over the moon',
  'piece of cake', 'plenty of fish in the sea', 'quiet as a mouse', 'rain on (?:my|your|his|her|their) parade', 'read between the lines',
  'sick as a dog', 'sigh of relief', 'sleep like a log', 'slept like a baby', 'smart as a whip', 'stopped dead in (?:his|her|their|my) tracks',
  'take it with a grain of salt', 'the writing on the wall', 'think outside the box', 'time heals all wounds', 'tip of the iceberg',
  'too good to be true', 'twist of fate', 'under the weather', 'walking on eggshells', 'when all is said and done', 'white as a sheet',
  'white as snow', 'without further ado', 'a chill ran down (?:his|her|my|their) spine', 'shivers? down (?:his|her|my|their) spine',
  'all of a sudden', 'blood ran cold', 'butterflies in (?:his|her|my|their) stomach', 'dark and stormy night', 'eyes like saucers',
  'face the music', 'fell head over heels', 'growing by leaps and bounds', 'held (?:his|her|my|their) breath', 'in the heat of the moment',
  'kiss of death', 'let out a breath (?:he|she|i|they) didn’?t know (?:he|she|i|they) (?:was|were) holding', 'like a moth to a flame',
  'long story short', 'more than meets the eye', 'never a dull moment', 'nerves of steel', 'on cloud nine', 'pale as a ghost',
  'play it by ear', 'raining cats and dogs', 'scared to death', 'the elephant in the room', 'the rest is history', 'thick as thieves',
  'time stood still', 'to make a long story short', 'turn over a new leaf', 'what goes around comes around', 'when pigs fly',
  'worth (?:its|his|her) weight in gold', 'lump in (?:his|her|my|their) throat', 'eyes sparkled', 'ran a hand through (?:his|her|my|their) hair',
];
const CLICHE_RE = new RegExp(`\\b(?:${CLICHES.join('|')})\\b`, 'gi');

const FILLERS = /\b(very|really|just|actually|basically|literally|totally|quite|rather|somewhat|simply|truly|definitely|certainly|completely|absolutely|extremely|seriously|honestly|kind of|sort of|a bit|in order to|the fact that|due to the fact that|at this point in time|needless to say|it is important to note that)\b/gi;

const IRREGULAR_PARTICIPLES = 'lit|hung|bound|fed|bent|burnt|dealt|dug|fled|flung|forbidden|frozen|ground|knelt|lent|proven|risen|sewn|shrunk|slain|sought|spun|split|stuck|stung|sworn|swollen|swung|thrust|trodden|wound|wrung|been|born|broken|brought|built|bought|caught|chosen|done|drawn|driven|eaten|fallen|felt|forgotten|found|forgiven|given|gone|grown|heard|held|hidden|hit|hurt|kept|known|laid|led|left|lost|made|meant|met|paid|put|read|ridden|rung|run|said|seen|sent|set|shaken|shot|shown|shut|sold|spoken|spent|stolen|struck|sung|swept|taken|taught|thrown|told|torn|thought|understood|woken|won|worn|written';
const PASSIVE = new RegExp(`\\b(am|is|are|was|were|be|been|being|get|got|gets|getting)\\s+(?:\\w+ly\\s+)?(\\w+ed|${IRREGULAR_PARTICIPLES})\\b`, 'gi');
const NOT_PASSIVE = new Set(['tired', 'scared', 'bored', 'interested', 'excited', 'worried', 'married', 'used', 'supposed', 'pleased', 'red', 'need', 'feed', 'seed', 'shed', 'bed', 'naked', 'wicked', 'sacred', 'hundred', 'kindred', 'ashamed', 'concerned', 'determined', 'relieved', 'surprised', 'amazed', 'confused', 'embarrassed', 'frightened', 'annoyed', 'satisfied', 'prepared', 'involved', 'related', 'aged', 'beloved']);

const STOP = new Set('the a an and or but of to in on at by for with from as is was were be been are am it its this that these those he she they we you i me him her them my his their our your not no so than then there here what which who whom when where why how all any each into out up down over under again also had has have did does do would could should said says will just very there their they’re don’t didn’t it’s that’s'.split(' '));

export const KINDS = {
  cliche: { label: 'Clichés', help: 'Overused phrases. Try saying it in a fresh way.' },
  passive: { label: 'Passive voice', help: 'The subject is acted upon. Active voice is often stronger.' },
  filler: { label: 'Filler words', help: 'Words that add little. Try cutting them.' },
  repeat: { label: 'Repeated words', help: 'The same word used again close by.' },
};

export function findFluff(text) {
  const out = [];
  let m;
  CLICHE_RE.lastIndex = 0;
  while ((m = CLICHE_RE.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, kind: 'cliche', message: `Cliché: “${m[0]}”. ${KINDS.cliche.help}` });
  FILLERS.lastIndex = 0;
  while ((m = FILLERS.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, kind: 'filler', message: `Filler: “${m[0]}”. ${KINDS.filler.help}` });
  PASSIVE.lastIndex = 0;
  while ((m = PASSIVE.exec(text))) {
    if (NOT_PASSIVE.has(m[2].toLowerCase())) continue;
    out.push({ start: m.index, end: m.index + m[0].length, kind: 'passive', message: `Passive voice: “${m[0]}”. ${KINDS.passive.help}` });
  }
  const words = [...text.matchAll(/[\p{L}’']+/gu)];
  const last = new Map();
  words.forEach((w, i) => {
    const word = w[0].toLowerCase();
    if (word.length < 4 || STOP.has(word)) return;
    const stem = word.replace(/(ing|ed|es|s|ly)$/, '');
    if (last.has(stem) && i - last.get(stem) <= 25) {
      out.push({ start: w.index, end: w.index + w[0].length, kind: 'repeat', message: `“${w[0]}” was used just before. ${KINDS.repeat.help}` });
    }
    last.set(stem, i);
  });
  return out;
}

export const WORDS_PER_MINUTE = 238;

function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function readability(text) {
  const words = text.match(/[\p{L}\p{N}’']+/gu) || [];
  if (words.length < 10) return null;
  const sentences = Math.max(1, (text.match(/[.!?]+(?=\s|$|["”’)])/g) || []).length);
  const syl = words.reduce((s, w) => s + syllables(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syl / words.length);
  return { score: Math.round(Math.max(0, Math.min(100, score))), wordsPerSentence: words.length / sentences };
}

export function readabilityLabel(score) {
  if (score >= 90) return 'Very easy';
  if (score >= 80) return 'Easy';
  if (score >= 70) return 'Fairly easy';
  if (score >= 60) return 'Plain English';
  if (score >= 50) return 'Fairly difficult';
  if (score >= 30) return 'Difficult';
  return 'Very difficult';
}

export function formatReadingTime(words) {
  const seconds = Math.round((words / WORDS_PER_MINUTE) * 60);
  if (seconds < 60) return words ? `${Math.max(5, Math.round(seconds / 5) * 5)} sec` : '0 min';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export const stats = { score: null, counts: { cliche: 0, passive: 0, filler: 0, repeat: 0 }, wordsPerSentence: 0 };

function refresh() {
  const { editor } = app;
  if (!editor || !app.view || app.view === 'title') return;
  const on = app.settings.fluffDetector;
  const marks = [];
  const counts = { cliche: 0, passive: 0, filler: 0, repeat: 0 };
  let all = '';
  eachTextblock(editor.state.doc, (text, start) => {
    all += `${text}\n`;
    if (!on) return;
    for (const f of findFluff(text)) {
      counts[f.kind]++;
      marks.push({ from: start + f.start, to: start + f.end, class: `fluff fluff-${f.kind}`, attrs: { title: f.message } });
    }
  });
  const r = readability(all);
  stats.score = r?.score ?? null;
  stats.wordsPerSentence = r?.wordsPerSentence ?? 0;
  stats.counts = counts;
  setHighlights(editor, fluffKey, marks);
  emit('fluff-changed');
}

export const scheduleFluff = debounce(refresh, 400);

export function toggleFluff() {
  setSetting('fluffDetector', !app.settings.fluffDetector);
}

export function readabilityPopover(anchor) {
  const s = stats;
  const row = (kind) => h('div.fluff-row', {}, h(`span.fluff-swatch.fluff-${kind}`), h('span', {}, KINDS[kind].label), h('strong', {}, s.counts[kind]));
  popover(
    anchor,
    h(
      'div.readability-pop',
      {},
      h('div.readability-score', {}, h('strong', {}, s.score ?? '–'), h('span', {}, s.score == null ? 'Write a little more to get a score' : readabilityLabel(s.score))),
      h('p.muted', {}, 'Flesch reading ease, 0–100. Most popular novels score 70–90; higher means easier to read.'),
      s.score != null && h('p.muted', {}, `Average sentence: ${s.wordsPerSentence.toFixed(1)} words.`),
      app.settings.fluffDetector ? [row('cliche'), row('passive'), row('filler'), row('repeat')] : h('p.muted', {}, 'Turn on the Cliché & Fluff detector to highlight weak spots.'),
      h('button.btn.small', { onclick: () => toggleFluff() }, app.settings.fluffDetector ? 'Turn highlights off' : 'Turn highlights on'),
    ),
    { align: 'end' },
  );
}

on('doc-changed', scheduleFluff);
on('view-changed', refresh);
on('project-loaded', scheduleFluff);
on('settings-changed', (key) => { if (key === 'fluffDetector') refresh(); });
