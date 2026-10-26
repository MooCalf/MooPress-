import { app, h } from '../app.js';
import { setSetting } from '../settings.js';
import { selectTab } from '../ribbon.js';
import { openView } from '../editor.js';
import { refreshIcons } from '../ui.js';
import { logoLockup } from '../assets.js';

const STEPS = [
  {
    title: 'Welcome to MooPress',
    body: 'A word processor made for writing books. This quick tour shows you the tools that make it special. It takes about two minutes.',
    hero: true,
  },
  {
    target: '#ribbon-tabs',
    title: 'The ribbon',
    body: 'Every tool lives in these tabs, just like Word. Hover any button to see what it does and its keyboard shortcut.',
  },
  {
    target: '#sidebar .chapter-list',
    title: 'Chapters',
    body: 'Your book is split into chapters. Add one with the + button, drag chapters to reorder them, and double-click a name to rename it.',
  },
  {
    target: '#sidebar .title-item',
    title: 'Title page',
    body: 'Set your title, subtitle, author name and dedication. It’s printed first whenever you export or print your book.',
  },
  {
    target: '#paper',
    title: 'Your page',
    body: 'Write here. The dashed lines show where each printed page ends. Page size, margins, fonts and page numbers are in the Layout tab.',
  },
  {
    target: '#paper',
    title: 'Quick tools',
    body: 'Select some text and a faint palette of tools appears beside it. Right-click and those same tools fly out into a ring around your pointer.',
  },
  {
    target: '#paper',
    title: 'Smart synonyms',
    body: 'Double-click any word for synonyms that fit your sentence. The “bank” of a river gets different suggestions from a bank you keep money in.',
  },
  {
    target: '#paper',
    title: 'Snippets',
    body: 'Type / and a trigger such as /sig or /chapter, then press Enter to drop in a saved block of text. Make your own in Settings → Snippets.',
  },
  {
    target: '#sidebar .sb-bible',
    title: 'Story Settings',
    body: 'Keep notes and pictures for your characters, places and terms. Their names get a faint underline in your writing; hover one to see its card.',
  },
  {
    target: '#ribbon',
    tab: 'review',
    title: 'Review tools',
    body: 'Spelling & grammar, the Cliché & fluff detector with a live readability score, and the Time Machine: slide back through the last 10 minutes to rescue a deleted paragraph.',
  },
  {
    target: '#ribbon',
    tab: 'view',
    title: 'Ways to write',
    body: 'Zen mode hides everything except your words. Typewriter scrolling keeps the line you’re typing in the middle of the screen. Dark mode and zoom are here too.',
  },
  {
    target: '[data-action="clipboardSlots"]',
    tab: 'home',
    title: 'Clipboard slots',
    body: 'Your last five copies are kept. Paste any of them with Ctrl+1 to Ctrl+5, or pick one from this list.',
  },
  {
    target: '#statusbar',
    title: 'At a glance',
    body: 'Your word count, how long the chapter takes to read, and which page you’re on. Select some text to count just that part.',
  },
  {
    target: '#ribbon',
    tab: 'file',
    title: 'Your Library',
    body: 'The File tab lists every book in your save folder. Click one to open it. You can change the save folder in Settings.',
  },
  {
    target: '#ribbon',
    tab: 'file',
    title: 'Open and save anything',
    body: 'Open Word, PDF, OpenDocument, RTF, text and Markdown files, and save back to them, or keep everything in a MooPress book. Export a print-ready PDF any time.',
  },
  {
    target: '#ribbon',
    tab: 'settings',
    title: 'Make it yours',
    body: 'Change any keyboard shortcut, where your books are saved, autosave and more. You can replay this tour any time from Settings → General.',
  },
  {
    title: 'You’re all set',
    body: 'Happy writing! Your first chapter is ready and waiting.',
    hero: true,
    finish: true,
  },
];

let tour = null;

