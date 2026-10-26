const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'jr', 'sr', 'vs', 'etc', 'e.g', 'i.e', 'prof', 'mt', 'no', 'vol', 'fig', 'approx', 'inc', 'ltd', 'co']);
const AN_EXCEPTIONS = /^(hour|honest|honor|honour|heir|herb)/i;
const A_EXCEPTIONS = /^(uni|use|usu|uti|ure|euro|eu|one|once|ubiq|ufo|ukr|uru)/i;

const CONFUSIONS = [
  [/\b(could|should|would|must|might) of\b/gi, (m) => `${m[1]} have`, 'Did you mean “have”? “Of” is not a verb.'],
  [/\balot\b/gi, () => 'a lot', '“A lot” is two words.'],
  [/\birregardless\b/gi, () => 'regardless', 'Use “regardless”.'],
  [/\bfor all intensive purposes\b/gi, () => 'for all intents and purposes', 'The phrase is “for all intents and purposes”.'],
  [/\b(better|worse|more|less|rather|greater|smaller|larger|older|younger|faster|slower|other) then\b/gi, (m) => `${m[1]} than`, 'Use “than” for comparisons.'],
  [/\byour (welcome|right|wrong|going|not)\b/gi, (m) => `you’re ${m[1]}`, 'Did you mean “you’re” (you are)?'],
  [/\bits (a|an|the|been|not|going|time|ok|okay)\b/gi, (m) => `it’s ${m[1]}`, 'Did you mean “it’s” (it is / it has)?'],
  [/\bnoone\b/gi, () => 'no one', '“No one” is two words.'],
  [/\bsuppose to\b/gi, () => 'supposed to', 'Use “supposed to”.'],
  [/\buse to\b(?= (be|have|do|go|live|work|think|say))/gi, () => 'used to', 'Use “used to” for past habits.'],
  [/\bloose (weight|track|control)\b/gi, (m) => `lose ${m[1]}`, 'Did you mean “lose”?'],
  [/\bmute point\b/gi, () => 'moot point', 'The phrase is “moot point”.'],
  [/\bfirstly\b/gi, () => 'first', 'Consider the simpler “first”.', 'style'],
  [/\bin order to\b/gi, () => 'to', '“To” usually works just as well.', 'style'],
];

const STYLE_FILLERS = /\b(very|really|quite|somewhat|basically|actually|literally)\s+(\w+)/gi;
const PASSIVE = /\b(am|is|are|was|were|be|been|being)\s+(\w+(?:ed|en))\b/gi;
const PASSIVE_SKIP = new Set(['open', 'even', 'often', 'seven', 'eleven', 'heaven', 'garden', 'sudden', 'golden', 'wooden', 'hidden', 'children', 'ten', 'when', 'then', 'listen', 'happen', 'kitten', 'need', 'feed', 'seed', 'red', 'bed', 'tired', 'scared', 'bored', 'interested', 'excited', 'worried', 'married', 'used', 'supposed', 'pleased']);

function issue(start, end, message, category, replacements = []) {
  return { start, end, message, category, replacements };
}

