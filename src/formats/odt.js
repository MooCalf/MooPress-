import JSZip from 'jszip';

const NS = {
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  draw: 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
  xlink: 'http://www.w3.org/1999/xlink',
  svg: 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0',
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function readStyles(xmlDocs) {
  const styles = new Map();
  for (const doc of xmlDocs) {
    for (const s of doc.getElementsByTagNameNS(NS.style, 'style')) {
      const name = s.getAttributeNS(NS.style, 'name');
      const t = s.getElementsByTagNameNS(NS.style, 'text-properties')[0];
      const p = s.getElementsByTagNameNS(NS.style, 'paragraph-properties')[0];
      styles.set(name, {
        parent: s.getAttributeNS(NS.style, 'parent-style-name'),
        display: s.getAttributeNS(NS.style, 'display-name') || name,
        bold: t?.getAttributeNS(NS.fo, 'font-weight') === 'bold',
        italic: t?.getAttributeNS(NS.fo, 'font-style') === 'italic',
        underline: !!t && (t.getAttributeNS(NS.style, 'text-underline-style') || 'none') !== 'none',
        strike: !!t && (t.getAttributeNS(NS.style, 'text-line-through-style') || 'none') !== 'none',
        align: p?.getAttributeNS(NS.fo, 'text-align') || '',
        breakBefore: p?.getAttributeNS(NS.fo, 'break-before') === 'page',
      });
    }
  }
  const resolve = (name, seen = new Set()) => {
    const s = styles.get(name);
    if (!s || seen.has(name)) return s || {};
    seen.add(name);
    const parent = s.parent ? resolve(s.parent, seen) : {};
    return { ...parent, ...Object.fromEntries(Object.entries(s).filter(([, v]) => v)) };
  };
  return resolve;
}

export async function odtToHtml(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const parse = async (name) => {
    const f = zip.file(name);
    return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null;
  };
  const content = await parse('content.xml');
  if (!content) throw new Error('This .odt file has no content.');
  const stylesDoc = await parse('styles.xml');
  const style = readStyles([stylesDoc, content].filter(Boolean));
  const pictures = new Map();
  for (const name of Object.keys(zip.files).filter((n) => n.startsWith('Pictures/'))) {
    const ext = name.split('.').pop().toLowerCase();
    const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' }[ext];
    if (mime) pictures.set(name, `data:${mime};base64,${await zip.file(name).async('base64')}`);
  }

  const inline = (node) => {
    let html = '';
    for (const n of node.childNodes) {
      if (n.nodeType === 3) html += esc(n.nodeValue);
      else if (n.namespaceURI === NS.text && n.localName === 's') html += ' '.repeat(Number(n.getAttributeNS(NS.text, 'c') || 1));
      else if (n.namespaceURI === NS.text && n.localName === 'tab') html += '\t';
      else if (n.namespaceURI === NS.text && n.localName === 'line-break') html += '<br>';
      else if (n.namespaceURI === NS.text && n.localName === 'span') {
        const st = style(n.getAttributeNS(NS.text, 'style-name'));
        let inner = inline(n);
        if (st.bold) inner = `<strong>${inner}</strong>`;
        if (st.italic) inner = `<em>${inner}</em>`;
        if (st.underline) inner = `<u>${inner}</u>`;
        if (st.strike) inner = `<s>${inner}</s>`;
        html += inner;
      } else if (n.namespaceURI === NS.text && n.localName === 'a') html += `<a href="${esc(n.getAttributeNS(NS.xlink, 'href'))}">${inline(n)}</a>`;
      else if (n.namespaceURI === NS.draw && n.localName === 'frame') {
        const img = n.getElementsByTagNameNS(NS.draw, 'image')[0];
        const src = img && pictures.get(img.getAttributeNS(NS.xlink, 'href'));
        const w = parseFloat(n.getAttributeNS(NS.svg, 'width'));
        const unit = (n.getAttributeNS(NS.svg, 'width') || '').replace(/[\d.]/g, '');
        const px = unit === 'in' ? w * 96 : unit === 'cm' ? (w / 2.54) * 96 : unit === 'mm' ? (w / 25.4) * 96 : 0;
        if (src) html += `<img src="${src}"${px ? ` style="width:${Math.round(px)}px"` : ''}>`;
      } else if (n.nodeType === 1 && !['annotation', 'note', 'bookmark', 'bookmark-start', 'bookmark-end', 'soft-page-break'].includes(n.localName)) html += inline(n);
    }
    return html;
  };

  const blocks = (node) => {
    const out = [];
    for (const n of node.children) {
      if (n.namespaceURI === NS.text && (n.localName === 'p' || n.localName === 'h')) {
        const st = style(n.getAttributeNS(NS.text, 'style-name'));
        if (st.breakBefore) out.push('<div class="page-break-marker"></div>');
        const align = st.align && st.align !== 'start' && st.align !== 'left' ? ` style="text-align:${st.align === 'end' ? 'right' : st.align}"` : '';
        let level = n.localName === 'h' ? Number(n.getAttributeNS(NS.text, 'outline-level') || 1) : 0;
        if (!level && /^title$/i.test(st.display || '')) level = 1;
        const tag = level ? `h${Math.min(3, level)}` : 'p';
        const cls = /^title$/i.test(st.display || '') ? ' class="book-title"' : /^subtitle$/i.test(st.display || '') ? ' class="book-subtitle"' : '';
        out.push(`<${tag}${cls}${align}>${inline(n)}</${tag}>`);
      } else if (n.namespaceURI === NS.text && n.localName === 'list') {
        const items = [...n.children].filter((c) => c.localName === 'list-item').map((li) => `<li>${blocks(li)}</li>`);
        out.push(`<ul>${items.join('')}</ul>`);
      } else if (n.namespaceURI === NS.table && n.localName === 'table') {
        const rows = [...n.getElementsByTagNameNS(NS.table, 'table-row')].map((r) => `<tr>${[...r.getElementsByTagNameNS(NS.table, 'table-cell')].map((c) => `<td>${blocks(c)}</td>`).join('')}</tr>`);
        out.push(`<table>${rows.join('')}</table>`);
      } else if (n.namespaceURI === NS.text && n.localName === 'section') {
        out.push(blocks(n));
      }
    }
    return out.join('');
  };

  const body = content.getElementsByTagNameNS(NS.office, 'text')[0];
  return body ? blocks(body) : '';
}

export async function bookToOdt(book, images) {
  const L = book.layout;
  const inch = (v) => `${v.toFixed(3)}in`;
  const textStyles = new Map();
  const spanStyle = (marks) => {
    const key = ['bold', 'italic', 'underline', 'strike'].map((m) => (marks.some((x) => x.type === m) ? m[0] : '-')).join('');
    if (key === '----') return null;
    if (!textStyles.has(key)) textStyles.set(key, `T${textStyles.size + 1}`);
    return textStyles.get(key);
  };
  const pictures = [];
  let pic = 0;
  const inline = (nodes = []) =>
    nodes
      .map((n) => {
        if (n.type === 'hardBreak') return '<text:line-break/>';
        if (n.type === 'image') {
          const img = images.get(n.attrs.src);
          if (!img) return '';
          const name = `Pictures/image${++pic}.png`;
          pictures.push({ name, base64: img.base64 });
          return `<draw:frame draw:style-name="fr1" text:anchor-type="as-char" svg:width="${inch(img.widthPx / 96)}" svg:height="${inch(img.heightPx / 96)}"><draw:image xlink:href="${name}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>`;
        }
        if (n.type !== 'text') return '';
        const t = esc(n.text).replace(/\t/g, '<text:tab/>').replace(/ {2,}/g, (m) => ` <text:s text:c="${m.length - 1}"/>`);
        const st = spanStyle(n.marks || []);
        return st ? `<text:span text:style-name="${st}">${t}</text:span>` : t;
      })
      .join('');
  const pStyle = (align, pageBreak) => `P_${align || 'start'}${pageBreak ? '_br' : ''}`;
  let breakNext = false;
  const out = [];
  const block = (n) => {
    const style = pStyle(n.attrs?.textAlign, breakNext);
    switch (n.type) {
      case 'paragraph': out.push(`<text:p text:style-name="${style}">${inline(n.content)}</text:p>`); breakNext = false; break;
      case 'heading': out.push(`<text:h text:style-name="Heading_20_${n.attrs.level}" text:outline-level="${n.attrs.level}">${inline(n.content)}</text:h>`); breakNext = false; break;
      case 'blockquote': (n.content || []).forEach((c) => out.push(`<text:p text:style-name="Quotations">${inline(c.content)}</text:p>`)); break;
      case 'bulletList':
      case 'orderedList':
        out.push(`<text:list text:style-name="${n.type === 'bulletList' ? 'L_bullet' : 'L_number'}">`);
        (n.content || []).forEach((li) => out.push(`<text:list-item>${(li.content || []).map((p) => `<text:p text:style-name="P_start">${inline(p.content)}</text:p>`).join('')}</text:list-item>`));
        out.push('</text:list>');
        break;
      case 'sceneBreak': out.push(`<text:p text:style-name="${pStyle('center', breakNext)}">${esc(n.attrs.symbol || '* * *')}</text:p>`); breakNext = false; break;
      case 'pageBreak': breakNext = true; break;
      case 'image': out.push(`<text:p text:style-name="${pStyle('center', breakNext)}">${inline([n])}</text:p>`); breakNext = false; break;
      case 'table': {
        const rows = n.content || [];
        const cols = Math.max(1, ...rows.map((r) => (r.content || []).length));
        out.push(`<table:table table:name="Table${out.length}"><table:table-column table:number-columns-repeated="${cols}"/>`);
        rows.forEach((r) => out.push(`<table:table-row>${(r.content || []).map((c) => `<table:table-cell office:value-type="string">${(c.content || []).map((p) => `<text:p text:style-name="P_start">${inline(p.content)}</text:p>`).join('')}</table:table-cell>`).join('')}</table:table-row>`));
        out.push('</table:table>');
        breakNext = false;
        break;
      }
      default: (n.content || []).forEach(block);
    }
  };

  if (L.includeTitlePage) {
    out.push(`<text:p text:style-name="Title">${esc(book.title || 'Untitled Book')}</text:p>`);
    if (book.subtitle) out.push(`<text:p text:style-name="Subtitle">${esc(book.subtitle)}</text:p>`);
    if (book.author) out.push(`<text:p text:style-name="${pStyle('center')}">by ${esc(book.author)}</text:p>`);
    breakNext = true;
  }
  book.chapters.forEach((ch, idx) => {
    if (idx > 0) breakNext = breakNext || L.chapterNewPage;
    if (ch.title) {
      out.push(`<text:h text:style-name="${breakNext ? 'Heading_20_1_br' : 'Heading_20_1'}" text:outline-level="1">${esc(ch.title)}</text:h>`);
      breakNext = false;
    }
    (ch.doc.content || []).forEach(block);
  });

  const tProps = (key) => [
    key[0] === 'b' && 'fo:font-weight="bold"',
    key[1] === 'i' && 'fo:font-style="italic"',
    key[2] === 'u' && 'style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"',
    key[3] === 's' && 'style:text-line-through-style="solid"',
  ].filter(Boolean).join(' ');
  const pStyles = [];
  for (const align of ['start', 'center', 'end', 'justify', 'left', 'right']) {
    for (const br of [false, true]) {
      const name = `P_${align}${br ? '_br' : ''}`;
      const foAlign = align === 'left' ? 'start' : align === 'right' ? 'end' : align;
      pStyles.push(`<style:style style:name="${name}" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:text-align="${foAlign}"${br ? ' fo:break-before="page"' : ''}/></style:style>`);
    }
  }
  pStyles.push('<style:style style:name="Heading_20_1_br" style:display-name="Heading 1" style:family="paragraph" style:parent-style-name="Heading_20_1"><style:paragraph-properties fo:break-before="page"/></style:style>');

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="${NS.office}" xmlns:style="${NS.style}" xmlns:text="${NS.text}" xmlns:table="${NS.table}" xmlns:draw="${NS.draw}" xmlns:fo="${NS.fo}" xmlns:xlink="${NS.xlink}" xmlns:svg="${NS.svg}" office:version="1.3">
<office:automatic-styles>
${[...textStyles].map(([key, name]) => `<style:style style:name="${name}" style:family="text"><style:text-properties ${tProps(key)}/></style:style>`).join('\n')}
${pStyles.join('\n')}
<style:style style:name="fr1" style:family="graphic"><style:graphic-properties style:wrap="none"/></style:style>
<text:list-style style:name="L_bullet"><text:list-level-style-bullet text:level="1" text:bullet-char="•"><style:list-level-properties text:space-before="0.25in" text:min-label-width="0.25in"/></text:list-level-style-bullet></text:list-style>
<text:list-style style:name="L_number"><text:list-level-style-number text:level="1" style:num-format="1" style:num-suffix="."><style:list-level-properties text:space-before="0.25in" text:min-label-width="0.25in"/></text:list-level-style-number></text:list-style>
</office:automatic-styles>
<office:body><office:text>
${out.join('\n')}
</office:text></office:body></office:document-content>`;

  const styles = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="${NS.office}" xmlns:style="${NS.style}" xmlns:text="${NS.text}" xmlns:fo="${NS.fo}" office:version="1.3">
<office:font-face-decls><style:font-face style:name="${esc(L.fontFamily)}" svg:font-family="'${esc(L.fontFamily)}'" xmlns:svg="${NS.svg}"/></office:font-face-decls>
<office:styles>
<style:default-style style:family="paragraph"><style:text-properties style:font-name="${esc(L.fontFamily)}" fo:font-size="${L.fontSize}pt"/></style:default-style>
<style:style style:name="Standard" style:family="paragraph"><style:paragraph-properties fo:line-height="${Math.round(L.lineHeight * 100)}%"${L.paragraphStyle === 'book' ? ' fo:text-indent="0.3in"' : ' fo:margin-bottom="0.11in"'}/></style:style>
<style:style style:name="Heading_20_1" style:display-name="Heading 1" style:family="paragraph" style:default-outline-level="1"><style:paragraph-properties fo:text-align="center" fo:margin-top="0.6in" fo:margin-bottom="0.3in"/><style:text-properties fo:font-size="20pt" fo:font-weight="bold"/></style:style>
<style:style style:name="Heading_20_2" style:display-name="Heading 2" style:family="paragraph" style:default-outline-level="2"><style:paragraph-properties fo:margin-top="0.2in" fo:margin-bottom="0.1in"/><style:text-properties fo:font-size="16pt" fo:font-weight="bold"/></style:style>
<style:style style:name="Heading_20_3" style:display-name="Heading 3" style:family="paragraph" style:default-outline-level="3"><style:text-properties fo:font-size="13pt" fo:font-weight="bold"/></style:style>
<style:style style:name="Title" style:family="paragraph"><style:paragraph-properties fo:text-align="center" fo:margin-top="2.5in"/><style:text-properties fo:font-size="28pt" fo:font-weight="bold"/></style:style>
<style:style style:name="Subtitle" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-size="16pt" fo:font-style="italic"/></style:style>
<style:style style:name="Quotations" style:family="paragraph"><style:paragraph-properties fo:margin-left="0.4in" fo:margin-right="0.4in"/><style:text-properties fo:font-style="italic"/></style:style>
</office:styles>
<office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="${inch(L.pageWidth)}" fo:page-height="${inch(L.pageHeight)}" style:print-orientation="${L.orientation}" fo:margin-top="${inch(L.margins.top)}" fo:margin-bottom="${inch(L.margins.bottom)}" fo:margin-left="${inch(L.margins.left)}" fo:margin-right="${inch(L.margins.right)}"/></style:page-layout></office:automatic-styles>
<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles>
</office:document-styles>`;

  const meta = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="${NS.office}" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.3"><office:meta><meta:generator>MooPress</meta:generator><dc:title>${esc(book.title || '')}</dc:title><meta:initial-creator>${esc(book.author || '')}</meta:initial-creator></office:meta></office:document-meta>`;

  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
  zip.file('content.xml', content);
  zip.file('styles.xml', styles);
  zip.file('meta.xml', meta);
  for (const p of pictures) zip.file(p.name, p.base64, { base64: true });
  zip.file(
    'META-INF/manifest.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
${pictures.map((p) => `<manifest:file-entry manifest:full-path="${p.name}" manifest:media-type="image/png"/>`).join('\n')}
</manifest:manifest>`,
  );
  return zip.generateAsync({ type: 'uint8array', mimeType: 'application/vnd.oasis.opendocument.text' });
}
