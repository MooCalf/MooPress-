# Manuscript and page elements implementation plan

**Goal:** Continue the existing MooPress desktop app with a title-first, continuously scrollable manuscript, editable publishing elements, and expanding radial tools.

**Architecture:** Keep the existing Tiptap editor and chapter-specific undo states. Mount the active editor in a continuous sequence of chapter papers; render inactive chapters with the same schema. Preserve the existing palette and radial animation. Store new page elements in document JSON and title artwork in project metadata.

**Tech stack:** Existing Electron, Vite, Tiptap and Lucide dependencies; no new runtime dependencies.

## Constraints

- Follow the prior Claude Code requests: friendly controls, Nunito app typography, user-selected manuscript fonts, configurable shortcuts, and no product-code comments.
- Keep old MooPress books readable and preserve chapter content and undo when navigating.
- Perform implementation in the supplied workspace; do not change branches or publish.

## Tasks

- [x] Add a hidden Electron integration harness and reproduce title-default, continuous-chapter, title-artwork, page-element and radial expansion failures.
- [x] Render title then all chapter papers, move the active editor on single-click navigation, and preserve scrolling, selection, edits and undo. Reconcile chapter add/delete/reorder.
- [x] Add title artwork upload, replacement, size, alignment, position, alternative text, caption and removal; save and export it.
- [x] Add configurable contents, captions, inline footnote references with chapter notes, watermark, and table formatting. Expose headers, footers and page numbers through Insert and radial tools.
- [x] Expand the center radial button into a surrounding animated ring; retain old commands, add insertion commands, keep the ring within the window and support Escape and keyboard access.
- [x] Run integration checks and production build; review saving, project reload, export and chapter operations.

## Validation and review

The hidden Electron integration suite exercises the real renderer and schema with a test file-picker/settings bridge. Production smoke checks load the bundled app from disk. Review found and corrected title typing focus loss, Time Machine visibility, live table styles, title artwork sizing, book page totals, and stale previews after whole-book edits. Regression checks cover each finding.

Footnote references are inline and their editable text appears below the containing chapter. Word, RTF and OpenDocument exports flatten publishing elements to readable text; native MooPress files retain their editable attributes. PDF/HTML retain the publishing appearance.

## Review focus

Check chapter edits immediately followed by navigation and export; undo after revisiting a chapter; old projects missing new fields; removal/reorder of an inactive chapter; titles and note text containing HTML characters; cancellation of dialogs; radial expansion at window edges.
