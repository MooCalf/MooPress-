const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const thesaurus = require('./thesaurus.cjs');
const convert = require('./convert.cjs');
const fs = require('fs/promises');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const OPENABLE = ['moopress', 'docx', 'docm', 'dotx', 'dotm', 'doc', 'dot', 'odt', 'rtf', 'txt', 'md', 'markdown', 'html', 'htm', 'pdf'];
const OPEN_FILTERS = [
  { name: 'All documents', extensions: OPENABLE },
  { name: 'MooPress Book', extensions: ['moopress'] },
  { name: 'Word Document', extensions: ['docx', 'docm', 'dotx', 'dotm', 'doc', 'dot'] },
  { name: 'OpenDocument Text', extensions: ['odt'] },
  { name: 'Rich Text Format', extensions: ['rtf'] },
  { name: 'PDF', extensions: ['pdf'] },
  { name: 'Plain Text', extensions: ['txt'] },
  { name: 'Markdown', extensions: ['md', 'markdown'] },
  { name: 'Web Page', extensions: ['html', 'htm'] },
  { name: 'All Files', extensions: ['*'] },
];
const SAVE_FORMATS = [
  { ext: 'moopress', name: 'MooPress Book' },
  { ext: 'docx', name: 'Word Document' },
  { ext: 'pdf', name: 'PDF' },
  { ext: 'odt', name: 'OpenDocument Text' },
  { ext: 'rtf', name: 'Rich Text Format' },
  { ext: 'txt', name: 'Plain Text' },
  { ext: 'md', name: 'Markdown' },
  { ext: 'html', name: 'Web Page' },
];
const RENDERER_FORMATS = ['odt', 'rtf', 'txt', 'html', 'htm'];
const ICON = path.join(__dirname, '..', 'build', 'icon.png');
const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml' };

let win = null;
let dirty = false;
let allowClose = false;

const userFile = (name) => path.join(app.getPath('userData'), name);
const SETTINGS_FILE = () => userFile('settings.json');
const RECOVERY_FILE = () => userFile('recovery.moopress');

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeAtomic(file, contents) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, contents);
  await fs.rename(tmp, file);
}

function fileFromArgs(argv, skip) {
  return argv.slice(skip).find((a) => !a.startsWith('-') && OPENABLE.includes(convert.extOf(a))) || null;
}

function launchFile() {
  return fileFromArgs(process.argv, app.isPackaged ? 1 : 2);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 620,
    title: 'MooPress',
    icon: ICON,
    backgroundColor: '#f4f2ef',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });

  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  win.webContents.on('will-navigate', (e, url) => {
    if (!(DEV_URL && url.startsWith(DEV_URL))) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('context-menu', (_e, params) => showContextMenu(params));
  win.webContents.on('before-input-event', (_e, input) => {
    if (DEV_URL && input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
  });

  win.on('close', (e) => {
    if (!dirty || allowClose) return;
    e.preventDefault();
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'MooPress',
      message: 'Do you want to save the changes to your book?',
      detail: "If you don't save, your latest changes will be lost.",
    });
    if (choice === 0) {
      win.webContents.send('app:save-and-close');
    } else if (choice === 1) {
      fs.unlink(RECOVERY_FILE()).catch(() => {});
      allowClose = true;
      win.close();
    }
  });
}

function showContextMenu(p) {
  const wc = win.webContents;
  const items = [];
  if (p.misspelledWord) {
    for (const s of p.dictionarySuggestions.slice(0, 6)) {
      items.push({ label: s, click: () => wc.replaceMisspelling(s) });
    }
    if (!p.dictionarySuggestions.length) items.push({ label: 'No suggestions', enabled: false });
    items.push(
      { label: 'Add to Dictionary', click: () => wc.session.addWordToSpellCheckerDictionary(p.misspelledWord) },
      { type: 'separator' },
    );
  }
  if (p.isEditable) {
    items.push(
      { label: 'Cut', enabled: p.editFlags.canCut, click: () => wc.cut() },
      { label: 'Copy', enabled: p.editFlags.canCopy, click: () => wc.copy() },
      { label: 'Paste', enabled: p.editFlags.canPaste, click: () => wc.paste() },
      { label: 'Paste as Plain Text', enabled: p.editFlags.canPaste, click: () => wc.pasteAndMatchStyle() },
      { type: 'separator' },
      { label: 'Select All', click: () => wc.selectAll() },
    );
  } else if (p.selectionText) {
    items.push({ label: 'Copy', click: () => wc.copy() });
  }
  if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
}

async function renderHidden(html) {
  const tmp = path.join(app.getPath('temp'), `moopress-${Date.now()}.html`);
  await fs.writeFile(tmp, html, 'utf8');
  const w = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } });
  await w.loadFile(tmp);
  return {
    w,
    dispose() {
      if (!w.isDestroyed()) w.destroy();
      fs.unlink(tmp).catch(() => {});
    },
  };
}

