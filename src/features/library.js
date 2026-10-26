import { app, h, icon, on } from '../app.js';
import { saveFolder } from '../folders.js';
import { openBook } from '../fileops.js';
import { setSetting } from '../settings.js';
import { refreshIcons, toast } from '../ui.js';
import { FORMAT_NAMES } from '../formats/index.js';

let strip = null;
let label = null;
let loading = 0;

function ago(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'Edited just now';
  if (s < 3600) return `Edited ${Math.round(s / 60)} min ago`;
  if (s < 86400) return `Edited ${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 7) return `Edited ${Math.round(s / 86400)} d ago`;
  return `Edited ${new Date(ms).toLocaleDateString(undefined, { dateStyle: 'medium' })}`;
}

function thumbnail(f) {
  const lines = (f.firstText || '').split('\n').filter(Boolean).slice(0, 7);
  const page = h('div.lib-thumb');
  if (f.ext === 'moopress' && f.title) {
    page.append(h('div.lt-cover', {}, h('div.lt-title', {}, f.title), f.author && h('div.lt-author', {}, f.author)));
  } else {
    if (f.chapterTitle) page.append(h('div.lt-heading', {}, f.chapterTitle));
    if (lines.length) page.append(h('div.lt-text', {}, lines.map((l) => h('p', {}, l))));
    if (!f.chapterTitle && !lines.length) page.append(h('div.lt-blank', {}, icon('file-text')));
  }
  if (f.ext !== 'moopress') page.append(h('span.lt-badge', {}, f.ext.toUpperCase()));
  return page;
}

function card(f) {
  const title = f.title || f.chapterTitle || f.name.replace(/\.[^.]+$/, '');
  const c = h(
    `button.lib-card${app.filePath === f.path ? '.current' : ''}`,
    { 'data-tip': f.path, 'data-desc': `${FORMAT_NAMES[f.ext] || f.ext.toUpperCase()}${f.chapters ? ` · ${f.chapters} ${f.chapters === 1 ? 'chapter' : 'chapters'}` : ''}. Click to open.` },
    thumbnail(f),
    h('span.lib-meta', {}, h('strong.lib-title', {}, title), h('span.lib-name', {}, f.name), h('span.lib-date', {}, ago(f.modified))),
  );
  c.addEventListener('click', () => openBook(f.path));
  return c;
}

export async function refreshLibrary() {
  if (!strip) return;
  const token = ++loading;
  const folder = await saveFolder();
  if (label) label.textContent = `Books in ${folder.split(/[\\/]/).pop() || folder}`;
  try {
    const { files } = await window.moopress.listLibrary(folder);
    if (token !== loading || !strip) return;
    strip.replaceChildren(
      ...(files.length
        ? files.map(card)
        : [h('div.lib-empty', {}, icon('library'), h('span', {}, 'No books here yet. Save a book and it will show up in your Library.'))]),
    );
  } catch (err) {
    strip.replaceChildren(h('div.lib-empty', {}, icon('alert-circle'), h('span', {}, `Couldn’t read this folder: ${err.message}`)));
  }
  refreshIcons(strip);
}

export async function changeSaveFolder() {
  const picked = await window.moopress.pickFolder(await saveFolder());
  if (!picked) return null;
  setSetting('saveFolder', picked);
  toast(`Books will now be saved in ${picked}`, 'success', 3500);
  return picked;
}

export async function openSaveFolder() {
  window.moopress.openFolder(await saveFolder());
}

export function libraryPanel(group, large) {
  strip = h('div.lib-strip', {}, h('div.lib-empty', {}, 'Loading your books…'));
  label = h('span');
  refreshLibrary();
  return [
    group(
      'Library',
      large(null, 'rotate-cw', 'Refresh', { tip: 'Refresh', desc: 'Look for new or changed books in your save folder.', onClick: refreshLibrary }),
      large(null, 'folder-open', 'Open folder', { tip: 'Open folder', desc: 'Show your save folder in File Explorer.', onClick: openSaveFolder }),
      large(null, 'folder-cog', 'Change folder', { tip: 'Change folder', desc: 'Choose where MooPress saves your books.', onClick: changeSaveFolder }),
    ),
    h('div.rb-group.lib-group', {}, h('div.rb-group-body', {}, strip), h('div.rb-group-label', {}, label)),
  ];
}

on('saved', () => refreshLibrary());
on('settings-changed', (key) => { if (key === 'saveFolder') refreshLibrary(); });
