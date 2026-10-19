// 把竖式布局画成网格，可逐步显示（课本格式）
import { layoutFor, cellText } from '/shared/vertical.js';
import { esc } from './ui.js';

/**
 * @param layout layoutFor() 的结果
 * @param step 当前步骤（显示 s <= step 的格子）
 * @param opts.hole [row, col] 要挖空的格子
 */
export function verticalHTML(layout, step = 999, { hole = null, size } = {}) {
  const cols = layout.cols + 1; // 多一栏给（余）
  let html = `<div class="vgrid" style="grid-template-columns: repeat(${cols}, auto);${size ? `font-size:${size}px` : ''}" role="img" aria-label="竖式">`;
  layout.rows.forEach((row, ri) => {
    for (let ci = 0; ci < layout.cols; ci++) {
      const cell = row.cells[ci];
      const txt = cellText(cell, step);
      const cls = ['vcell'];
      if (cell) cls.push(...(cell.c || '').split(' ').filter(Boolean));
      if (row.line && ci >= row.line.from && ci <= row.line.to && row.line.s <= step) cls.push('line');
      if (cell && cell.x !== undefined && cell.x <= step) cls.push('crossed');
      const appearAt = cell ? (cell.tv ? cell.tv.map(v => v.s) : [cell.s]) : [];
      if (txt !== null && appearAt.includes(step) && step > 0) cls.push('now');
      const isHole = hole && hole[0] === ri && hole[1] === ci;
      if (isHole) cls.push('hole');
      html += `<span class="${cls.join(' ')}">${txt === null || isHole ? '' : esc(txt)}</span>`;
    }
    const suf = row.suffix && row.suffix.s <= step ? `<span class="vsuffix">${esc(row.suffix.t)}</span>` : '<span></span>';
    html += suf;
  });
  return html + '</div>';
}

export { layoutFor };