function defaultFolder() {
  return path.join(app.getPath('documents'), 'MooPress');
}

const libraryCache = new Map();

function textOfDoc(node, out = []) {
  if (!node || out.join(' ').length > 600) return out;
  if (node.type === 'text') out.push(node.text);
  for (const child of node.content || []) {
    textOfDoc(child, out);
    if (['paragraph', 'heading'].includes(child.type)) out.push('\n');
  }
  return out;
}

async function describeFile(file, ext, buffer) {
  if (ext === 'moopress') {
    const book = JSON.parse(buffer.toString('utf8'));
    const first = book.chapters?.[0];
    return {
      title: book.title || '',
      author: book.author || '',
      chapterTitle: first?.title || '',
      firstText: textOfDoc(first?.content).join('').replace(/\n+/g, '\n').trim().slice(0, 500),
      chapters: book.chapters?.length || 0,
    };
  }
  let text = '';
  if (['txt', 'md', 'markdown'].includes(ext)) text = buffer.toString('utf8', 0, 4000);
  else if (['html', 'htm'].includes(ext)) text = buffer.toString('utf8', 0, 20000).replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ');
  else if (['docx', 'docm', 'dotx', 'dotm'].includes(ext) && buffer.length < 15e6) text = (await require('mammoth').extractRawText({ buffer })).value;
  else if (ext === 'rtf') text = buffer.toString('latin1', 0, 30000).replace(/\\par[d]?/g, '\n').replace(/\{\\\*[^{}]*\}|\\[a-z]+-?\d* ?|[{}]/gi, '');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return { title: '', author: '', chapterTitle: lines[0]?.slice(0, 80) || '', firstText: lines.slice(1).join('\n').slice(0, 500), chapters: 0 };
}

async function listLibrary(folder) {
  folder = folder || defaultFolder();
  await fs.mkdir(folder, { recursive: true });
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = convert.extOf(entry.name);
    if (!OPENABLE.includes(ext) || entry.name.startsWith('~$')) continue;
    const file = path.join(folder, entry.name);
    const stat = await fs.stat(file);
    const key = `${file}|${stat.mtimeMs}`;
    let info = libraryCache.get(key);
    if (!info) {
      try {
        info = await describeFile(file, ext, await fs.readFile(file));
      } catch {
        info = { title: '', author: '', chapterTitle: '', firstText: '', chapters: 0 };
      }
      libraryCache.set(key, info);
    }
    files.push({ path: file, name: entry.name, ext, modified: stat.mtimeMs, size: stat.size, ...info });
  }
  files.sort((a, b) => b.modified - a.modified);
  return { folder, files: files.slice(0, 300) };
}

async function askSavePath(title, suggestedName, filters) {
  const r = await dialog.showSaveDialog(win, { title, defaultPath: suggestedName, filters });
  return r.canceled ? null : r.filePath;
}

