// 界面小工具：转义、建立元素、提示、弹窗
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** 由 HTML 字符串建立元素（内容必须已转义） */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function toast(msg, type = '', ms = 3200) {
  const root = document.getElementById('toast-root');
  const n = el(`<div class="toast ${type}" role="status">${esc(msg)}</div>`);
  root.appendChild(n);
  setTimeout(() => n.remove(), ms);
}

/** 弹窗；content 可以是 HTML 字符串或元素。返回关闭函数 */
export function modal(title, content, { actions = [], onClose, wide = false } = {}) {
  const root = document.getElementById('modal-root');
  const back = el(`<div class="modal-back"><div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2><div class="modal-body"></div><div class="actions"></div></div></div>`);
  const body = back.querySelector('.modal-body');
  if (typeof content === 'string') body.innerHTML = content; else if (content) body.appendChild(content);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  for (const a of actions) {
    const b = el(`<button class="btn ${a.cls || ''}">${esc(a.label)}</button>`);
    b.onclick = async () => { const r = await a.onClick?.(body); if (r !== false) close(); };
    back.querySelector('.actions').appendChild(b);
  }
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  root.appendChild(back);
  (back.querySelector('input, select, textarea, .btn') || back).focus?.();
  return close;
}

export function confirmBox(title, text, okLabel = '确定', cls = 'red') {
  return new Promise((resolve) => {
    let done = false;
    modal(title, `<p>${esc(text)}</p>`, {
      actions: [{ label: '取消', cls: 'ghost', onClick: () => { done = true; resolve(false); } }, { label: okLabel, cls, onClick: () => { done = true; resolve(true); } }],
      onClose: () => { if (!done) resolve(false); },
    });
  });
}

export const loading = (text = '载入中……') => `<div class="loading"><span class="spinner"></span><span>${esc(text)}</span></div>`;

export const fmtNum = (n) => (n === null || n === undefined || n === '' ? '' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '));

export function fmtTime(d) {
  if (!d) return '';
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${p(x.getHours())}:${p(x.getMinutes())}`;
}

/** 计时器：只计算页面可见时的时间 */
export class ActiveTimer {
  constructor() { this.total = 0; this.start = document.hidden ? null : Date.now(); this.onVis = () => this._vis(); document.addEventListener('visibilitychange', this.onVis); }
  _vis() { if (document.hidden) { if (this.start) this.total += Date.now() - this.start; this.start = null; } else this.start = Date.now(); }
  seconds() { return Math.round((this.total + (this.start ? Date.now() - this.start : 0)) / 1000); }
  stop() { document.removeEventListener('visibilitychange', this.onVis); return this.seconds(); }
}
