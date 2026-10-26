const fs = require('fs');
const path = require('path');

const DICT = require('wordnet-db').path;
const POS = { n: 'noun', v: 'verb', a: 'adj', r: 'adv' };
const indexes = {};
const fds = {};

function loadIndex(pos) {
  if (indexes[pos]) return indexes[pos];
  const map = new Map();
  const text = fs.readFileSync(path.join(DICT, `index.${POS[pos]}`), 'utf8');
  for (const line of text.split('\n')) {
    if (!line || line.startsWith(' ')) continue;
    const parts = line.trim().split(' ');
    const ptrCount = Number(parts[3]);
    const senseCount = Number(parts[2]);
    const offsets = parts.slice(6 + ptrCount, 6 + ptrCount + senseCount);
    map.set(parts[0], offsets);
  }
  indexes[pos] = map;
  return map;
}

function readSynset(pos, offset) {
  const file = POS[pos === 's' ? 'a' : pos];
  fds[file] ??= fs.openSync(path.join(DICT, `data.${file}`), 'r');
  const buf = Buffer.alloc(8192);
  const n = fs.readSync(fds[file], buf, 0, buf.length, Number(offset));
  const line = buf.toString('utf8', 0, n).split('\n')[0];
  const [head, gloss = ''] = line.split(' | ');
  const p = head.split(' ');
  const wordCount = parseInt(p[3], 16);
  const words = [];
  for (let i = 0; i < wordCount; i++) words.push(p[4 + i * 2].replace(/\(.*\)$/, '').replace(/_/g, ' '));
  let i = 4 + wordCount * 2;
  const ptrCount = Number(p[i++]);
  const pointers = [];
  for (let k = 0; k < ptrCount; k++, i += 4) pointers.push({ symbol: p[i], offset: p[i + 1], pos: p[i + 2] });
  return { words, gloss: gloss.trim(), pointers };
}

const IRREGULAR = {
  said: 'say', went: 'go', gone: 'go', ran: 'run', saw: 'see', seen: 'see', took: 'take', taken: 'take', came: 'come',
  made: 'make', thought: 'think', knew: 'know', known: 'know', felt: 'feel', got: 'get', gotten: 'get', gave: 'give',
  given: 'give', found: 'find', told: 'tell', stood: 'stand', heard: 'hear', left: 'leave', held: 'hold', brought: 'bring',
  began: 'begin', begun: 'begin', kept: 'keep', wrote: 'write', written: 'write', sat: 'sit', spoke: 'speak', spoken: 'speak',
  fell: 'fall', fallen: 'fall', grew: 'grow', grown: 'grow', drew: 'draw', drawn: 'draw', threw: 'throw', thrown: 'throw',
  caught: 'catch', taught: 'teach', bought: 'buy', fought: 'fight', sought: 'seek', ate: 'eat', eaten: 'eat', drank: 'drink',
  slept: 'sleep', wept: 'weep', crept: 'creep', swept: 'sweep', lay: 'lie', lain: 'lie', rose: 'rise', risen: 'rise',
  woke: 'wake', woken: 'wake', shook: 'shake', broke: 'break', broken: 'break', chose: 'choose', chosen: 'choose',
  drove: 'drive', driven: 'drive', flew: 'fly', flown: 'fly', forgot: 'forget', forgotten: 'forget', hid: 'hide',
  hidden: 'hide', led: 'lead', lost: 'lose', meant: 'mean', met: 'meet', paid: 'pay', sent: 'send', spent: 'spend',
  struck: 'strike', swam: 'swim', tore: 'tear', torn: 'tear', understood: 'understand', wore: 'wear', worn: 'wear',
  won: 'win', men: 'man', women: 'woman', children: 'child', feet: 'foot', teeth: 'tooth', mice: 'mouse', people: 'person',
  rode: 'ride', ridden: 'ride', bit: 'bite', bitten: 'bite', hung: 'hang', sang: 'sing', sung: 'sing', sank: 'sink', sunk: 'sink',
  stole: 'steal', stolen: 'steal', froze: 'freeze', frozen: 'freeze', dug: 'dig', fled: 'flee', knelt: 'kneel',
  slid: 'slide', spun: 'spin', stuck: 'stick', swung: 'swing', clung: 'cling', strode: 'stride', bore: 'bear',
  became: 'become', bent: 'bend', bled: 'bleed', blew: 'blow', blown: 'blow', built: 'build', dealt: 'deal', did: 'do',
  done: 'do', fed: 'feed', forgave: 'forgive', forgiven: 'forgive', leapt: 'leap', lit: 'light', rang: 'ring', rung: 'ring',
  shone: 'shine', shot: 'shoot', shrank: 'shrink', sold: 'sell', sped: 'speed', sprang: 'spring', stung: 'sting',
  strove: 'strive', swore: 'swear', sworn: 'swear', wove: 'weave', woven: 'weave',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad',
};

function lemmas(word) {
  const w = word.toLowerCase();
  const out = [[w, null]];
  if (IRREGULAR[w]) out.push([IRREGULAR[w], 'past']);
  const rules = [
    [/ies$/, 'y', 's'], [/es$/, '', 's'], [/s$/, '', 's'],
    [/ied$/, 'y', 'ed'], [/ed$/, '', 'ed'], [/ed$/, 'e', 'ed'], [/(.)\1ed$/, '$1', 'ed'],
    [/ing$/, '', 'ing'], [/ing$/, 'e', 'ing'], [/(.)\1ing$/, '$1', 'ing'],
    [/ier$/, 'y', 'er'], [/er$/, '', 'er'], [/er$/, 'e', 'er'], [/iest$/, 'y', 'est'], [/est$/, '', 'est'], [/est$/, 'e', 'est'],
    [/ily$/, 'y', 'ly'],
  ];
  for (const [re, rep, infl] of rules) if (re.test(w)) out.push([w.replace(re, rep), infl]);
  return out;
}