function registerIpc() {
  ipcMain.on('app:set-dirty', (_e, v) => { dirty = !!v; });
  ipcMain.on('app:close-now', () => { allowClose = true; win.close(); });
  ipcMain.handle('app:launch-file', () => launchFile());

  ipcMain.handle('file:open', async (_e, filePath, folder) => {
    if (!filePath) {
      const r = await dialog.showOpenDialog(win, { title: 'Open', defaultPath: folder || undefined, filters: OPEN_FILTERS, properties: ['openFile'] });
      if (r.canceled) return null;
      filePath = r.filePaths[0];
    }
    const ext = convert.extOf(filePath);
    const buffer = await fs.readFile(filePath);
    if (ext === 'moopress') return { path: filePath, ext, data: JSON.parse(buffer.toString('utf8')) };
    if (RENDERER_FORMATS.includes(ext)) return { path: filePath, ext, bytes: new Uint8Array(buffer) };
    const html = await convert.toHtml(ext, buffer);
    if (html == null) throw new Error(`MooPress can't open .${ext} files.`);
    return { path: filePath, ext, html };
  });

  ipcMain.handle('file:choose-save', async (_e, { suggestedName, ext = 'moopress', folder }) => {
    const first = SAVE_FORMATS.find((f) => f.ext === ext) || SAVE_FORMATS[0];
    const filters = [first, ...SAVE_FORMATS.filter((f) => f !== first)].map((f) => ({ name: `${f.name} (*.${f.ext})`, extensions: [f.ext] }));
    const safeName = (suggestedName || 'Untitled Book').replace(/[<>:"/\\|?*]/g, '');
    if (folder) await fs.mkdir(folder, { recursive: true });
    const r = await dialog.showSaveDialog(win, { title: 'Save As', defaultPath: path.join(folder || '', `${safeName}.${first.ext}`), filters });
    if (r.canceled || !r.filePath) return null;
    const chosen = convert.extOf(r.filePath);
    return SAVE_FORMATS.some((f) => f.ext === chosen) ? r.filePath : `${r.filePath}.${first.ext}`;
  });

  ipcMain.handle('file:write', async (_e, { path: filePath, json, text, bytes, html, layout }) => {
    const ext = convert.extOf(filePath);
    if (ext === 'moopress') await writeAtomic(filePath, JSON.stringify(json));
    else if (ext === 'docx') await writeAtomic(filePath, await convert.htmlToDocx(html, layout));
    else if (ext === 'md') await writeAtomic(filePath, convert.htmlToMd(html));
    else if (ext === 'pdf') {
      const r = await renderHidden(html);
      try {
        await writeAtomic(filePath, await r.w.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true }));
      } finally {
        r.dispose();
      }
    } else if (bytes) await writeAtomic(filePath, Buffer.from(bytes));
    else await writeAtomic(filePath, text ?? html ?? '');
    return filePath;
  });

  ipcMain.handle('export:html', async (_e, { html, suggestedName }) => {
    const out = await askSavePath('Export as Web Page', `${suggestedName}.html`, [{ name: 'Web Page', extensions: ['html'] }]);
    if (!out) return null;
    await fs.writeFile(out, html, 'utf8');
    return out;
  });

  ipcMain.handle('export:pdf', async (_e, { html, suggestedName }) => {
    const out = await askSavePath('Export as PDF', `${suggestedName}.pdf`, [{ name: 'PDF Document', extensions: ['pdf'] }]);
    if (!out) return null;
    const r = await renderHidden(html);
    try {
      const pdf = await r.w.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true });
      await fs.writeFile(out, pdf);
    } finally {
      r.dispose();
    }
    shell.openPath(out);
    return out;
  });

  ipcMain.handle('print', async (_e, { html }) => {
    const r = await renderHidden(html);
    return new Promise((resolve) => {
      r.w.webContents.print({ silent: false, printBackground: true }, (ok, reason) => {
        r.dispose();
        resolve({ ok, reason });
      });
    });
  });

  ipcMain.handle('image:pick', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Insert Picture',
      filters: [{ name: 'Images', extensions: Object.keys(IMAGE_TYPES) }],
      properties: ['openFile'],
    });
    if (r.canceled) return null;
    const file = r.filePaths[0];
    const ext = path.extname(file).slice(1).toLowerCase();
    const buf = await fs.readFile(file);
    return { name: path.basename(file), size: buf.length, dataUrl: `data:${IMAGE_TYPES[ext] || 'image/png'};base64,${buf.toString('base64')}` };
  });

  ipcMain.handle('settings:load', () => readJson(SETTINGS_FILE(), null));
  ipcMain.handle('settings:save', (_e, s) => writeAtomic(SETTINGS_FILE(), JSON.stringify(s, null, 2)));

  ipcMain.handle('recovery:read', () => readJson(RECOVERY_FILE(), null));
  ipcMain.handle('recovery:write', (_e, data) => writeAtomic(RECOVERY_FILE(), JSON.stringify(data)));
  ipcMain.handle('recovery:clear', () => fs.unlink(RECOVERY_FILE()).catch(() => {}));

  ipcMain.handle('spell:add-word', (e, word) => e.sender.session.addWordToSpellCheckerDictionary(word));
  ipcMain.handle('spell:languages', (e) => ({
    available: e.sender.session.availableSpellCheckerLanguages,
    current: e.sender.session.getSpellCheckerLanguages(),
  }));
  ipcMain.handle('spell:set-language', (e, lang) => {
    try {
      e.sender.session.setSpellCheckerLanguages([lang]);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('thesaurus:lookup', (_e, { word, sentence, pos }) => {
    try {
      return thesaurus.lookup(String(word).slice(0, 60), String(sentence).slice(0, 600), pos || '');
    } catch (err) {
      console.error(err);
      return [];
    }
  });

  ipcMain.on('window:fullscreen', (_e, on) => win.setFullScreen(!!on));

  ipcMain.handle('folder:default', () => defaultFolder());
  ipcMain.handle('folder:pick', async (_e, current) => {
    const r = await dialog.showOpenDialog(win, { title: 'Choose where to save your books', defaultPath: current || defaultFolder(), properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('folder:open', async (_e, folder) => {
    await fs.mkdir(folder, { recursive: true });
    return shell.openPath(folder);
  });
  ipcMain.handle('library:list', (_e, folder) => listLibrary(folder));

  const editCommands = {
    cut: (wc) => wc.cut(),
    copy: (wc) => wc.copy(),
    paste: (wc) => wc.paste(),
    pastePlain: (wc) => wc.pasteAndMatchStyle(),
    selectAll: (wc) => wc.selectAll(),
  };
  ipcMain.handle('edit', (e, cmd) => editCommands[cmd]?.(e.sender));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
    const file = fileFromArgs(argv, 1);
    if (file) win.webContents.send('app:open-file', file);
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    registerIpc();
    createWindow();
  });
}

app.on('window-all-closed', () => app.quit());
