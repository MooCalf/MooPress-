import { app, emit, on } from './app.js';
import { setSetting } from './settings.js';
import { schedulePageGuides } from './layout.js';
import { toast } from './ui.js';

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.5;

export function setZoom(z) {
  app.zoom = Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) * 100) / 100;
  document.getElementById('zoom-layer').style.zoom = app.zoom;
  setSetting('zoom', app.zoom);
  emit('zoom-changed');
  schedulePageGuides();
}

export const zoomIn = () => setZoom(app.zoom + 0.1);
export const zoomOut = () => setZoom(app.zoom - 0.1);
export const zoomReset = () => setZoom(1);

export function zoomToWidth() {
  const canvas = document.getElementById('canvas');
  const paper = document.getElementById(app.view === 'title' ? 'title-page' : 'paper');
  setZoom((canvas.clientWidth - 64) / paper.offsetWidth);
}

export function initZoom() {
  setZoom(app.settings.zoom || 1);
  document.getElementById('canvas').addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(app.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
    },
    { passive: false },
  );
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

export function applyTheme() {
  const t = app.settings.theme;
  document.documentElement.dataset.theme = t === 'system' ? (darkQuery.matches ? 'dark' : 'light') : t;
}
darkQuery.addEventListener('change', applyTheme);

export function toggleTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  setSetting('theme', dark ? 'light' : 'dark');
}

export function toggleFocusMode(force) {
  const on = force ?? !document.body.classList.contains('focus-mode');
  document.body.classList.toggle('focus-mode', on);
  if (on) toast('Focus mode is on. Press Esc to bring the toolbars back.', 'info', 3500);
  emit('focus-changed');
  schedulePageGuides();
}

export function applySidebar() {
  document.getElementById('sidebar').hidden = !app.settings.sidebarVisible;
}

export function toggleSidebar() {
  setSetting('sidebarVisible', !app.settings.sidebarVisible);
}

export function applyRibbonCollapsed() {
  document.getElementById('ribbon').classList.toggle('collapsed', app.settings.ribbonCollapsed);
  document.getElementById('ribbon').classList.remove('peek');
  document.body.classList.toggle('ribbon-collapsed', app.settings.ribbonCollapsed);
}

export function toggleRibbon() {
  setSetting('ribbonCollapsed', !app.settings.ribbonCollapsed);
}

export function togglePageGuides() {
  setSetting('showPageGuides', !app.settings.showPageGuides);
}

on('settings-changed', (key) => {
  if (key === 'theme') applyTheme();
  if (key === 'sidebarVisible') applySidebar();
  if (key === 'ribbonCollapsed') applyRibbonCollapsed();
  if (key === 'showPageGuides') schedulePageGuides();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('focus-mode') && !document.querySelector('.modal-overlay, .popover')) {
    toggleFocusMode(false);
  }
});
