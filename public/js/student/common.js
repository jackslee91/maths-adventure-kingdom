// 学生页面共用：顶栏、设置、庆祝动画
import { esc, el, modal } from '../ui.js';
import { session } from '../api.js';
import { audioControlHTML, bindAudioControls } from '../audio.js';
import { avatar, icon } from '../assets/index.js';

export function requireLogin() {
  if (!session.token()) { location.hash = '#/student/login'; return null; }
  return session.profile();
}

export function prefs() {
  const coarse = matchMedia('(pointer: coarse)').matches; // 平板与触控白板默认显示数字键盘
  try { const k = localStorage.getItem('ma_keypad'); return { keypad: k === null ? coarse : k === '1', reduce: localStorage.getItem('ma_reduce_motion') === '1' }; } catch { return { keypad: coarse, reduce: false }; }
}

export function topbar({ back, backLabel = '返回', title, xp } = {}) {
  const p = session.profile() || {};
  return `<header class="topbar">
    ${back ? `<a class="btn wood small" href="${back}">${esc(backLabel)}</a>` : ''}
    <span class="chip player"><span class="avatar">${avatar(34)}</span>${esc(p.name || '')}<small>${esc(p.className || '')}</small></span>
    ${xp !== undefined ? `<span class="chip" title="经验值"><span class="star">★</span><span class="num">${xp}</span> 经验</span>` : ''}
    ${title ? `<span class="wood-title">${esc(title)}</span>` : ''}
    <span class="spacer"></span>
    <button class="btn ghost small" data-act="settings" aria-label="设置">${icon('settings')}设置</button>
  </header>`;
}

export function bindTopbar(root) {
  root.querySelector('[data-act=settings]')?.addEventListener('click', openSettings);
}

export function openSettings() {
  const p = prefs();
  const body = el(`<div>${audioControlHTML()}
    <hr><label class="row"><input type="checkbox" id="opt-keypad" ${p.keypad ? 'checked' : ''}> 显示屏幕数字键盘</label>
    <label class="row"><input type="checkbox" id="opt-motion" ${p.reduce ? 'checked' : ''}> 减少动画效果</label>
    <hr><button class="btn red small" id="opt-logout">登出（换另一位同学）</button></div>`);
  bindAudioControls(body);
  body.querySelector('#opt-keypad').onchange = (e) => { try { localStorage.setItem('ma_keypad', e.target.checked ? '1' : '0'); } catch { /* 忽略 */ } };
  body.querySelector('#opt-motion').onchange = (e) => {
    try { localStorage.setItem('ma_reduce_motion', e.target.checked ? '1' : '0'); } catch { /* 忽略 */ }
    document.body.classList.toggle('reduce-motion', e.target.checked);
  };
  const close = modal('设置', body, { actions: [{ label: '完成', cls: 'green' }] });
  body.querySelector('#opt-logout').onclick = async () => {
    try { await fetch('/api/student/logout', { method: 'POST', headers: { Authorization: `Bearer ${session.token()}` } }); } catch { /* 忽略 */ }
    session.clear(); close(); location.hash = '#/student/login';
  };
}

export function celebrate(n = 40) {
  if (document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const b = el('<div class="burst" aria-hidden="true"></div>');
  const colors = ['#ffc93c', '#ff8a1e', '#5cc24a', '#2ba3d8', '#e0457b', '#7b4dd6'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.style.left = '50%'; c.style.top = '45%';
    c.style.background = colors[i % colors.length];
    c.style.setProperty('--dx', `${(Math.random() - 0.5) * 900}px`);
    c.style.setProperty('--dy', `${(Math.random() - 0.3) * 700}px`);
    b.appendChild(c);
  }
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 1600);
}

export const DIFF = { 1: '容易', 2: '中等', 3: '挑战' };
