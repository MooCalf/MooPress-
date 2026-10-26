import { app } from './app.js';
import { defineAction } from './keybinds.js';
import { withEditor } from './editor.js';
import { FONT_SIZES } from './project.js';
import { newBook, openBook, saveBook, exportPdf, exportHtml, printBook } from './fileops.js';
import { insertPicture, linkDialog, shapeDialog, chartDialog } from './insert.js';
import { DEFAULT_SHAPE, DEFAULT_CHART } from './graphics.js';
import { headerFooterDialog, updateLayout } from './layout.js';
import { openFind } from './find.js';
import { openProofing } from './proofing.js';
import { wordCountDialog } from './stats.js';
import { addChapter, stepChapter } from './sidebar.js';
import { openSettings, setSetting } from './settings.js';
import { openView } from './editor.js';
import { toggleTypewriter } from './features/typewriter.js';
import { toggleZen } from './features/zen.js';
import { openTimeMachine } from './features/timeMachine.js';
import { showSynonyms } from './features/synonyms.js';
import { toggleFluff } from './features/fluff.js';
import { pasteSlot, clipRingPopover, SLOT_COUNT } from './features/clipRing.js';
import { addEntryFromSelection, toggleBibleHighlights } from './features/bible.js';
import {
  toggleFocusMode, toggleSidebar, togglePageGuides, zoomIn, zoomOut, zoomReset, zoomToWidth, toggleTheme, toggleRibbon,
} from './view.js';

export const colors = { text: '#c0392b', highlight: '#fde68a' };

const ed = () => app.editor;
const inChapter = () => !!app.view && app.view !== 'title';
const active = (...args) => () => inChapter() && ed().isActive(...args);

function stepFontSize(dir) {
  withEditor((chain, editor) => {
    const cur = parseFloat(editor.getAttributes('textStyle').fontSize) || app.project.layout.fontSize;
    const next = dir > 0 ? FONT_SIZES.find((s) => s > cur) ?? cur + 12 : [...FONT_SIZES].reverse().find((s) => s < cur) ?? Math.max(1, cur - 1);
    return chain.setFontSize(`${next}pt`).run();
  });
}

const clip = (cmd) => () => {
  if (inChapter()) ed().commands.focus();
  return window.moopress.edit(cmd);
};

