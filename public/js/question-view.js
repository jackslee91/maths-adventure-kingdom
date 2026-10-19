// 题目显示与作答输入（各种题型）
import { esc, el } from './ui.js';
import { verticalHTML, layoutFor } from './vertical-view.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export function questionTextHTML(q) {
  // 题干：第一行是题目，其余行是补充说明
  let lines = String(q.text || '').split('\n');
  if (q.given) lines = lines.slice(0, 1); // 已给出的步骤另外显示
  return `<div class="q-text"><p class="q-main">${esc(lines[0])}</p>${lines.slice(1).map(l => `<p class="q-sub">${esc(l)}</p>`).join('')}</div>`;
}

/**
 * 建立作答区。返回 { el, getResponse, isEmpty, lock, focus }
 */
export function answerView(q, { keypad = true, saved = null } = {}) {
  const root = el('<div class="answer-area"></div>');
  const unit = q.unit_label ? `<span class="unit">${esc(q.unit_label === '令吉' ? '令吉（RM）' : q.unit_label)}</span>` : '';
  const numInput = (name, label, value = '', wide = false) => `<label class="ans-field ${wide ? 'wide' : ''}"><span>${esc(label)}</span><input class="input ans-input num" name="${name}" inputmode="numeric" autocomplete="off" value="${esc(value)}" aria-label="${esc(label)}"></label>`;
  let getResponse, isEmpty;

  if (q.vertical) {
    const L = layoutFor(q.vertical.a, q.vertical.op, q.vertical.b);
    root.innerHTML = `<div class="vbox">${verticalHTML(L, 999, { hole: [q.vertical.row, q.vertical.col] })}</div><div class="ans-row">${numInput('value', '□ 里填', saved?.value)}</div>`;
    getResponse = () => ({ value: root.querySelector('[name=value]').value.trim() });
    isEmpty = () => !getResponse().value;
  } else if (q.qtype === 'number') {
    const given = q.given ? `<div class="given"><div>✔ 第一步：${esc(q.given.step1)}</div><div>➜ 第二步：${esc(q.given.step2)} = ?</div></div>` : '';
    root.innerHTML = `${given}<div class="ans-row">${numInput('value', q.given ? '第二步答案' : '答案', saved?.value, true)}${unit}</div>`;
    getResponse = () => ({ value: root.querySelector('[name=value]').value.trim() });
    isEmpty = () => !getResponse().value;
  } else if (q.qtype === 'remainder') {
    const [l1, l2] = q.labels || ['商', '余数'];
    const given = q.given ? `<div class="given"><div>✔ 第一步：${esc(q.given.step1)}</div><div>➜ 第二步：${esc(q.given.step2)} = ?</div></div>` : '';
    root.innerHTML = `${given}<div class="ans-row">${numInput('q', l1, saved?.q)}<span class="yu">余</span>${numInput('r', l2, saved?.r)}</div>
      <p class="ans-note">没有余数就在余数格填 0。</p>`;
    getResponse = () => ({ q: root.querySelector('[name=q]').value.trim(), r: root.querySelector('[name=r]').value.trim() });
    isEmpty = () => !getResponse().q;
  } else if (q.qtype === 'steps') {
    root.innerHTML = `<div class="steps-ans">
      <div class="ans-row"><span class="step-tag">第一步</span><span class="step-prompt num">${esc(q.stepPrompt || '')}</span>${numInput('s1', '第一步结果', saved?.steps?.[0])}</div>
      <div class="ans-row"><span class="step-tag">第二步</span>${q.hasRemainder
        ? `${numInput('q', '最后答案（商）', saved?.q)}<span class="yu">余</span>${numInput('r', '余数', saved?.r)}`
        : `${numInput('final', '最后答案', saved?.final)}${unit}`}</div></div>`;
    getResponse = () => {
      const s1 = root.querySelector('[name=s1]').value.trim();
      return q.hasRemainder ? { steps: [s1], q: root.querySelector('[name=q]').value.trim(), r: root.querySelector('[name=r]').value.trim() }
        : { steps: [s1], final: root.querySelector('[name=final]').value.trim() };
    };
    isEmpty = () => { const r = getResponse(); return !r.steps[0] && !(r.final || r.q); };
  } else if (q.qtype === 'mcq') {
    root.innerHTML = `<div class="choices" role="radiogroup">${q.choices.map((c, i) => `<button type="button" class="choice" role="radio" aria-checked="false" data-v="${esc(c.value)}"><b>${LETTERS[i]}</b><span>${esc(c.text)}</span></button>`).join('')}</div>`;
    let chosen = saved?.choice ?? null;
    const sync = () => root.querySelectorAll('.choice').forEach(b => { const on = b.dataset.v === chosen; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    root.querySelectorAll('.choice').forEach(b => b.addEventListener('click', () => { if (root.classList.contains('locked')) return; chosen = b.dataset.v; sync(); root.dispatchEvent(new CustomEvent('choose')); }));
    sync();
    getResponse = () => ({ choice: chosen });
    isEmpty = () => chosen === null;
  } else if (q.qtype === 'order') {
    let order = saved?.order ? [...saved.order] : [];
    root.innerHTML = `<p class="ans-note">按顺序点选下面的步骤：</p><div class="order-pool"></div><ol class="order-list"></ol><button type="button" class="btn ghost small order-reset">重新排列</button>`;
    const draw = () => {
      root.querySelector('.order-pool').innerHTML = q.items.filter(i => !order.includes(i.id)).map(i => `<button type="button" class="order-item" data-id="${esc(i.id)}">${esc(i.text)}</button>`).join('') || '<span class="ans-note">全部排好了！</span>';
      root.querySelector('.order-list').innerHTML = order.map(id => `<li>${esc(q.items.find(i => i.id === id)?.text)}</li>`).join('');
      root.querySelectorAll('.order-item').forEach(b => b.onclick = () => { if (root.classList.contains('locked')) return; order.push(b.dataset.id); draw(); });
    };
    root.querySelector('.order-reset').onclick = () => { if (!root.classList.contains('locked')) { order = []; draw(); } };
    draw();
    getResponse = () => ({ order: [...order] });
    isEmpty = () => order.length < q.items.length;
  }

  // 屏幕数字键盘（平板与互动白板）
  const inputs = [...root.querySelectorAll('.ans-input')];
  let active = inputs[0] || null;
  inputs.forEach(i => {
    i.addEventListener('focus', () => { active = i; });
    i.addEventListener('input', () => { i.value = i.value.replace(/[^\d\s,０-９余]/g, ''); });
  });
  if (keypad && inputs.length) {
    const pad = el(`<div class="keypad" aria-label="数字键盘">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '下一格'].map(k => `<button type="button" class="key" data-k="${k}">${k}</button>`).join('')}</div>`);
    pad.addEventListener('click', (e) => {
      const k = e.target.closest('.key')?.dataset.k;
      if (!k || !active || root.classList.contains('locked')) return;
      if (k === '⌫') active.value = active.value.slice(0, -1);
      else if (k === '下一格') { const i = inputs.indexOf(active); active = inputs[(i + 1) % inputs.length]; }
      else active.value += k;
      active.focus({ preventScroll: true });
    });
    root.appendChild(pad);
  }
  return {
    el: root,
    getResponse, isEmpty,
    lock(on = true) { root.classList.toggle('locked', on); root.querySelectorAll('input, button').forEach(x => { x.disabled = on; }); },
    focus() { (inputs[0] || root.querySelector('button'))?.focus({ preventScroll: true }); },
    onEnter(fn) { inputs.forEach(i => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fn(); } })); },
  };
}

/** 解题步骤（答对后或第二次答错后显示） */
export function solutionHTML(sol) {
  if (!sol) return '';
  return `<div class="solution"><h4>解题步骤</h4><ol>${(sol.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    ${sol.answer ? `<p class="sol-ans">正确答案：<b class="num">${esc(sol.answer)}</b></p>` : ''}</div>`;
}
