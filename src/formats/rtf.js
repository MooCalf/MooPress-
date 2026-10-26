const SKIP_DESTINATIONS = new Set([
  'fonttbl', 'colortbl', 'stylesheet', 'info', 'header', 'footer', 'headerl', 'headerr', 'headerf', 'footerl', 'footerr', 'footerf',
  'footnote', 'annotation', 'field', 'fldinst', 'xmlnstbl', 'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'themedata',
  'colorschememapping', 'latentstyles', 'datastore', 'pgdsctbl', 'filetbl', 'revtbl', 'mmathPr', 'nonshppict', 'object', 'shp',
]);

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export function rtfToHtml(rtf) {
  const out = [];
  const styleNames = parseStyleNames(rtf);
  let para = [];
  let paraState = { align: '', heading: 0, pageBreakBefore: false };
  let state = { b: false, i: false, u: false, s: false, skip: false, uc: 1, pict: null };
  const stack = [];
  let pendingSkip = 0;

  const text = (t) => {
    if (state.skip || !t) return;
    if (state.pict) {
      state.pict.hex += t.replace(/[^0-9a-f]/gi, '');
      return;
    }
    let html = esc(t);
    if (state.b) html = `<strong>${html}</strong>`;
    if (state.i) html = `<em>${html}</em>`;
    if (state.u) html = `<u>${html}</u>`;
    if (state.s) html = `<s>${html}</s>`;
    para.push(html);
  };
  const endPara = () => {
    const inner = para.join('');
    const style = paraState.align ? ` style="text-align:${paraState.align}"` : '';
    if (paraState.pageBreakBefore) out.push('<div class="page-break-marker"></div>');
    if (paraState.heading) out.push(`<h${paraState.heading}${style}>${inner}</h${paraState.heading}>`);
    else out.push(`<p${style}>${inner}</p>`);
    para = [];
    paraState = { ...paraState, pageBreakBefore: false };
  };

  let i = 0;
  while (i < rtf.length) {
    const c = rtf[i];
    if (c === '{') {
      stack.push({ ...state, pict: state.pict });
      i++;
      continue;
    }
    if (c === '}') {
      if (state.pict && !stack.at(-1)?.pict) {
        const p = state.pict;
        if (p.type && p.hex) {
          const bytes = p.hex.match(/../g).map((h) => String.fromCharCode(parseInt(h, 16))).join('');
          const style = p.w ? ` style="width:${Math.round(p.w)}px"` : '';
          para.push(`<img src="data:image/${p.type};base64,${btoa(bytes)}"${style}>`);
        }
      }
      state = stack.pop() || state;
      i++;
      continue;
    }
    if (c === '\\') {
      const next = rtf[i + 1];
      if (next === '\\' || next === '{' || next === '}') {
        if (pendingSkip > 0) pendingSkip--;
        else text(next);
        i += 2;
        continue;
      }
      if (next === "'") {
        const code = parseInt(rtf.substr(i + 2, 2), 16);
        if (pendingSkip > 0) pendingSkip--;
        else text(cp1252(code));
        i += 4;
        continue;
      }
      if (next === '*') {
        if (!rtf.startsWith('\\shppict', i + 2)) state.skip = true;
        i += 2;
        continue;
      }
      if (next === '~') { text('\u00a0'); i += 2; continue; }
      if (next === '-' || next === '_') { i += 2; continue; }
      if (next === '\n' || next === '\r') { endPara(); i += 2; continue; }
      const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i + 1, i + 40));
      if (!m) { i++; continue; }
      i += 1 + m[0].length;
      const word = m[1];
      const arg = m[2] === undefined ? null : Number(m[2]);
      if (SKIP_DESTINATIONS.has(word)) { state.skip = true; continue; }
      if (state.skip) continue;
      switch (word) {
        case 'par': case 'sect': endPara(); break;
        case 'line': para.push('<br>'); break;
        case 'tab': text('\t'); break;
        case 'page': if (para.length) endPara(); paraState.pageBreakBefore = true; break;
        case 'pagebb': paraState.pageBreakBefore = true; break;
        case 'pard': paraState = { align: '', heading: 0, pageBreakBefore: paraState.pageBreakBefore }; break;
        case 'qc': paraState.align = 'center'; break;
        case 'qr': paraState.align = 'right'; break;
        case 'qj': paraState.align = 'justify'; break;
        case 'ql': paraState.align = ''; break;
        case 'outlinelevel': paraState.heading = Math.min(3, (arg ?? 0) + 1); break;
        case 's': {
          const name = styleNames.get(arg) || '';
          const h = /heading\s*(\d)/i.exec(name);
          if (h) paraState.heading = Math.min(3, Number(h[1]));
          else if (/^title$/i.test(name)) paraState.heading = 1;
          break;
        }
        case 'plain': Object.assign(state, { b: false, i: false, u: false, s: false }); break;
        case 'b': state.b = arg !== 0; break;
        case 'i': state.i = arg !== 0; break;
        case 'ul': case 'uld': case 'uldb': case 'ulw': state.u = arg !== 0; break;
        case 'ulnone': state.u = false; break;
        case 'strike': case 'striked': state.s = arg !== 0; break;
        case 'uc': state.uc = arg ?? 1; break;
        case 'u': {
          const code = arg < 0 ? arg + 65536 : arg;
          text(String.fromCharCode(code));
          pendingSkip = state.uc;
          break;
        }
        case 'emdash': text('—'); break;
        case 'endash': text('–'); break;
        case 'lquote': text('‘'); break;
        case 'rquote': text('’'); break;
        case 'ldblquote': text('“'); break;
        case 'rdblquote': text('”'); break;
        case 'bullet': text('•'); break;
        case 'pict': state.pict = { hex: '', type: null, w: 0 }; break;
        case 'pngblip': if (state.pict) state.pict.type = 'png'; break;
        case 'jpegblip': if (state.pict) state.pict.type = 'jpeg'; break;
        case 'picwgoal': if (state.pict) state.pict.w = (arg / 1440) * 96; break;
        default: break;
      }
      continue;
    }
    if (c === '\r' || c === '\n') { i++; continue; }
    let j = i;
    while (j < rtf.length && !'\\{}\r\n'.includes(rtf[j])) j++;
    let run = rtf.slice(i, j);
    if (pendingSkip > 0) {
      const n = Math.min(pendingSkip, run.length);
      run = run.slice(n);
      pendingSkip -= n;
    }
    text(run);
    i = j;
  }
  if (para.length) endPara();
  return out.join('');
}

