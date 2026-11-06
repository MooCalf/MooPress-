import { app, h, icon, on, emit, markDirty, escapeHtml } from './app.js';
import { uid } from './project.js';
import { openDialog, field, refreshIcons, toast } from './ui.js';

function changed() {
  markDirty();
  renderTitleArtwork();
  emit('meta-changed');
}

export async function addTitlePicture(file) {
  const project = app.project;
  const image = file || await window.moopress.pickImage();
  if (!image || app.project !== project) return;
  if (image.size > 8 * 1024 * 1024) toast('This picture will make the book file larger. You can resize it before adding it.', 'warn');
  project.titleImages.push({ id: uid(), src: image.dataUrl, alt: image.name.replace(/\.[^.]+$/, ''), width: 70, align: 'center', position: 'above', caption: '' });
  changed();
}

async function editTitlePicture(image) {
  const project = app.project;
  const width = h('input.field', { type: 'number', min: 10, max: 100, value: image.width });
  const alt = h('input.field', { value: image.alt });
  const caption = h('input.field', { value: image.caption });
  const select = (values, value) => h('select.field', {}, values.map(([key, label]) => h('option', { value: key, selected: key === value }, label)));
  const align = select([['left', 'Left'], ['center', 'Center'], ['right', 'Right']], image.align);
  const position = select([['above', 'Above the title'], ['below', 'Below the author']], image.position);
  let replacement = null;
  const preview = h('img.title-art-preview', { src: image.src, alt: image.alt });
  const replace = h('button.btn', { onclick: async () => {
    const picked = await window.moopress.pickImage();
    if (picked) { replacement = picked.dataUrl; preview.src = replacement; }
  } }, icon('image'), 'Replace picture');
  const result = await openDialog({
    title: 'Title page picture', width: 480,
    body: h('div', {}, preview, replace, h('div.form-grid', {}, field('Width (% of page content)', width), field('Alignment', align), field('Position', position), field('Alternative text', alt)), field('Caption', caption)),
    buttons: [{ label: 'Remove picture', value: 'remove', danger: true }, { label: 'Cancel', value: null }, { label: 'Apply', value: true, primary: true }],
  });
  if (!result || app.project !== project || !project.titleImages.includes(image)) return;
  if (result === 'remove') project.titleImages.splice(project.titleImages.indexOf(image), 1);
  else Object.assign(image, { src: replacement || image.src, width: Math.max(10, Math.min(100, +width.value || 70)), align: align.value, position: position.value, alt: alt.value, caption: caption.value });
  changed();
}

function renderTitleArtwork() {
  if (!app.project) return;
  for (const position of ['above', 'below']) {
    const target = document.getElementById(`tp-art-${position}`);
    target.replaceChildren(...app.project.titleImages.filter((image) => image.position === position).map((image) =>
      h('figure.title-art', { style: { width: `${image.width}%`, marginLeft: image.align === 'left' ? '0' : 'auto', marginRight: image.align === 'right' ? '0' : 'auto' } },
        h('button.title-art-button', { onclick: () => editTitlePicture(image), 'aria-label': `Edit title picture: ${image.alt || 'Picture'}` }, h('img', { src: image.src, alt: image.alt })),
        image.caption && h('figcaption', {}, image.caption), h('button.btn.small.title-art-edit', { onclick: () => editTitlePicture(image) }, 'Edit picture'))));
  }
}

export function titleArtworkHTML(project, position) {
  return (project.titleImages || []).filter((image) => image.position === position).map((image) =>
    `<figure class="title-art" style="width:${Math.max(10, Math.min(100, +image.width || 70))}%;margin-left:${image.align === 'left' ? '0' : 'auto'};margin-right:${image.align === 'right' ? '0' : 'auto'}"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" style="width:100%;max-height:4in;object-fit:contain">${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ''}</figure>`).join('');
}

export function initTitleArtwork() {
  const inner = document.querySelector('.tp-inner');
  inner.prepend(h('div', { id: 'tp-art-above' }));
  document.getElementById('tp-author').after(h('div', { id: 'tp-art-below' }));
  inner.append(h('button.btn.tp-add-picture', { onclick: () => addTitlePicture() }, icon('image-plus'), 'Add title page picture'));
  refreshIcons(inner);
  document.getElementById('title-page').addEventListener('focusin', () => { if (app.view !== 'title') import('./editor.js').then(({ openView }) => openView('title', { scroll: false })); });
  const page = document.getElementById('title-page');
  page.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.items || [])].some((item) => item.type.startsWith('image/'))) e.preventDefault(); });
  const addFiles = async (files) => {
    for (const file of files) {
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      await addTitlePicture({ dataUrl, name: file.name, size: file.size });
    }
  };
  page.addEventListener('drop', (e) => {
    const files = [...(e.dataTransfer?.files || [])].filter((file) => file.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); addFiles(files).catch(console.error); }
  });
  page.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((file) => file.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); addFiles(files).catch(console.error); }
  });
  on('project-loaded', renderTitleArtwork);
}
