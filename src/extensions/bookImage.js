import Image from '@tiptap/extension-image';
import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { app } from '../app.js';

export const IMAGE_DEFAULTS = {
  width: null,
  align: 'center',
  brightness: 100,
  contrast: 100,
  saturate: 100,
  grayscale: 0,
  sepia: 0,
  blur: 0,
  rotate: 0,
  flipH: false,
  rounded: 0,
  shadow: false,
  border: false,
  chart: null,
  shape: null,
};

export function imageCss(a) {
  const filters = [];
  if (a.brightness !== 100) filters.push(`brightness(${a.brightness}%)`);
  if (a.contrast !== 100) filters.push(`contrast(${a.contrast}%)`);
  if (a.saturate !== 100) filters.push(`saturate(${a.saturate}%)`);
  if (a.grayscale) filters.push(`grayscale(${a.grayscale}%)`);
  if (a.sepia) filters.push(`sepia(${a.sepia}%)`);
  if (a.blur) filters.push(`blur(${a.blur}px)`);
  const transforms = [];
  if (a.rotate) transforms.push(`rotate(${a.rotate}deg)`);
  if (a.flipH) transforms.push('scaleX(-1)');
  const css = ['max-width: 100%', 'height: auto'];
  if (a.width) css.push(`width: ${a.width}px`);
  if (filters.length) css.push(`filter: ${filters.join(' ')}`);
  if (transforms.length) css.push(`transform: ${transforms.join(' ')}`);
  if (a.rounded) css.push(`border-radius: ${a.rounded}px`);
  if (a.shadow) css.push('box-shadow: 0 6px 18px rgba(0,0,0,.28)');
  if (a.border) css.push('border: 3px solid #fff; outline: 1px solid #c9c4bd');
  return css.join('; ');
}

function placementCss(align) {
  switch (align) {
    case 'left': return 'display: block; margin: 0.6em auto 0.6em 0';
    case 'right': return 'display: block; margin: 0.6em 0 0.6em auto';
    case 'wrap-left': return 'float: left; margin: 0.2em 1em 0.6em 0';
    case 'wrap-right': return 'float: right; margin: 0.2em 0 0.6em 1em';
    default: return 'display: block; margin: 0.6em auto';
  }
}

function attr(name) {
  const def = IMAGE_DEFAULTS[name];
  return {
    default: def,
    rendered: false,
    parseHTML: (el) => {
      const v = el.getAttribute(`data-${name}`);
      if (v == null) return def;
      if (typeof def === 'number') return Number(v);
      if (typeof def === 'boolean') return v === 'true';
      return v;
    },
  };
}

export const BookImage = Image.extend({
  draggable: true,

  addAttributes() {
    const extra = Object.fromEntries(Object.keys(IMAGE_DEFAULTS).map((k) => [k, attr(k)]));
    extra.width = {
      default: null,
      rendered: false,
      parseHTML: (el) => Number(el.getAttribute('data-width') || parseInt(el.style.width, 10) || el.getAttribute('width')) || null,
    };
    return { ...this.parent?.(), ...extra };
  },

  renderHTML({ node, HTMLAttributes }) {
    const a = node.attrs;
    const data = {};
    for (const k of Object.keys(IMAGE_DEFAULTS)) {
      if (a[k] !== IMAGE_DEFAULTS[k] && a[k] != null) data[`data-${k}`] = String(a[k]);
    }
    return ['img', { ...HTMLAttributes, ...data, style: `${placementCss(a.align)}; ${imageCss(a)}` }];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current = node;
      const dom = document.createElement('div');
      const frame = document.createElement('span');
      frame.className = 'img-frame';
      const img = document.createElement('img');
      img.draggable = false;
      const handle = document.createElement('span');
      handle.className = 'img-resize';
      handle.title = 'Drag to resize';
      frame.append(img, handle);
      dom.append(frame);

      const render = (n) => {
        dom.className = `img-node align-${n.attrs.align}`;
        img.src = n.attrs.src;
        img.alt = n.attrs.alt || '';
        img.title = n.attrs.title || '';
        img.style.cssText = imageCss(n.attrs);
      };
      render(node);

      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const scale = img.getBoundingClientRect().width / (img.offsetWidth || 1) || 1;
        const startX = e.clientX;
        const startW = img.offsetWidth;
        const { align } = current.attrs;
        const dir = align === 'right' || align === 'wrap-right' ? -1 : align === 'center' ? 2 : 1;
        const maxW = dom.parentElement?.clientWidth || 2000;
        let w = startW;
        const move = (ev) => {
          w = Math.round(Math.max(40, Math.min(maxW, startW + ((ev.clientX - startX) / scale) * dir)));
          img.style.width = `${w}px`;
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          const pos = getPos();
          if (typeof pos !== 'number') return;
          editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, width: w }));
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });

      return {
        dom,
        update(n) {
          if (n.type !== current.type) return false;
          current = n;
          render(n);
          return true;
        },
        selectNode: () => dom.classList.add('selected'),
        deselectNode: () => dom.classList.remove('selected'),
        stopEvent: (e) => e.target === handle,
        ignoreMutation: () => true,
      };
    };
  },
});

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export const ImageDropPaste = Extension.create({
  name: 'imageDropPaste',
  addProseMirrorPlugins() {
    const insertFiles = async (view, files, pos) => {
      for (const file of files) {
        const src = await readAsDataUrl(file);
        const node = view.state.schema.nodes.image.create({ src, alt: file.name.replace(/\.[^.]+$/, '') });
        const at = pos ?? view.state.selection.from;
        view.dispatch(view.state.tr.insert(Math.min(at, view.state.doc.content.size), node));
      }
    };
    const images = (list) => [...(list || [])].filter((f) => f.type.startsWith('image/'));
    return [
      new Plugin({
        props: {
          handlePaste(view, event) {
            const files = images(event.clipboardData?.files);
            if (!files.length) return false;
            insertFiles(view, files);
            return true;
          },
          handleDrop(view, event, _slice, moved) {
            if (moved) return false;
            const files = images(event.dataTransfer?.files);
            if (!files.length) return false;
            event.preventDefault();
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
            insertFiles(view, files, coords?.pos);
            return true;
          },
        },
      }),
    ];
  },
});

export function selectedImage(editor = app.editor) {
  const sel = editor?.state.selection;
  return sel?.node?.type.name === 'image' ? sel.node : null;
}