function parseStyleNames(rtf) {
  const names = new Map();
  const start = rtf.indexOf('{\\stylesheet');
  if (start < 0) return names;
  const re = /\{[^{}]*?\\s(\d+)[^{}]*?\s([^\\{};]+);\}/g;
  const block = rtf.slice(start, start + 20000);
  let m;
  while ((m = re.exec(block))) names.set(Number(m[1]), m[2].trim());
  return names;
}

const CP1252 = { 0x80: '€', 0x82: '‚', 0x84: '„', 0x85: '…', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x99: '™' };
function cp1252(code) {
  return CP1252[code] || String.fromCharCode(code);
}

function rtfText(s) {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (ch === '\\' || ch === '{' || ch === '}') out += `\\${ch}`;
    else if (ch === '\t') out += '\\tab ';
    else if (ch === '\u00a0') out += '\\~';
    else if (code < 128) out += ch;
    else if (code < 0x10000) out += `\\u${code > 32767 ? code - 65536 : code}?`;
    else {
      const hi = Math.floor((code - 0x10000) / 0x400) + 0xd800;
      const lo = ((code - 0x10000) % 0x400) + 0xdc00;
      out += `\\u${hi - 65536}?\\u${lo - 65536}?`;
    }
  }
  return out;
}

export function bookToRtf(book, images) {
  const L = book.layout;
  const tw = (inches) => Math.round(inches * 1440);
  const fs = Math.round(L.fontSize * 2);
  const parts = [];
  parts.push(
    `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\froman ${rtfText(L.fontFamily)};}}`,
    '{\\stylesheet{\\s0 Normal;}{\\s1\\outlinelevel0 heading 1;}{\\s2\\outlinelevel1 heading 2;}{\\s3\\outlinelevel2 heading 3;}}',
    `\\paperw${tw(L.pageWidth)}\\paperh${tw(L.pageHeight)}\\margt${tw(L.margins.top)}\\margr${tw(L.margins.right)}\\margb${tw(L.margins.bottom)}\\margl${tw(L.margins.left)}${L.orientation === 'landscape' ? '\\landscape' : ''}`,
    `\\f0\\fs${fs}\n`,
  );
  const para = (inner, { align, heading, pageBreak } = {}) => {
    const al = { center: '\\qc', right: '\\qr', justify: '\\qj' }[align] || '';
    const h = heading ? `\\s${heading}\\outlinelevel${heading - 1}\\b\\fs${[0, 40, 32, 28][heading]}` : `\\fs${fs}`;
    parts.push(`{\\pard${pageBreak ? '\\pagebb' : ''}${al}${h} ${inner}\\par}\n`);
  };
  const inline = (nodes = []) =>
    nodes
      .map((n) => {
        if (n.type === 'hardBreak') return '\\line ';
        if (n.type === 'image') {
          const img = images.get(n.attrs.src);
          if (!img) return '';
          return `{\\pict\\pngblip\\picwgoal${Math.round(img.widthPx * 15)}\\pichgoal${Math.round(img.heightPx * 15)} ${img.hex}}`;
        }
        if (n.type !== 'text') return '';
        let t = rtfText(n.text);
        for (const m of n.marks || []) {
          if (m.type === 'bold') t = `{\\b ${t}}`;
          else if (m.type === 'italic') t = `{\\i ${t}}`;
          else if (m.type === 'underline') t = `{\\ul ${t}}`;
          else if (m.type === 'strike') t = `{\\strike ${t}}`;
          else if (m.type === 'superscript') t = `{\\super ${t}}`;
          else if (m.type === 'subscript') t = `{\\sub ${t}}`;
        }
        return t;
      })
      .join('');
  let breakNext = false;
  const block = (n, prefix = '') => {
    const opts = { align: n.attrs?.textAlign, pageBreak: breakNext };
    switch (n.type) {
      case 'paragraph': para(prefix + inline(n.content), opts); breakNext = false; break;
      case 'heading': para(inline(n.content), { ...opts, heading: n.attrs.level }); breakNext = false; break;
      case 'blockquote': (n.content || []).forEach((c) => block(c, '\\tab ')); break;
      case 'bulletList': (n.content || []).forEach((li) => (li.content || []).forEach((c, i) => block(c, i === 0 ? '\\bullet\\tab ' : '\\tab '))); break;
      case 'orderedList': (n.content || []).forEach((li, k) => (li.content || []).forEach((c, i) => block(c, i === 0 ? `${k + 1}.\\tab ` : '\\tab '))); break;
      case 'sceneBreak': para(rtfText(n.attrs.symbol || '* * *'), { align: 'center', pageBreak: breakNext }); breakNext = false; break;
      case 'pageBreak': breakNext = true; break;
      case 'image': para(inline([n]), { align: 'center', pageBreak: breakNext }); breakNext = false; break;
      case 'table':
        (n.content || []).forEach((row) => para((row.content || []).map((cell) => (cell.content || []).map((p) => inline(p.content)).join(' ')).join('\\tab '), opts));
        breakNext = false;
        break;
      default: (n.content || []).forEach((c) => block(c));
    }
  };

  if (L.includeTitlePage) {
    para(`{\\b\\fs56 ${rtfText(book.title || 'Untitled Book')}}`, { align: 'center' });
    if (book.subtitle) para(`{\\i\\fs32 ${rtfText(book.subtitle)}}`, { align: 'center' });
    if (book.author) para(`\\fs28 by ${rtfText(book.author)}`, { align: 'center' });
    breakNext = true;
  }
  book.chapters.forEach((ch, idx) => {
    if (idx > 0 || L.includeTitlePage) breakNext = L.chapterNewPage || breakNext;
    if (ch.title) {
      para(rtfText(ch.title), { heading: 1, align: 'center', pageBreak: breakNext });
      breakNext = false;
    }
    (ch.doc.content || []).forEach((n) => block(n));
  });
  parts.push('}');
  return parts.join('');
}