export function registerActions() {
  const A = defineAction;

  A({ id: 'newBook', label: 'New book', category: 'File', defaultKey: 'Ctrl+N', scope: 'global', run: newBook, description: 'Start a brand-new book.' });
  A({ id: 'openBook', label: 'Open book…', category: 'File', defaultKey: 'Ctrl+O', scope: 'global', run: () => openBook(), description: 'Open a MooPress book, or a Word (.docx, .doc), PDF, OpenDocument, RTF, text, Markdown or web page file.' });
  A({ id: 'save', label: 'Save', category: 'File', defaultKey: 'Ctrl+S', scope: 'global', run: () => saveBook(), description: 'Save your book.' });
  A({ id: 'saveAs', label: 'Save as…', category: 'File', defaultKey: 'F12', scope: 'global', run: () => saveBook({ saveAs: true }), description: 'Save under a new name or in another format: MooPress, Word, PDF, OpenDocument, RTF, text, Markdown or web page.' });
  A({ id: 'exportPdf', label: 'Export as PDF', category: 'File', scope: 'global', run: exportPdf, description: 'Create a print-ready PDF with your page size, headers and page numbers.' });
  A({ id: 'exportHtml', label: 'Export as web page', category: 'File', scope: 'global', run: exportHtml, description: 'Save the whole book as a single HTML file.' });
  A({ id: 'print', label: 'Print…', category: 'File', defaultKey: 'Ctrl+P', scope: 'global', run: printBook, description: 'Print the whole book.' });

  A({ id: 'cut', label: 'Cut', category: 'Clipboard & history', defaultKey: 'Ctrl+X', native: true, run: clip('cut'), description: 'Remove the selection and put it on the clipboard.' });
  A({ id: 'copy', label: 'Copy', category: 'Clipboard & history', defaultKey: 'Ctrl+C', native: true, run: clip('copy'), description: 'Copy the selection to the clipboard.' });
  A({ id: 'paste', label: 'Paste', category: 'Clipboard & history', defaultKey: 'Ctrl+V', native: true, run: clip('paste'), description: 'Paste from the clipboard, keeping formatting.' });
  A({ id: 'pastePlain', label: 'Paste as plain text', category: 'Clipboard & history', defaultKey: 'Ctrl+Shift+V', native: true, run: clip('pastePlain'), description: 'Paste without any formatting, so it matches your book.' });
  A({ id: 'selectAll', label: 'Select all', category: 'Clipboard & history', defaultKey: 'Ctrl+A', native: true, run: clip('selectAll'), description: 'Select everything in this chapter.' });
  for (let n = 1; n <= SLOT_COUNT; n++) {
    A({ id: `pasteSlot${n}`, label: `Paste clipboard slot ${n}`, category: 'Clipboard & history', defaultKey: `Ctrl+${n}`, run: () => pasteSlot(n), description: n === 1 ? 'Paste the most recent thing you copied.' : `Paste what you copied ${n} copies ago.` });
  }
  A({ id: 'clipboardSlots', label: 'Clipboard slots…', category: 'Clipboard & history', defaultKey: 'Ctrl+Alt+V', scope: 'global', run: () => clipRingPopover(document.querySelector('[data-tip="Clipboard slots"]') || document.getElementById('canvas')), description: 'See your last 5 copies and paste any of them.' });
  A({ id: 'undo', label: 'Undo', category: 'Clipboard & history', defaultKey: 'Ctrl+Z', run: () => withEditor((c) => c.undo().run()), isEnabled: () => inChapter() && ed().can().undo(), description: 'Undo your last change.' });
  A({ id: 'redo', label: 'Redo', category: 'Clipboard & history', defaultKey: 'Ctrl+Y', run: () => withEditor((c) => c.redo().run()), isEnabled: () => inChapter() && ed().can().redo(), description: 'Redo what you just undid.' });

  A({ id: 'bold', label: 'Bold', category: 'Text formatting', defaultKey: 'Ctrl+B', run: () => withEditor((c) => c.toggleBold().run()), isActive: active('bold') });
  A({ id: 'italic', label: 'Italic', category: 'Text formatting', defaultKey: 'Ctrl+I', run: () => withEditor((c) => c.toggleItalic().run()), isActive: active('italic') });
  A({ id: 'underline', label: 'Underline', category: 'Text formatting', defaultKey: 'Ctrl+U', run: () => withEditor((c) => c.toggleUnderline().run()), isActive: active('underline') });
  A({ id: 'strike', label: 'Strikethrough', category: 'Text formatting', defaultKey: 'Ctrl+Shift+X', run: () => withEditor((c) => c.toggleStrike().run()), isActive: active('strike'), description: 'Draw a line through the selected text.' });
  A({ id: 'subscript', label: 'Subscript', category: 'Text formatting', defaultKey: 'Ctrl+=', run: () => withEditor((c) => c.toggleSubscript().run()), isActive: active('subscript'), description: 'Small letters below the line, like H₂O.' });
  A({ id: 'superscript', label: 'Superscript', category: 'Text formatting', defaultKey: 'Ctrl+Shift+=', run: () => withEditor((c) => c.toggleSuperscript().run()), isActive: active('superscript'), description: 'Small letters above the line, like 1ˢᵗ.' });
  A({ id: 'growFont', label: 'Increase font size', category: 'Text formatting', defaultKey: 'Ctrl+Shift+.', run: () => stepFontSize(1) });
  A({ id: 'shrinkFont', label: 'Decrease font size', category: 'Text formatting', defaultKey: 'Ctrl+Shift+,', run: () => stepFontSize(-1) });
  A({ id: 'textColor', label: 'Font colour', category: 'Text formatting', run: () => withEditor((c) => c.setColor(colors.text).run()), description: 'Colour the selected text (uses the last colour you picked).' });
  A({ id: 'highlight', label: 'Highlight', category: 'Text formatting', defaultKey: 'Ctrl+Shift+H', run: () => withEditor((c) => c.toggleHighlight({ color: colors.highlight }).run()), isActive: active('highlight'), description: 'Mark text like a highlighter pen.' });
  A({ id: 'clearFormatting', label: 'Clear formatting', category: 'Text formatting', defaultKey: 'Ctrl+Space', run: () => withEditor((c) => c.unsetAllMarks().setParagraph().unsetTextAlign().setLineHeight(null).run()), description: 'Remove all formatting from the selection, leaving plain text.' });

  A({ id: 'alignLeft', label: 'Align left', category: 'Paragraph', defaultKey: 'Ctrl+L', run: () => withEditor((c) => c.setTextAlign('left').run()), isActive: () => inChapter() && (ed().isActive({ textAlign: 'left' }) || !['center', 'right', 'justify'].some((a) => ed().isActive({ textAlign: a }))) });
  A({ id: 'alignCenter', label: 'Center', category: 'Paragraph', defaultKey: 'Ctrl+E', run: () => withEditor((c) => c.setTextAlign('center').run()), isActive: active({ textAlign: 'center' }) });
  A({ id: 'alignRight', label: 'Align right', category: 'Paragraph', defaultKey: 'Ctrl+R', run: () => withEditor((c) => c.setTextAlign('right').run()), isActive: active({ textAlign: 'right' }) });
  A({ id: 'justify', label: 'Justify', category: 'Paragraph', defaultKey: 'Ctrl+J', run: () => withEditor((c) => c.setTextAlign('justify').run()), isActive: active({ textAlign: 'justify' }), description: 'Line text up evenly on both sides, like a printed book.' });
  A({ id: 'bulletList', label: 'Bullet list', category: 'Paragraph', defaultKey: 'Ctrl+Shift+L', run: () => withEditor((c) => c.toggleBulletList().run()), isActive: active('bulletList') });
  A({ id: 'orderedList', label: 'Numbered list', category: 'Paragraph', defaultKey: 'Ctrl+Shift+7', run: () => withEditor((c) => c.toggleOrderedList().run()), isActive: active('orderedList') });
  A({ id: 'indent', label: 'Increase indent', category: 'Paragraph', defaultKey: 'Ctrl+M', run: () => withEditor((c, e) => (e.isActive('listItem') ? c.sinkListItem('listItem').run() : c.changeIndent(1).run())) });
  A({ id: 'outdent', label: 'Decrease indent', category: 'Paragraph', defaultKey: 'Ctrl+Shift+M', run: () => withEditor((c, e) => (e.isActive('listItem') ? c.liftListItem('listItem').run() : c.changeIndent(-1).run())) });
  A({ id: 'normalText', label: 'Normal text', category: 'Paragraph', defaultKey: 'Ctrl+Shift+N', run: () => withEditor((c) => c.setParagraph().run()), isActive: () => inChapter() && ed().isActive('paragraph') && !ed().isActive('blockquote') });
  A({ id: 'heading1', label: 'Heading 1', category: 'Paragraph', defaultKey: 'Ctrl+Alt+1', run: () => withEditor((c) => c.toggleHeading({ level: 1 }).run()), isActive: active('heading', { level: 1 }) });
  A({ id: 'heading2', label: 'Heading 2', category: 'Paragraph', defaultKey: 'Ctrl+Alt+2', run: () => withEditor((c) => c.toggleHeading({ level: 2 }).run()), isActive: active('heading', { level: 2 }) });
  A({ id: 'heading3', label: 'Heading 3', category: 'Paragraph', defaultKey: 'Ctrl+Alt+3', run: () => withEditor((c) => c.toggleHeading({ level: 3 }).run()), isActive: active('heading', { level: 3 }) });
  A({ id: 'quote', label: 'Quote', category: 'Paragraph', defaultKey: 'Ctrl+Shift+Q', run: () => withEditor((c) => c.toggleBlockquote().run()), isActive: active('blockquote'), description: 'Set the paragraph apart as an indented quotation, letter or epigraph.' });
  A({ id: 'lineSpacing1', label: 'Single line spacing', category: 'Paragraph', run: () => withEditor((c) => c.setLineHeight('1').run()) });
  A({ id: 'lineSpacing15', label: '1.5 line spacing', category: 'Paragraph', run: () => withEditor((c) => c.setLineHeight('1.5').run()) });
  A({ id: 'lineSpacing2', label: 'Double line spacing', category: 'Paragraph', run: () => withEditor((c) => c.setLineHeight('2').run()) });

  A({ id: 'pageBreak', label: 'Page break', category: 'Insert', defaultKey: 'Ctrl+Enter', run: () => withEditor((c) => c.setPageBreak().run()), description: 'Start a new page at the cursor.' });
  A({ id: 'sceneBreak', label: 'Scene break', category: 'Insert', defaultKey: 'Ctrl+Shift+Enter', run: () => withEditor((c) => c.setSceneBreak().run()), description: 'Insert a centred “* * *” to mark a change of scene.' });
  A({ id: 'picture', label: 'Picture…', category: 'Insert', run: insertPicture, description: 'Insert a picture from your computer. You can also paste or drag one in.' });
  A({ id: 'shape', label: 'Shape…', category: 'Insert', run: () => inChapter() && shapeDialog(DEFAULT_SHAPE), description: 'Insert a shape such as a box, star, arrow or speech bubble.' });
  A({ id: 'chart', label: 'Chart…', category: 'Insert', run: () => inChapter() && chartDialog(DEFAULT_CHART), description: 'Insert a bar, line or pie chart from your own numbers.' });
  A({ id: 'table', label: 'Table', category: 'Insert', run: () => withEditor((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()), description: 'Insert a table to organise information in rows and columns.' });
  A({ id: 'link', label: 'Link…', category: 'Insert', defaultKey: 'Ctrl+K', run: linkDialog, isActive: active('link'), description: 'Link text to a web page.' });

  A({ id: 'snippetHelp', label: 'Snippets…', category: 'Insert', scope: 'global', run: () => openSettings('snippets'), description: 'Type / and a trigger like /sig in your text to insert a saved block. Manage them here.' });

  A({ id: 'headerFooter', label: 'Header & footer…', category: 'Layout', scope: 'global', run: headerFooterDialog, description: 'Text and page numbers printed at the top and bottom of each page.' });
  A({ id: 'toggleChapterNewPage', label: 'Start chapters on a new page', category: 'Layout', scope: 'global', run: () => updateLayout({ chapterNewPage: !app.project.layout.chapterNewPage }), isActive: () => app.project.layout.chapterNewPage });
  A({ id: 'toggleTitlePage', label: 'Include title page', category: 'Layout', scope: 'global', run: () => updateLayout({ includeTitlePage: !app.project.layout.includeTitlePage }), isActive: () => app.project.layout.includeTitlePage, description: 'Print a title page at the start of the book.' });

  A({ id: 'find', label: 'Find', category: 'Navigation', defaultKey: 'Ctrl+F', scope: 'global', run: () => openFind(), description: 'Find words in this chapter or the whole book.' });
  A({ id: 'replace', label: 'Replace', category: 'Navigation', defaultKey: 'Ctrl+H', scope: 'global', run: () => openFind({ replace: true }), description: 'Find and replace words — even across the whole book.' });
  A({ id: 'newChapter', label: 'New chapter', category: 'Navigation', defaultKey: 'Ctrl+Alt+N', scope: 'global', run: addChapter, description: 'Add a chapter after the current one.' });
  A({ id: 'nextChapter', label: 'Next chapter', category: 'Navigation', defaultKey: 'Ctrl+PageDown', scope: 'global', run: () => stepChapter(1) });
  A({ id: 'prevChapter', label: 'Previous chapter', category: 'Navigation', defaultKey: 'Ctrl+PageUp', scope: 'global', run: () => stepChapter(-1) });
  A({ id: 'titlePage', label: 'Go to title page', category: 'Navigation', scope: 'global', run: () => openView('title') });

  A({ id: 'proofing', label: 'Spelling & grammar', category: 'Review & tools', defaultKey: 'F7', scope: 'global', run: openProofing, description: 'Review spelling and grammar issues in this chapter with one-click fixes.' });
  A({ id: 'wordCount', label: 'Word count', category: 'Review & tools', defaultKey: 'Ctrl+Shift+G', scope: 'global', run: wordCountDialog, description: 'Words, characters and reading time for this chapter and the whole book.' });
  A({ id: 'toggleSpellcheck', label: 'Check spelling as I type', category: 'Review & tools', scope: 'global', run: () => setSetting('spellcheck', !app.settings.spellcheck), isActive: () => app.settings.spellcheck });
  A({ id: 'toggleGrammar', label: 'Mark grammar as I type', category: 'Review & tools', scope: 'global', run: () => setSetting('grammarAsYouType', !app.settings.grammarAsYouType), isActive: () => app.settings.grammarAsYouType });
  A({ id: 'toggleStyle', label: 'Style suggestions', category: 'Review & tools', scope: 'global', run: () => setSetting('styleSuggestions', !app.settings.styleSuggestions), isActive: () => app.settings.styleSuggestions, description: 'Flag passive voice, very long sentences and filler words.' });
  A({ id: 'synonyms', label: 'Synonyms', category: 'Review & tools', defaultKey: 'Shift+F7', run: showSynonyms, description: 'Synonyms for the word at the cursor that fit its sentence. Tip: double-click any word.' });
  A({ id: 'fluffDetector', label: 'Cliché & fluff detector', category: 'Review & tools', defaultKey: 'Ctrl+Alt+L', scope: 'global', run: toggleFluff, isActive: () => app.settings.fluffDetector, description: 'Highlight clichés, passive voice, filler and repeated words, and show a live readability score.' });
  A({ id: 'timeMachine', label: 'Time Machine', category: 'Review & tools', defaultKey: 'Ctrl+Alt+H', scope: 'global', run: openTimeMachine, isActive: () => document.body.classList.contains('time-machine'), description: 'Slide back through the last 10 minutes of this chapter and restore deleted paragraphs.' });
  A({ id: 'addBibleEntry', label: 'Add to Story Settings', category: 'Review & tools', defaultKey: 'Ctrl+Alt+B', scope: 'global', run: addEntryFromSelection, description: 'Add a character, place or term (the selected text becomes its name).' });
  A({ id: 'toggleBibleHighlights', label: 'Underline Story Settings names', category: 'Review & tools', scope: 'global', run: toggleBibleHighlights, isActive: () => app.settings.bibleHighlights });
  A({ id: 'settings', label: 'Settings', category: 'Review & tools', defaultKey: 'Ctrl+,', scope: 'global', run: () => openSettings('general') });
  A({ id: 'shortcuts', label: 'Keyboard shortcuts', category: 'Review & tools', defaultKey: 'Ctrl+/', scope: 'global', run: () => openSettings('shortcuts'), description: 'See and change every keyboard shortcut.' });

  A({ id: 'focusMode', label: 'Focus mode', category: 'View', defaultKey: 'F11', scope: 'global', run: () => toggleFocusMode(), description: 'Hide everything except your writing. Press Esc to exit.' });
  A({ id: 'zenMode', label: 'Zen mode', category: 'View', defaultKey: 'Ctrl+Alt+Z', scope: 'global', run: () => toggleZen(), isActive: () => document.body.classList.contains('zen'), description: 'Full screen with nothing but your words. Press Esc to leave.' });
  A({ id: 'typewriter', label: 'Typewriter scrolling', category: 'View', defaultKey: 'Ctrl+Alt+T', scope: 'global', run: toggleTypewriter, isActive: () => app.settings.typewriter, description: 'Keep the line you are typing in the middle of the screen.' });
  A({ id: 'toggleFocusPalette', label: 'Floating palette', category: 'View', scope: 'global', run: () => setSetting('focusPalette', !app.settings.focusPalette), isActive: () => app.settings.focusPalette, description: 'A faint formatting toolbar near your cursor that hides while you type.' });
  A({ id: 'toggleRadialMenu', label: 'Radial right-click menu', category: 'View', scope: 'global', run: () => setSetting('radialMenu', !app.settings.radialMenu), isActive: () => app.settings.radialMenu, description: 'Right-click shows a ring of tools. Hold Shift for the classic menu.' });
  A({ id: 'toggleSidebar', label: 'Show chapter list', category: 'View', defaultKey: 'Ctrl+\\', scope: 'global', run: toggleSidebar, isActive: () => app.settings.sidebarVisible });
  A({ id: 'togglePageGuides', label: 'Show page guides', category: 'View', scope: 'global', run: togglePageGuides, isActive: () => app.settings.showPageGuides, description: 'Dashed lines showing roughly where each printed page ends.' });
  A({ id: 'toggleRibbon', label: 'Collapse the ribbon', category: 'View', defaultKey: 'Ctrl+F1', scope: 'global', run: toggleRibbon, isActive: () => app.settings.ribbonCollapsed });
  A({ id: 'zoomIn', label: 'Zoom in', category: 'View', defaultKey: 'Ctrl+Alt+=', scope: 'global', run: zoomIn });
  A({ id: 'zoomOut', label: 'Zoom out', category: 'View', defaultKey: 'Ctrl+Alt+-', scope: 'global', run: zoomOut });
  A({ id: 'zoomReset', label: 'Zoom to 100%', category: 'View', defaultKey: 'Ctrl+0', scope: 'global', run: zoomReset });
  A({ id: 'zoomWidth', label: 'Fit page width', category: 'View', scope: 'global', run: zoomToWidth });
  A({ id: 'toggleTheme', label: 'Dark mode', category: 'View', scope: 'global', run: toggleTheme, isActive: () => document.documentElement.dataset.theme === 'dark' });
}
