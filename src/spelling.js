import { app } from './app.js';

let loading = null;
const suggestionCache = new Map();

function nativeChecker() {
  try {
    if (window.moopress.isMisspelled('teh') !== true) return null;
  } catch {
    return null;
  }
  return {
    correct: (w) => !window.moopress.isMisspelled(w),
    suggest: (w) => window.moopress.suggestions(w) || [],
    add: () => {},
  };
}

async function bundledChecker() {
  const [{ default: nspell }, { default: aff }, { default: dic }] = await Promise.all([
    import('nspell'),
    import('@dictionary-en/index.aff?raw'),
    import('@dictionary-en/index.dic?raw'),
  ]);
  const speller = nspell(aff, dic);
  return {
    correct: (w) => speller.correct(w),
    suggest: (w) => speller.suggest(w),
    add: (w) => speller.add(w),
  };
}

export function getSpeller() {
  if (!loading) {
    loading = (async () => nativeChecker() || bundledChecker())().catch((err) => {
      console.error('Spell checker unavailable', err);
      loading = null;
      return { correct: () => true, suggest: () => [], add: () => {} };
    });
  }
  return loading;
}

export function normalizeWord(w) {
  return w.replace(/’/g, "'");
}

export async function suggestionsFor(word) {
  const key = normalizeWord(word);
  if (!suggestionCache.has(key)) {
    const speller = await getSpeller();
    const swaps = [];
    for (let i = 0; i < key.length - 1; i++) {
      const s = key.slice(0, i) + key[i + 1] + key[i] + key.slice(i + 2);
      if (s !== key && speller.correct(s)) swaps.push(s);
      const lower = s.toLowerCase();
      if (lower !== s && speller.correct(lower)) swaps.push(s[0].toUpperCase() + lower.slice(1));
    }
    suggestionCache.set(key, [...new Set([...swaps, ...speller.suggest(key)])].slice(0, 5));
  }
  return suggestionCache.get(key);
}

export async function rememberWord(word) {
  (await getSpeller()).add(normalizeWord(word));
  if (!app.project.ignoredWords.includes(word)) app.project.ignoredWords.push(word);
}
