# MooPress™

<img width="2172" height="724" alt="MOOPRESS Color Logo with Texts" src="https://github.com/user-attachments/assets/39db102d-dfbd-48ce-ae22-ac10d3796ba8" />


A simple word processor for book authors on Windows. Write your book chapter by chapter, set it up at real book sizes (like 6" × 9"), and export a print ready PDF with page numbers and headers. Every keyboard shortcut can be changed in Settings as requested by a colleague :)

It also comes with writing tools to make things easier for you: double click a word for synonyms, slash commands: type `/sig` or `/chapter` to drop in saved text, a Time Machine to bring back deleted paragraphs, Story Settings cards for your characters and places
Books are saved as `.moopress` files because funny, but MooPress also opens and saves other file formats so you can move between the two:

| Opens | Saves |
| --- | --- |
| Word (`.docx`, `.docm`, `.dotx`, `.doc`), PDF, OpenDocument (`.odt`), Rich Text (`.rtf`), plain text, Markdown, web pages | MooPress (`.moopress`), Word (`.docx`), PDF, OpenDocument (`.odt`), Rich Text (`.rtf`), plain text, Markdown, web page |

Each Heading 1 in an opened document becomes a chapter. MooPress also keeps a recovery copy, so you don't lose work if it closes unexpectedly.

Books open on the title page. Click a chapter once to jump to it, or scroll through the whole manuscript. Title page pictures can be resized, aligned, captioned, replaced and moved above or below the title details.

The Insert tab includes tables, automatic contents, captions, footnotes, headers, footers, watermarks and page numbers. Double-click a contents block, caption or footnote reference to edit it. Footnote text appears below its chapter. Click inside a table and use the Table tab for rows, columns, cells and appearance. Right-click in a chapter, then click the center dots to expand another ring of tools.

Save as `.moopress` to keep every element's editing options. Word, OpenDocument and RTF copies retain contents, captions and notes as regular text. PDF and web exports keep their appearance.

## Install

1. Download the latest **MooPress Setup** installer from the [Releases page](https://github.com/MooCalf/MooPress-/releases/latest)
2. Run it and pick an install location
3. You're done! A desktop and Start Menu shortcut are created automatically.

OR, **from a local build:** run `npm run dist` (see below), then run `release\MooPress Setup x.x.x.exe`.

After installing:

- `.moopress` files open in MooPress when you double-click them.

Note: the installer is unsigned, so Windows SmartScreen will warn on first run!

## Develop and build locally

Requires Node.js 20+.

```bash
npm install
npm run dev              # run the app with live reload (F12 opens DevTools)
npm start                # build and run the app
npm run dist             # build the Windows installer into release/
npm run icons            # rebuild the app icons from src/Logo
npm run register-files   # add MooPress to "Open with" without installing (see below)
npm test                 # run editor integration checks in a hidden Electron window
npm run test:built       # check the built desktop app after npm run build
```

## Disclaimer:

Fonts: Nunito ExtraBold for the app. Icons come from the [Lucide](https://lucide.dev) library, and synonyms come from [WordNet](https://wordnet.princeton.edu/).