function place() {
  if (!tour) return;
  const step = STEPS[tour.index];
  const { spot, cardEl } = tour;
  const target = step.target && document.querySelector(step.target);
  const visible = target && target.getClientRects().length;
  if (!visible) {
    spot.classList.add('none');
    cardEl.classList.add('centred');
    cardEl.style.left = '';
    cardEl.style.top = '';
    return;
  }
  cardEl.classList.remove('centred');
  spot.classList.remove('none');
  const r = target.getBoundingClientRect();
  const pad = 8;
  const box = {
    left: Math.max(4, r.left - pad),
    top: Math.max(4, r.top - pad),
    right: Math.min(window.innerWidth - 4, r.right + pad),
    bottom: Math.min(window.innerHeight - 4, r.bottom + pad),
  };
  Object.assign(spot.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.right - box.left}px`, height: `${box.bottom - box.top}px` });

  const cw = cardEl.offsetWidth;
  const ch = cardEl.offsetHeight;
  const gap = 16;
  let left;
  let top;
  if (window.innerHeight - box.bottom > ch + gap) {
    top = box.bottom + gap;
    left = (box.left + box.right) / 2 - cw / 2;
  } else if (box.top > ch + gap) {
    top = box.top - ch - gap;
    left = (box.left + box.right) / 2 - cw / 2;
  } else if (window.innerWidth - box.right > cw + gap) {
    left = box.right + gap;
    top = (box.top + box.bottom) / 2 - ch / 2;
  } else if (box.left > cw + gap) {
    left = box.left - cw - gap;
    top = (box.top + box.bottom) / 2 - ch / 2;
  } else {
    left = (window.innerWidth - cw) / 2;
    top = (window.innerHeight - ch) / 2;
  }
  cardEl.style.left = `${Math.max(12, Math.min(left, window.innerWidth - cw - 12))}px`;
  cardEl.style.top = `${Math.max(12, Math.min(top, window.innerHeight - ch - 12))}px`;
}

function render() {
  const step = STEPS[tour.index];
  const total = STEPS.length;
  if (step.tab) selectTab(step.tab);
  const back = h('button.btn', { onclick: () => go(-1), disabled: tour.index === 0 }, 'Back');
  const next = h('button.btn.primary', { onclick: () => (step.finish ? end() : go(1)) }, step.finish ? 'Start writing' : tour.index === 0 ? 'Start the tour' : 'Next');
  tour.cardEl.replaceChildren(
    ...[
    step.hero && logoLockup('tour-logo'),
    !step.hero && h('div.tour-count', {}, `${tour.index} of ${total - 2}`),
    h('h2', {}, step.title),
    h('p', {}, step.body),
    h('div.tour-dots', {}, STEPS.map((_, i) => h(`span${i === tour.index ? '.on' : i < tour.index ? '.done' : ''}`))),
    h(
      'div.tour-actions',
      {},
      !step.finish && h('button.tour-skip', { onclick: end }, 'Skip tour'),
      h('span.tour-spacer'),
      tour.index > 0 && back,
      next,
    ),
    ].filter(Boolean),
  );
  refreshIcons(tour.cardEl);
  requestAnimationFrame(place);
  setTimeout(place, 60);
  next.focus();
}

function go(dir) {
  tour.index = Math.max(0, Math.min(STEPS.length - 1, tour.index + dir));
  render();
}

function onKey(e) {
  if (!tour) return;
  if (e.key === 'Escape') end();
  else if (e.key === 'ArrowRight') go(1);
  else if (e.key === 'ArrowLeft') go(-1);
  else return;
  e.preventDefault();
  e.stopPropagation();
}

export function startTour() {
  if (tour) return;
  if (app.view === 'title' && app.project.chapters[0]) openView(app.project.chapters[0].id);
  if (!app.settings.sidebarVisible) setSetting('sidebarVisible', true);
  if (app.settings.ribbonCollapsed) setSetting('ribbonCollapsed', false);
  document.body.classList.remove('focus-mode', 'zen');
  const spot = h('div.tour-spot.none');
  const cardEl = h('div.tour-card', { role: 'dialog', 'aria-label': 'MooPress tour' });
  const el = h('div.tour', {}, spot, cardEl);
  document.body.append(el);
  tour = { el, spot, cardEl, index: 0, tab: null };
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', place);
  render();
  requestAnimationFrame(() => el.classList.add('show'));
}

function end() {
  if (!tour) return;
  const { el } = tour;
  tour = null;
  el.classList.remove('show');
  setTimeout(() => el.remove(), 200);
  document.removeEventListener('keydown', onKey, true);
  window.removeEventListener('resize', place);
  setSetting('tourDone', true);
  selectTab('home');
  app.editor?.commands.focus();
}
