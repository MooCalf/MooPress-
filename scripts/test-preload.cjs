const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('moopress', {
  loadSettings: async () => ({ tourDone: true, spellcheck: false, smartSynonyms: false, focusPalette: false }),
  saveSettings: async () => {}, setDirty: () => {},
  readRecovery: async () => null, launchFile: async () => null,
  onOpenFile: () => {}, onSaveAndClose: () => {},
  defaultFolder: async () => '', listLibrary: async () => [],
  spellLanguages: async () => [], setSpellLanguage: async () => {},
  pickImage: async () => ({ name: 'Cover.png', size: 100, dataUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iZ29sZCIvPjwvc3ZnPg==' }),
});
