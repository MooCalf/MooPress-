import { app } from './app.js';

let fallback = null;

export async function saveFolder() {
  if (app.settings.saveFolder) return app.settings.saveFolder;
  fallback ??= await window.moopress.defaultFolder();
  return fallback;
}
