const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('moopress', {
  openFile: (path, folder) => ipcRenderer.invoke('file:open', path, folder),
  defaultFolder: () => ipcRenderer.invoke('folder:default'),
  pickFolder: (current) => ipcRenderer.invoke('folder:pick', current),
  openFolder: (folder) => ipcRenderer.invoke('folder:open', folder),
  listLibrary: (folder) => ipcRenderer.invoke('library:list', folder),
  chooseSavePath: (opts) => ipcRenderer.invoke('file:choose-save', opts),
  writeFile: (opts) => ipcRenderer.invoke('file:write', opts),
  onOpenFile: (cb) => ipcRenderer.on('app:open-file', (_e, path) => cb(path)),
  exportHtml: (opts) => ipcRenderer.invoke('export:html', opts),
  exportPdf: (opts) => ipcRenderer.invoke('export:pdf', opts),
  print: (opts) => ipcRenderer.invoke('print', opts),
  pickImage: () => ipcRenderer.invoke('image:pick'),

  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),

  readRecovery: () => ipcRenderer.invoke('recovery:read'),
  writeRecovery: (data) => ipcRenderer.invoke('recovery:write', data),
  clearRecovery: () => ipcRenderer.invoke('recovery:clear'),

  edit: (cmd) => ipcRenderer.invoke('edit', cmd),

  isMisspelled: (word) => webFrame.isWordMisspelled(word),
  suggestions: (word) => webFrame.getWordSuggestions(word),
  addWord: (word) => ipcRenderer.invoke('spell:add-word', word),
  spellLanguages: () => ipcRenderer.invoke('spell:languages'),
  setSpellLanguage: (lang) => ipcRenderer.invoke('spell:set-language', lang),

  synonyms: (word, sentence, pos) => ipcRenderer.invoke('thesaurus:lookup', { word, sentence, pos }),
  setFullScreen: (on) => ipcRenderer.send('window:fullscreen', on),

  setDirty: (v) => ipcRenderer.send('app:set-dirty', v),
  closeNow: () => ipcRenderer.send('app:close-now'),
  launchFile: () => ipcRenderer.invoke('app:launch-file'),
  onSaveAndClose: (cb) => ipcRenderer.on('app:save-and-close', () => cb()),
});