export function checkText(text, { style = false } = {}) {
  const out = [];
  let m;

  const repeated = /\b(\w+)(\s+)(\1)\b/gi;
  while ((m = repeated.exec(text))) {
    if (/^(had|that|is|very|so|no|bye|ha|knock|tsk|now|well|yes|chop|blah|hush)$/i.test(m[1])) continue;
    const start = m.index + m[1].length;
    out.push(issue(start, start + m[2].length + m[3].length, `Repeated word: “${m[1]}”.`, 'grammar', ['']));
  }

  const spaces = /(?<=\S) {2,}(?=\S)/g;
  while ((m = spaces.exec(text))) out.push(issue(m.index, m.index + m[0].length, 'Extra spaces between words.', 'grammar', [' ']));

  const spaceBefore = /(?<=\w) +([,;:!?]|\.(?!\.))(?=\s|$)/g;
  while ((m = spaceBefore.exec(text))) out.push(issue(m.index, m.index + m[0].length, 'Remove the space before this punctuation.', 'grammar', [m[1]]));

  const noSpace = /(?<=[a-z])([,;])(?=[A-Za-z])/g;
  while ((m = noSpace.exec(text))) out.push(issue(m.index, m.index + 1, 'Add a space after this punctuation.', 'grammar', [`${m[1]} `]));

  const sentence = /([.!?])(["”’)]?)\s+([a-z])/g;
  while ((m = sentence.exec(text))) {
    if (m[2]) continue;
    const before = text.slice(0, m.index);
    const lastWord = (before.match(/([\w.]+)$/)?.[1] || '').toLowerCase();
    if (m[1] === '.' && (ABBREVIATIONS.has(lastWord) || /\.\w$/.test(lastWord) || /^\d+$/.test(lastWord))) continue;
    if (text.slice(m.index - 2, m.index + 1) === '...') continue;
    const at = m.index + m[0].length - 1;
    out.push(issue(at, at + 1, 'Start a new sentence with a capital letter.', 'grammar', [m[3].toUpperCase()]));
  }
  const first = text.match(/^\s*(["“‘(]?)([a-z])/);
  if (first && !/^\s*(e\.g|i\.e|etc)\b/i.test(text)) {
    const at = first[0].length - 1;
    out.push(issue(at, at + 1, 'Start a new sentence with a capital letter.', 'grammar', [first[2].toUpperCase()]));
  }

  const loneI = /(?<![\w'’-])i(?=[\s,.!?;:'’]|$)/g;
  while ((m = loneI.exec(text))) {
    if (text[m.index + 1] === '.' && text[m.index + 2] === 'e') continue;
    out.push(issue(m.index, m.index + 1, 'The word “I” is always capitalised.', 'grammar', ['I']));
  }

  const article = /\b(a|an|A|An)\s+([A-Za-z][\w-]*)/g;
  while ((m = article.exec(text))) {
    const [, art, word] = m;
    const acronym = /^[A-Z]{2,}$/.test(word);
    const vowelSound = acronym ? /^[AEFHILMNORSX]/.test(word) : (/^[aeiou]/i.test(word) && !A_EXCEPTIONS.test(word)) || AN_EXCEPTIONS.test(word);
    const isAn = art.toLowerCase() === 'an';
    if (vowelSound && !isAn) out.push(issue(m.index, m.index + art.length, `Use “an” before “${word}”.`, 'grammar', [art === 'A' ? 'An' : 'an']));
    if (!vowelSound && isAn) out.push(issue(m.index, m.index + art.length, `Use “a” before “${word}”.`, 'grammar', [art === 'An' ? 'A' : 'a']));
  }

  for (const [re, fix, message, category = 'grammar'] of CONFUSIONS) {
    if (category === 'style' && !style) continue;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      const rep = fix(m);
      out.push(issue(m.index, m.index + m[0].length, message, category, [matchCase(m[0], rep)]));
    }
  }

  if (style) {
    while ((m = STYLE_FILLERS.exec(text))) {
      out.push(issue(m.index, m.index + m[1].length, `“${m[1]}” often weakens writing. Try a stronger word instead of “${m[1]} ${m[2]}”.`, 'style', ['']));
    }
    while ((m = PASSIVE.exec(text))) {
      if (PASSIVE_SKIP.has(m[2].toLowerCase())) continue;
      out.push(issue(m.index, m.index + m[0].length, 'Possible passive voice. Active voice is often clearer.', 'style'));
    }
    const sentences = /[^.!?]+[.!?]*/g;
    while ((m = sentences.exec(text))) {
      const words = m[0].trim().split(/\s+/).filter(Boolean).length;
      if (words > 40) {
        const lead = m[0].length - m[0].trimStart().length;
        out.push(issue(m.index + lead, m.index + m[0].trimEnd().length, `Long sentence (${words} words). Consider splitting it.`, 'style'));
      }
    }
  }

  return dedupe(out);
}

function matchCase(original, replacement) {
  if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function dedupe(list) {
  const seen = new Set();
  return list
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter((i) => {
      const k = `${i.start}:${i.end}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}
