// 题目构建工具：根据算式自动生成课本格式的解题步骤、提示和常见错误
// 题库生成器与“老师输入算式自动建题”功能共用。
import { evaluate, exprText, stepText, fmt, answerText, trailingZeros, OP_SYMBOL } from '../shared/math.js';
import { stepErrorVariants, diagnoseFinal } from '../shared/marking.js';

/** 根据算式生成标准解题步骤（课本方法） */
export function workedSolution(expr, answerSentence) {
  const ev = evaluate(expr);
  const kind = expr.ops.every(o => o === '+' || o === '-') ? '加减' : '乘除';
  const lines = expr.ops.length > 1 ? [`${kind}混合运算，按从左到右的顺序计算。`] : ['用竖式计算。'];
  ev.steps.forEach((st, i) => {
    let line = expr.ops.length > 1 ? `${i === 0 ? '第一步' : '第二步'}：` : '';
    if (st.op === '/' && trailingZeros(st.a) >= 1 && trailingZeros(st.b) >= 1 && st.remainder === 0) {
      const z = Math.min(trailingZeros(st.a), trailingZeros(st.b));
      const p = 10 ** z;
      line += `${fmt(st.a)} ÷ ${fmt(st.b)} = ${fmt(st.a / p)} ÷ ${fmt(st.b / p)} = ${fmt(st.result)}（被除数和除数末尾都有 0，先都除以 ${fmt(p)}）`;
    } else if (st.op === '*' && trailingZeros(st.b) >= 1 && st.b >= 10) {
      const z = trailingZeros(st.b);
      line += `${stepText(st)}（先算 ${fmt(st.a)} × ${fmt(st.b / 10 ** z)}，再添上 ${z} 个 0）`;
    } else {
      line += stepText(st);
    }
    lines.push(line);
  });
  if (answerSentence) lines.push(answerSentence);
  return lines;
}

export function firstStepHint(expr) {
  const st = evaluate(expr).steps[0];
  return `从左到右：先算 ${fmt(st.a)} ${OP_SYMBOL[st.op]} ${fmt(st.b)}，再用结果${expr.ops[1] === '+' ? '加' : expr.ops[1] === '-' ? '减' : expr.ops[1] === '*' ? '乘' : '除以'} ${fmt(expr.nums[2])}。`;
}

export function hint2For(expr) {
  const ops = expr.ops;
  if (ops.includes('/')) return '用长除法时，不够除的那一位要商 0；最后检查余数是否比除数小。';
  if (ops.includes('*')) return '两位数乘法：先用个位乘，再用十位乘（个位写 0），最后相加。';
  if (ops.includes('-')) return '用竖式计算：不够减就向前一位借 1，记得把前一位划去并写上新数字。';
  return '用竖式计算：满十进一，进位的数字写在上方。';
}

export function likelyMistakes(expr) {
  const ev = evaluate(expr);
  const set = new Set();
  if (expr.ops.length > 1 && expr.ops[0] !== expr.ops[1]) {
    const d = diagnoseFinal(expr, (() => { const [a, b, c] = expr.nums; const o = expr.ops; const inner = o[1] === '+' ? b + c : o[1] === '-' ? b - c : o[1] === '*' ? b * c : Math.floor(b / c); return o[0] === '+' ? a + inner : o[0] === '-' ? a - inner : o[0] === '*' ? a * inner : Math.floor(a / inner); })());
    if (d === 'ORDER_RTL') set.add('没有从左到右计算');
  }
  ev.steps.forEach(st => stepErrorVariants(st.a, st.op, st.b).forEach(v => {
    const map = { CARRY_FORGOT: '加法忘记进位', BORROW_SWAP: '退位时用大数减小数', BORROW_NODEC: '退位后忘记减 1', MUL_NOSHIFT: '第二个部分积没有错位', QUOTIENT_ZERO: '商中间漏写 0', ZERO_LOST: '末尾漏写 0', ZERO_EXTRA: '多写 0' };
    if (map[v.code]) set.add(map[v.code]);
  }));
  if (ev.remainder) set.add('漏写余数或余数比除数大');
  if (expr.ops.length > 1) set.add('只算第一步');
  return [...set].join('；');
}


/** 从算式建立一道完整的题目（老师新增题目用） */
export function buildFromExpression({ expr, text, unit_label, qtype, difficulty = 2, stages = [3, 5, 6], answerSentence }) {
  const ev = evaluate(expr);
  if (!ev.valid) throw new Error('算式无效：中间步骤不能出现负数或除不尽');
  const hasR = ev.remainder !== 0;
  let t = qtype || (hasR ? 'remainder' : 'number');
  if (t === 'number' && hasR) t = 'remainder';
  if (t === 'remainder' && !hasR) t = 'number';
  if (t === 'steps' && expr.ops.length < 2) t = hasR ? 'remainder' : 'number';
  return {
    difficulty, stages, qtype: t, context: text ? 'word' : 'calc',
    text: text || `${exprText(expr)} = ?`, expr,
    answer: t === 'remainder' ? { q: ev.final, r: ev.remainder } : t === 'steps' ? { steps: [ev.steps[0].result], final: ev.final, remainder: ev.remainder || 0 } : { value: ev.final },
    worked_solution: workedSolution(expr, answerSentence),
    explanation: hasR ? `最后一步除不尽，答案要写商和余数：${answerText(ev.final, ev.remainder)}。` : `按从左到右计算，答案是 ${fmt(ev.final)}。`,
    hint: expr.ops.length > 1 ? firstStepHint(expr) : `用竖式计算 ${exprText(expr)}。`, hint2: hint2For(expr),
    misconception: likelyMistakes(expr),
    unit_label: unit_label || null, marks: t === 'steps' || t === 'remainder' ? 2 : 1,
  };
}

/** 解析老师输入的算式，例如 “3 801 + 8 632 − 1 472” 或 “3245×19÷30” */
export function parseExpression(str) {
  const s = String(str || '').replace(/[，,\s]/g, '').replace(/[−–—]/g, '-').replace(/[×xX*]/g, '*').replace(/[÷/]/g, '/').replace(/＋/g, '+').replace(/[=＝?？]+$/, '');
  const m = s.match(/^(\d+)([-+*/])(\d+)(?:([-+*/])(\d+))?$/);
  if (!m) return null;
  const nums = [Number(m[1]), Number(m[3])];
  const ops = [m[2]];
  if (m[4]) { ops.push(m[4]); nums.push(Number(m[5])); }
  return { nums, ops };
}
