import { escapeHtml } from './app.js';

export function svgDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const star = (cx, cy, outer, inner, points) => {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI / points) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
};
const polygon = (cx, cy, r, sides, rot = -Math.PI / 2) =>
  Array.from({ length: sides }, (_, i) => {
    const a = rot + (2 * Math.PI * i) / sides;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

export const SHAPES = {
  rectangle: { label: 'Rectangle', draw: (s) => `<rect x="${s}" y="${s + 30}" width="${200 - 2 * s}" height="${140 - 2 * s}"/>` },
  rounded: { label: 'Rounded rectangle', draw: (s) => `<rect x="${s}" y="${s + 30}" width="${200 - 2 * s}" height="${140 - 2 * s}" rx="22"/>` },
  square: { label: 'Square', draw: (s) => `<rect x="${s}" y="${s}" width="${200 - 2 * s}" height="${200 - 2 * s}"/>` },
  circle: { label: 'Circle', draw: (s) => `<circle cx="100" cy="100" r="${100 - s}"/>` },
  ellipse: { label: 'Oval', draw: (s) => `<ellipse cx="100" cy="100" rx="${100 - s}" ry="${70 - s}"/>` },
  triangle: { label: 'Triangle', draw: (s) => `<polygon points="100,${s + 8} ${200 - s},${190 - s} ${s},${190 - s}"/>` },
  diamond: { label: 'Diamond', draw: (s) => `<polygon points="100,${s} ${200 - s},100 100,${200 - s} ${s},100"/>` },
  pentagon: { label: 'Pentagon', draw: (s) => `<polygon points="${polygon(100, 105, 98 - s, 5)}"/>` },
  hexagon: { label: 'Hexagon', draw: (s) => `<polygon points="${polygon(100, 100, 100 - s, 6, 0)}"/>` },
  star: { label: 'Star', draw: (s) => `<polygon points="${star(100, 106, 98 - s, 40, 5)}"/>` },
  arrow: { label: 'Arrow', draw: (s) => `<polygon points="${s},70 120,70 120,${s + 25} ${200 - s},100 120,${175 - s} 120,130 ${s},130"/>` },
  heart: {
    label: 'Heart',
    draw: () => '<path d="M100 178 C 40 135 8 100 8 62 C 8 32 32 12 58 12 C 78 12 92 24 100 40 C 108 24 122 12 142 12 C 168 12 192 32 192 62 C 192 100 160 135 100 178 Z"/>',
  },
  speech: {
    label: 'Speech bubble',
    draw: (s) => `<path d="M${s + 20} ${s + 20} H${180 - s} Q${200 - s} ${s + 20} ${200 - s} ${s + 40} V125 Q${200 - s} 145 ${180 - s} 145 H85 L45 ${195 - s} L55 145 H${s + 20} Q${s} 145 ${s} 125 V${s + 40} Q${s} ${s + 20} ${s + 20} ${s + 20} Z"/>`,
  },
  banner: { label: 'Banner', draw: (s) => `<polygon points="${s},55 ${200 - s},55 175,100 ${200 - s},145 ${s},145 25,100"/>` },
  line: { label: 'Line', line: true, draw: (s) => `<line x1="${s + 4}" y1="100" x2="${196 - s}" y2="100"/>` },
};

export const DEFAULT_SHAPE = { kind: 'rounded', fill: '#dbe7fb', stroke: '#2f6fdb', strokeWidth: 3, text: '', textColor: '#1f2937', fontSize: 22, noFill: false };

export function shapeSvg(spec) {
  const s = { ...DEFAULT_SHAPE, ...spec };
  const def = SHAPES[s.kind] || SHAPES.rectangle;
  const inset = Math.max(1, s.strokeWidth / 2);
  const fill = def.line || s.noFill ? 'none' : s.fill;
  const text = s.text
    ? `<text x="100" y="100" text-anchor="middle" dominant-baseline="central" font-family="Segoe UI, Arial, sans-serif" font-size="${s.fontSize}" fill="${s.textColor}">${escapeHtml(s.text)}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><g fill="${fill}" stroke="${s.strokeWidth ? s.stroke : 'none'}" stroke-width="${s.strokeWidth}" stroke-linejoin="round" stroke-linecap="round">${def.draw(inset)}</g>${text}</svg>`;
}

export const CHART_TYPES = {
  column: { label: 'Column', icon: 'bar-chart-3' },
  bar: { label: 'Bar', icon: 'bar-chart-horizontal' },
  line: { label: 'Line', icon: 'line-chart' },
  pie: { label: 'Pie', icon: 'pie-chart' },
  doughnut: { label: 'Doughnut', icon: 'circle-dot' },
};

export const CHART_PALETTES = {
  classic: ['#2f6fdb', '#e8833a', '#3fa66b', '#d64550', '#8a5cc7', '#2fa6a6', '#c9a227', '#6b7280'],
  warm: ['#9a3412', '#c2410c', '#ea580c', '#f59e0b', '#d97706', '#b45309', '#78350f', '#fbbf24'],
  cool: ['#1e3a8a', '#1d4ed8', '#3b82f6', '#0891b2', '#0d9488', '#4f46e5', '#7c3aed', '#60a5fa'],
  ink: ['#111827', '#374151', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#1f2937', '#e5e7eb'],
};

export const DEFAULT_CHART = {
  type: 'column',
  title: 'Chapter word counts',
  palette: 'classic',
  showValues: true,
  rows: [
    { label: 'Ch. 1', value: 3200 },
    { label: 'Ch. 2', value: 4100 },
    { label: 'Ch. 3', value: 2800 },
    { label: 'Ch. 4', value: 3900 },
  ],
};

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function fmt(n) {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function chartSvg(spec) {
  const c = { ...DEFAULT_CHART, ...spec };
  const rows = (c.rows || []).filter((r) => r.label !== '' || r.value !== '').map((r) => ({ label: String(r.label ?? ''), value: Number(r.value) || 0 }));
  const colors = CHART_PALETTES[c.palette] || CHART_PALETTES.classic;
  const W = 640;
  const H = 400;
  const font = 'font-family="Segoe UI, Arial, sans-serif"';
  const parts = [`<rect width="${W}" height="${H}" fill="#ffffff"/>`];
  const titleH = c.title ? 44 : 14;
  if (c.title) parts.push(`<text x="${W / 2}" y="30" text-anchor="middle" ${font} font-size="20" font-weight="600" fill="#1f2937">${escapeHtml(c.title)}</text>`);

  if (!rows.length) {
    parts.push(`<text x="${W / 2}" y="${H / 2}" text-anchor="middle" ${font} font-size="16" fill="#6b7280">Add some data to see your chart</text>`);
  } else if (c.type === 'pie' || c.type === 'doughnut') {
    const total = rows.reduce((s, r) => s + Math.max(0, r.value), 0) || 1;
    const cx = 220;
    const cy = titleH + (H - titleH) / 2;
    const r = Math.min(150, (H - titleH) / 2 - 16);
    let a0 = -Math.PI / 2;
    rows.forEach((row, i) => {
      const frac = Math.max(0, row.value) / total;
      const a1 = a0 + frac * Math.PI * 2;
      const color = colors[i % colors.length];
      if (frac >= 0.9999) parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`);
      else if (frac > 0) {
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
        const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
        parts.push(`<path d="M${cx},${cy} L${p0[0].toFixed(2)},${p0[1].toFixed(2)} A${r},${r} 0 ${large} 1 ${p1[0].toFixed(2)},${p1[1].toFixed(2)} Z" fill="${color}" stroke="#fff" stroke-width="2"/>`);
      }
      if (c.showValues && frac > 0.04) {
        const mid = (a0 + a1) / 2;
        const lr = c.type === 'doughnut' ? r * 0.78 : r * 0.62;
        parts.push(`<text x="${(cx + lr * Math.cos(mid)).toFixed(1)}" y="${(cy + lr * Math.sin(mid)).toFixed(1)}" text-anchor="middle" dominant-baseline="central" ${font} font-size="14" font-weight="600" fill="#fff">${Math.round(frac * 100)}%</text>`);
      }
      a0 = a1;
    });
    if (c.type === 'doughnut') parts.push(`<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="#fff"/>`);
    const lx = 420;
    let ly = cy - (rows.length * 26) / 2 + 13;
    rows.forEach((row, i) => {
      parts.push(`<rect x="${lx}" y="${ly - 8}" width="16" height="16" rx="3" fill="${colors[i % colors.length]}"/>`);
      parts.push(`<text x="${lx + 26}" y="${ly}" dominant-baseline="central" ${font} font-size="15" fill="#374151">${escapeHtml(row.label)}${c.showValues ? ` (${fmt(row.value)})` : ''}</text>`);
      ly += 26;
    });
  } else {
    const horizontal = c.type === 'bar';
    const maxLabel = Math.max(...rows.map((r) => r.label.length));
    const left = horizontal ? Math.min(180, 20 + maxLabel * 8) : 64;
    const right = 28;
    const top = titleH + 8;
    const bottom = horizontal ? 36 : 56;
    const pw = W - left - right;
    const ph = H - top - bottom;
    const max = niceMax(Math.max(...rows.map((r) => r.value), 0));
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const v = (max / ticks) * i;
      if (horizontal) {
        const x = left + (pw * i) / ticks;
        parts.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${top + ph}" stroke="#e5e7eb"/>`);
        parts.push(`<text x="${x}" y="${top + ph + 20}" text-anchor="middle" ${font} font-size="12" fill="#6b7280">${fmt(v)}</text>`);
      } else {
        const y = top + ph - (ph * i) / ticks;
        parts.push(`<line x1="${left}" y1="${y}" x2="${left + pw}" y2="${y}" stroke="#e5e7eb"/>`);
        parts.push(`<text x="${left - 10}" y="${y}" text-anchor="end" dominant-baseline="central" ${font} font-size="12" fill="#6b7280">${fmt(v)}</text>`);
      }
    }
    const n = rows.length;
    const band = (horizontal ? ph : pw) / n;
    if (c.type === 'line') {
      const pts = rows.map((r, i) => [left + band * (i + 0.5), top + ph - (Math.max(0, r.value) / max) * ph]);
      parts.push(`<polyline points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${colors[0]}" stroke-width="3" stroke-linejoin="round"/>`);
      pts.forEach((p, i) => {
        parts.push(`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5" fill="#fff" stroke="${colors[0]}" stroke-width="3"/>`);
        if (c.showValues) parts.push(`<text x="${p[0].toFixed(1)}" y="${(p[1] - 14).toFixed(1)}" text-anchor="middle" ${font} font-size="12" fill="#374151">${fmt(rows[i].value)}</text>`);
      });
    } else {
      rows.forEach((r, i) => {
        const len = (Math.max(0, r.value) / max) * (horizontal ? pw : ph);
        const thick = band * 0.62;
        const color = colors[i % colors.length];
        if (horizontal) {
          const y = top + band * i + (band - thick) / 2;
          parts.push(`<rect x="${left}" y="${y.toFixed(1)}" width="${len.toFixed(1)}" height="${thick.toFixed(1)}" rx="3" fill="${color}"/>`);
          if (c.showValues) parts.push(`<text x="${(left + len + 6).toFixed(1)}" y="${(y + thick / 2).toFixed(1)}" dominant-baseline="central" ${font} font-size="12" fill="#374151">${fmt(r.value)}</text>`);
        } else {
          const x = left + band * i + (band - thick) / 2;
          const y = top + ph - len;
          parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${thick.toFixed(1)}" height="${len.toFixed(1)}" rx="3" fill="${color}"/>`);
          if (c.showValues) parts.push(`<text x="${(x + thick / 2).toFixed(1)}" y="${(y - 8).toFixed(1)}" text-anchor="middle" ${font} font-size="12" fill="#374151">${fmt(r.value)}</text>`);
        }
      });
    }
    rows.forEach((r, i) => {
      const label = escapeHtml(r.label.length > 18 ? `${r.label.slice(0, 17)}…` : r.label);
      if (horizontal) parts.push(`<text x="${left - 10}" y="${(top + band * (i + 0.5)).toFixed(1)}" text-anchor="end" dominant-baseline="central" ${font} font-size="13" fill="#374151">${label}</text>`);
      else parts.push(`<text x="${(left + band * (i + 0.5)).toFixed(1)}" y="${top + ph + 22}" text-anchor="middle" ${font} font-size="13" fill="#374151">${label}</text>`);
    });
    parts.push(`<line x1="${left}" y1="${top + ph}" x2="${left + pw}" y2="${top + ph}" stroke="#9ca3af"/>`);
    if (horizontal) parts.push(`<line x1="${left}" y1="${top}" x2="${left}" y2="${top + ph}" stroke="#9ca3af"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${parts.join('')}</svg>`;
}