const PAST = { lay: 'laid', tread: 'trod', lie: 'lay', bid: 'bid', cut: 'cut', hit: 'hit', put: 'put', set: 'set', shut: 'shut', let: 'let', hurt: 'hurt', cast: 'cast', quit: 'quit', spread: 'spread', read: 'read' };
for (const [form, base] of Object.entries(IRREGULAR)) if (!(base in PAST) && !/(er|est|en)$|^(men|women|children|feet|teeth|mice|people)$/.test(form)) PAST[base] = form;

const doubles = (w) => /^[^aeiou]*[aeiou][^aeiouwxy]$/.test(w);

function inflect(word, infl, pos) {
  if (!infl || word.includes(' ')) {
    if (!infl || !word.includes(' ')) return word;
    const [first, ...rest] = word.split(' ');
    return [inflect(first, infl, pos), ...rest].join(' ');
  }
  switch (infl) {
    case 's':
      if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
      if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
      return `${word}s`;
    case 'past':
    case 'ed':
      if (PAST[word]) return PAST[word];
      if (word.endsWith('e')) return `${word}d`;
      if (doubles(word)) return `${word}${word.at(-1)}ed`;
      if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ied`;
      return `${word}ed`;
    case 'ing':
      if (/ie$/.test(word)) return `${word.slice(0, -2)}ying`;
      if (/[^e]e$/.test(word)) return `${word.slice(0, -1)}ing`;
      if (doubles(word)) return `${word}${word.at(-1)}ing`;
      return `${word}ing`;
    case 'er':
    case 'est':
      if (pos !== 'a' || word.length > 7) return word;
      if (word.endsWith('e')) return word + infl.slice(1);
      if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}i${infl}`;
      return word + infl;
    default:
      return word;
  }
}

const STOP = new Set('a an the and or but if of to in on at by for with from as is was were be been are am it its this that these those he she they we you i me him her them my his their our your not no so than then there here what which who whom when where why how all any each very just into out up down over under again also through about after before would could should have had has did does do can will may might must shall own same such only other some more most one two'.split(' '));

let freq = null;
function familiarity(w) {
  if (!freq) {
    freq = new Map();
    for (const line of fs.readFileSync(path.join(DICT, 'index.sense'), 'utf8').split('\n')) {
      const sp = line.indexOf(' ');
      if (sp < 0) continue;
      const lemma = line.slice(0, line.indexOf('%'));
      const count = Number(line.slice(line.lastIndexOf(' ') + 1)) || 0;
      if (count) freq.set(lemma, (freq.get(lemma) || 0) + count);
    }
  }
  return freq.get(w.toLowerCase().replace(/ /g, '_')) || 0;
}

function contentWords(text) {
  return new Set(
    (text.toLowerCase().match(/[a-z]+/g) || [])
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => w.replace(/(ing|ed|es|s|ly)$/, '')),
  );
}

function overlap(a, b) {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

function lookup(word, sentence, posHint) {
  const context = contentWords(sentence);
  context.delete(word.toLowerCase().replace(/(ing|ed|es|s|ly)$/, ''));
  const senses = [];
  const seenSynsets = new Set();

  for (const pos of ['v', 'n', 'a', 'r']) {
    const index = loadIndex(pos);
    for (const [lemma, infl] of lemmas(word)) {
      const offsets = index.get(lemma.replace(/ /g, '_'));
      if (!offsets) continue;
      if (infl && ((pos === 'n' && infl !== 's') || (pos === 'v' && !['s', 'ed', 'past', 'ing'].includes(infl)) || (pos === 'a' && !['er', 'est'].includes(infl)) || pos === 'r')) continue;
      offsets.forEach((offset, rank) => {
        const key = `${pos}${offset}`;
        if (seenSynsets.has(key)) return;
        seenSynsets.add(key);
        const syn = readSynset(pos, offset);
        let words = syn.words.filter((w) => w.toLowerCase() !== lemma);
        let related = '';
        const relSymbols = pos === 'a' ? ['&', '^'] : pos === 'v' ? ['~'] : pos === 'n' ? ['~'] : [];
        const relWords = [];
        for (const ptr of syn.pointers.filter((x) => relSymbols.includes(x.symbol)).slice(0, pos === 'n' ? 12 : 60)) {
          const rel = readSynset(ptr.pos, ptr.offset);
          relWords.push(...rel.words.slice(0, 3));
          related += ` ${rel.gloss}`;
        }
        const proper = /^[A-Z]/.test(word);
        words = [...words, ...relWords]
          .filter((w, i, all) => w.toLowerCase() !== lemma && !w.toLowerCase().startsWith(`${lemma} `) && all.indexOf(w) === i && (proper || !/[A-Z]/.test(w)))
          .map((w) => ({ w, rank: familiarity(w) - (/[ -]/.test(w) ? 1000 : 0) + (syn.words.includes(w) ? 3 : 0) }))
          .sort((x, y) => y.rank - x.rank)
          .map((x) => x.w);
        if (!words.length) return;
        const score =
          overlap(context, contentWords(`${syn.gloss} ${syn.words.join(' ')}`)) * 3 +
          Math.min(2, overlap(context, contentWords(related))) +
          (posHint && posHint === pos ? 4 : 0) +
          4 / (rank + 1);
        senses.push({
          pos,
          gloss: syn.gloss.split(';')[0],
          score,
          words: words.slice(0, 10).map((w) => inflect(w, infl, pos)),
        });
      });
    }
  }
  senses.sort((a, b) => b.score - a.score);
  return senses.slice(0, 5);
}

module.exports = { lookup };
