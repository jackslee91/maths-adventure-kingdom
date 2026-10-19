// 逐步演示混合运算（课本方法）：先判断计算顺序，再一步一步写竖式
import { evaluate, fmt, OP_SYMBOL, trailingZeros, answerText } from '/shared/math.js';
import { layoutFor } from '/shared/vertical.js';
import { verticalHTML } from './vertical-view.js';
import { esc, el } from './ui.js';
import { play } from './audio.js';

export function buildScenes(expr, { answerSentence } = {}) {
  const ev = evaluate(expr);
  const scenes = [];
  const kind = expr.ops.every(o => o === '+' || o === '-') ? '加减' : '乘除';
  if (expr.ops.length > 1) {
    scenes.push({ kind: 'order', op: -1, text: `这是${kind}混合运算。按照从左到右的顺序：先算 ${fmt(expr.nums[0])} ${OP_SYMBOL[expr.ops[0]]} ${fmt(expr.nums[1])}，再用得数${OP_SYMBOL[expr.ops[1]]} ${fmt(expr.nums[2])}。` });
  }
  ev.steps.forEach((st, i) => {
    let a = st.a, b = st.b;
    if (st.op === '/' && trailingZeros(a) && trailingZeros(b) && st.remainder === 0) {
      const z = Math.min(trailingZeros(a), trailingZeros(b));
      const p = 10 ** z;
      scenes.push({ kind: 'simplify', op: i, text: `被除数和除数末尾都有 0，可以先将它们都除以 ${fmt(p)}：${fmt(a)} ÷ ${fmt(b)} = ${fmt(a / p)} ÷ ${fmt(b / p)}。商不变。`, from: `${fmt(a)} ÷ ${fmt(b)}`, to: `${fmt(a / p)} ÷ ${fmt(b / p)}` });
      a /= p; b /= p;
    }
    const L = layoutFor(a, st.op, b);
    L.steps.forEach((s, k) => scenes.push({ kind: 'vertical', op: i, layout: L, step: k, text: (expr.ops.length > 1 ? `${i === 0 ? '第一步' : '第二步'}：` : '') + s.text, final: s.final }));
  });
  scenes.push({ kind: 'answer', op: 99, text: `所以 ${exprStr(expr)} = ${answerText(ev.final, ev.remainder)}。${answerSentence ? answerSentence : ''}` });
  return { scenes, ev };
}

const exprStr = (e) => e.nums.map((n, i) => (i ? ` ${OP_SYMBOL[e.ops[i - 1]]} ` : '') + fmt(n)).join('');

/** 演示播放器 */
export function demoPlayer(expr, { answerSentence, size = 34, onChange } = {}) {
  const { scenes, ev } = buildScenes(expr, { answerSentence });
  const root = el(`<div class="demo-player">
    <div class="order-arrows num" aria-live="polite"></div>
    <div class="demo-area"><div class="vbox demo-v"></div><div class="step-text" aria-live="polite"></div></div>
  </div>`);
  let i = -1;
  let timer = null;
  const head = root.querySelector('.order-arrows');
  const vbox = root.querySelector('.demo-v');
  const text = root.querySelector('.step-text');

  function headHTML(cur) {
    const parts = [];
    expr.nums.forEach((n, k) => {
      if (k) parts.push(` ${OP_SYMBOL[expr.ops[k - 1]]} `);
      parts.push(fmt(n));
    });
    if (expr.ops.length < 2) return esc(parts.join('')) + ' = ?';
    const first = `${parts[0]}${parts[1]}${parts[2]}`;
    const cls1 = cur && cur.op === 0 ? 'first' : '', cls2 = cur && cur.op === 1 ? 'second' : '';
    const showAll = cur && (cur.kind === 'order' || cur.op === 99);
    return `<span class="${showAll ? 'first' : cls1}">${esc(first)}</span><span class="${showAll ? 'second' : cls2}">${esc(parts[3] + parts[4])}</span> = ${cur && cur.op === 99 ? `<b>${esc(answerText(ev.final, ev.remainder))}</b>` : '?'}`;
  }
  function draw() {
    const cur = scenes[i];
    head.innerHTML = headHTML(cur);
    if (!cur) { vbox.innerHTML = '<p class="ans-note">按“下一步骤”开始讲解</p>'; text.textContent = '先想一想：要先算哪一步？'; }
    else {
      text.textContent = cur.text;
      if (cur.kind === 'vertical') vbox.innerHTML = verticalHTML(cur.layout, cur.step, { size });
      else if (cur.kind === 'simplify') vbox.innerHTML = `<div class="simplify num" style="font-size:${size * 0.8}px">${esc(cur.from)}<br>= ${esc(cur.to)}</div>`;
      else if (cur.kind === 'order') vbox.innerHTML = `<div class="num" style="font-size:${size * 0.7}px;font-weight:800">① ${esc(`${fmt(expr.nums[0])} ${OP_SYMBOL[expr.ops[0]]} ${fmt(expr.nums[1])}`)}<br>② 得数 ${esc(`${OP_SYMBOL[expr.ops[1]]} ${fmt(expr.nums[2])}`)}</div>`;
      else if (cur.kind === 'answer') {
        const lastV = [...scenes].reverse().find(s => s.kind === 'vertical');
        vbox.innerHTML = lastV ? verticalHTML(lastV.layout, 999, { size }) : '';
      }
    }
    onChange?.({ index: i, total: scenes.length, scene: cur, done: i === scenes.length - 1 });
  }
  const api = {
    el: root, scenes, ev,
    next() { if (i < scenes.length - 1) { i++; play('step'); draw(); } return i < scenes.length - 1; },
    prev() { if (i > -1) { i--; draw(); } },
    reset() { api.pause(); i = -1; draw(); },
    end() { api.pause(); i = scenes.length - 1; draw(); },
    jumpToOp(op) { const k = scenes.findIndex(s => s.op === op); if (k >= 0) { i = k; draw(); } },
    get index() { return i; },
    get playing() { return !!timer; },
    play(ms = 2600) { api.pause(); timer = setInterval(() => { if (!api.next()) api.pause(); }, ms); onChange?.({ index: i, total: scenes.length, scene: scenes[i] }); },
    pause() { clearInterval(timer); timer = null; },
    destroy() { api.pause(); },
  };
  draw();
  return api;
}
