# MooPress™

A simple word processor for book authors on Windows. Write your book chapter by chapter, set it up at real book sizes (like 6" × 9"), and export a print ready PDF with page numbers and headers. Every keyboard shortcut can be changed in Settings as requested by a colleague :)

It also comes with writing tools to make things easier for you: double click a word for synonyms, slash commands: type `/sig` or `/chapter` to drop in saved text, a Time Machine to bring back deleted paragraphs, Story Settings cards for your characters and places
Books are saved as `.moopress` files because funny, but MooPress also opens and saves other file formats so you can move between the two:

| Opens | Saves |
| --- | --- |
| Word (`.docx`, `.docm`, `.dotx`, `.doc`), PDF, OpenDocument (`.odt`), Rich Text (`.rtf`), plain text, Markdown, web pages | MooPress (`.moopress`), Word (`.docx`), PDF, OpenDocument (`.odt`), Rich Text (`.rtf`), plain text, Markdown, web page |

Each Heading 1 in an opened document becomes a chapter. MooPress also keeps a recovery copy, so you don't lose work if it closes unexpectedly.

## Install

1. Download **MooPress Setup 0.1.0.exe** from the [Releases page](https://github.com/MooCalf/MooPress-/releases/latest)
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
```

## Disclaimer:

Fonts: Nunito ExtraBold for the app. Icons come from the [Lucide](https://lucide.dev) library, and synonyms come from [WordNet](https://wordnet.princeton.edu/).
