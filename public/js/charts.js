// 简单的 SVG 图表（打印友好）
import { esc } from './ui.js';

export function barChart({ labels, values, max, height = 200, colors, suffix = '', title }) {
  const W = 640, H = height, left = 36, bottom = 34, top = 18;
  const n = values.length;
  const mx = Math.max(max || 0, ...values, 1);
  const bw = Math.min(56, (W - left) / n * 0.62);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title || '柱状图')}">`;
  for (let k = 0; k <= 4; k++) {
    const y = top + (H - top - bottom) * (1 - k / 4);
    s += `<line x1="${left}" x2="${W}" y1="${y}" y2="${y}" stroke="#e5e7eb"/><text x="${left - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7280">${Math.round(mx * k / 4)}${suffix}</text>`;
  }
  values.forEach((v, i) => {
    const cx = left + (W - left) / n * (i + 0.5);
    const h = (H - top - bottom) * v / mx;
    const y = H - bottom - h;
    s += `<rect x="${cx - bw / 2}" y="${y}" width="${bw}" height="${Math.max(h, 0)}" rx="4" fill="${colors ? colors[i] : '#3b82f6'}"/>`;
    s += `<text x="${cx}" y="${y - 5}" text-anchor="middle" font-size="12" font-weight="700" fill="#1f2937">${v}${suffix}</text>`;
    s += `<text x="${cx}" y="${H - bottom + 16}" text-anchor="middle" font-size="11" fill="#4b5563">${esc(labels[i])}</text>`;
  });
  return s + '</svg>';
}

export function hBars(rows, { good = 70, weak = 50 } = {}) {
  return `<div class="hbars">${rows.map(r => `<div class="hbar"><span class="hl">${esc(r.label)}</span><span class="track"><span class="fill ${r.value >= good ? 'g' : r.value < weak ? 'b' : 'm'}" style="width:${Math.max(0, Math.min(100, r.value))}%"></span><span class="mark" style="left:${good}%"></span></span><span class="hv num">${r.value}%</span></div>`).join('')}</div>`;
}

export function donut(parts, { size = 150, label = '' } = {}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  let a = -Math.PI / 2;
  const R = 60, r = 36, c = 75;
  let s = `<svg class="donut" width="${size}" height="${size}" viewBox="0 0 150 150" role="img" aria-label="${esc(label)}">`;
  for (const p of parts) {
    if (!p.value) continue;
    const a2 = a + p.value / total * Math.PI * 2;
    const large = a2 - a > Math.PI ? 1 : 0;
    const pt = (ang, rad) => `${c + rad * Math.cos(ang)} ${c + rad * Math.sin(ang)}`;
    if (p.value === total) s += `<circle cx="${c}" cy="${c}" r="${(R + r) / 2}" fill="none" stroke="${p.color}" stroke-width="${R - r}"/>`;
    else s += `<path d="M${pt(a, R)} A${R} ${R} 0 ${large} 1 ${pt(a2, R)} L${pt(a2, r)} A${r} ${r} 0 ${large} 0 ${pt(a, r)}Z" fill="${p.color}"/>`;
    a = a2;
  }
  return s + `<text x="75" y="80" text-anchor="middle" font-size="16" font-weight="800" fill="#1f2937">${esc(label)}</text></svg>`;
}
