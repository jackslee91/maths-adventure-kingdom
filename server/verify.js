// 题目验证：用独立的 BigInt 计算重新核对答案，并检查批改引擎与竖式引擎。
// 服务器在老师新增或修改题目时也会调用。
import { markAnswer, maxMarksFor } from '../shared/marking.js';
import { layoutFor, cellText } from '../shared/vertical.js';
import { fmt } from '../shared/math.js';

const MAX = 100000n;

function bigEval(nums, ops) {
  let acc = BigInt(nums[0]);
  const inter = [];
  let rem = 0n;
  for (let i = 0; i < ops.length; i++) {
    const b = BigInt(nums[i + 1]);
    const op = ops[i];
    if (op === '+') acc = acc + b;
    else if (op === '-') acc = acc - b;
    else if (op === '*') acc = acc * b;
    else if (op === '/') { if (b === 0n) throw new Error('除数为 0'); rem = acc % b; if (rem !== 0n && i < ops.length - 1) throw new Error('中间步骤除不尽'); acc = acc / b; }
    else throw new Error('未知运算 ' + op);
    if (acc < 0n) throw new Error('出现负数');
    inter.push(acc);
  }
  return { final: acc, inter, rem };
}

function layoutDigits(L) {
  if (L.kind === 'div') {
    const q = L.rows[0].cells.map(c => cellText(c, 999) ?? '').join('').replace(/^0+(?=\d)/, '');
    return { value: Number(q) };
  }
  // 最后一行就是结果
  const last = L.rows[L.rows.length - 1];
  return { value: Number(last.cells.map(c => cellText(c, 999) ?? '').join('').replace(/[^\d]/g, '')) };
}

export function verifyQuestion(q) {
  const errors = [];
  const req = ['id', 'subtopic_id', 'difficulty', 'qtype', 'text', 'answer', 'worked_solution', 'explanation', 'hint', 'misconception'];
  for (const k of req) if (q[k] === undefined || q[k] === null || q[k] === '' || (Array.isArray(q[k]) && !q[k].length)) errors.push(`缺少字段 ${k}`);
  if (![1, 2, 3].includes(Number(q.difficulty))) errors.push('难度必须是 1、2 或 3');
  if (!(maxMarksFor(q) > 0)) errors.push('分数必须大于 0');

  if (q.expr) {
    try {
      const { final, inter, rem } = bigEval(q.expr.nums, q.expr.ops);
      for (const v of inter) if (v > MAX) errors.push(`计算过程超过 100 000（${v}）`);
      const a = q.answer;
      if (q.qtype === 'number' && BigInt(a.value) !== final) errors.push(`答案应为 ${final}，题库为 ${a.value}`);
      if (q.qtype === 'number' && rem !== 0n) errors.push('有余数的题不能用 number 题型');
      if (q.qtype === 'remainder' && (BigInt(a.q) !== final || BigInt(a.r) !== rem)) errors.push(`答案应为 ${final} 余 ${rem}`);
      if (q.qtype === 'steps') {
        if (BigInt(a.steps[0]) !== inter[0]) errors.push(`第一步应为 ${inter[0]}`);
        if (BigInt(a.final) !== final || BigInt(a.remainder || 0) !== rem) errors.push(`最后答案应为 ${final} 余 ${rem}`);
      }
      // 竖式引擎核对
      let acc = q.expr.nums[0];
      q.expr.ops.forEach((op, i) => {
        const b = q.expr.nums[i + 1];
        const L = layoutFor(acc, op, b);
        const shown = layoutDigits(L).value;
        const expect = Number(inter[i]);
        if (shown !== expect) errors.push(`竖式显示 ${shown}，应为 ${expect}（${acc}${op}${b}）`);
        acc = expect;
      });
      // 解题步骤包含最后答案
      const ws = (q.worked_solution || []).join('\n');
      if (q.qtype !== 'mcq' && q.qtype !== 'order' && !ws.includes(fmt(Number(final)))) errors.push('解题步骤里找不到最后答案');
    } catch (e) {
      errors.push('算式无效：' + e.message);
    }
  }

  if (q.step) {
    const { a, op, b } = q.step;
    const { final, rem } = bigEval([a, b], [op]);
    if (q.qtype === 'number' && BigInt(q.answer.value) !== final) errors.push(`第二步答案应为 ${final}`);
    if (q.qtype === 'remainder' && (BigInt(q.answer.q) !== final || BigInt(q.answer.r) !== rem)) errors.push(`第二步答案应为 ${final} 余 ${rem}`);
  }

  if (q.vertical) {
    const { a, op, b, row, col } = q.vertical;
    const L = layoutFor(a, op, b);
    const cell = L.rows[row]?.cells[col];
    if (!cell) errors.push('竖式空格位置无效');
    else if (Number(cell.t) !== Number(q.answer.value)) errors.push('竖式空格答案不一致');
    const { final } = bigEval([a, b], [op]);
    if (layoutDigits(L).value !== Number(final)) errors.push('竖式结果与计算不一致');
  }

  if (q.qtype === 'mcq') {
    const ch = q.choices || [];
    if (ch.length < 2) errors.push('选择题至少要有 2 个选项');
    const vals = ch.map(c => String(c.value));
    if (new Set(vals).size !== vals.length) errors.push('选项代码重复');
    const texts = ch.map(c => c.text);
    if (new Set(texts).size !== texts.length) errors.push('选项文字重复');
    if (ch.filter(c => String(c.value) === String(q.answer.value)).length !== 1) errors.push('正确选项必须恰好一个');
    if (q.expr && q.context !== 'concept') {
      const { final, rem } = bigEval(q.expr.nums, q.expr.ops);
      const right = ch.find(c => String(c.value) === String(q.answer.value));
      const want = rem ? `${fmt(Number(final))} 余 ${rem}` : fmt(Number(final));
      if (right && right.text !== want) errors.push(`正确选项文字应为 ${want}`);
    }
  }
  if (q.qtype === 'order') {
    const ids = (q.items || []).map(i => i.id);
    const ord = q.answer?.order || [];
    if (ord.length !== ids.length || !ord.every(id => ids.includes(id))) errors.push('排序答案与选项不一致');
  }

  // 批改引擎：正确答案必须得满分
  if (!errors.length) {
    const resp = correctResponse(q);
    const m = markAnswer(q, resp);
    if (!m.correct || m.marks !== maxMarksFor(q)) errors.push('批改引擎没有给正确答案满分');
    // 等值写法
    if (q.qtype === 'number') {
      const v = q.answer.value;
      for (const variant of [fmt(v), String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ','), `${v} ${q.unit_label || ''}`]) {
        if (!markAnswer(q, { value: variant }).correct) errors.push(`等值写法“${variant}”没有被接受`);
      }
      if (markAnswer(q, { value: String(v + 1) }).correct) errors.push('错误答案被判为正确');
    }
  }
  return errors;
}

export function correctResponse(q) {
  const a = q.answer;
  switch (q.qtype) {
    case 'number': return { value: String(a.value) };
    case 'remainder': return { q: String(a.q), r: String(a.r) };
    case 'steps': return a.remainder ? { steps: [String(a.steps[0])], q: String(a.final), r: String(a.remainder) } : { steps: [String(a.steps[0])], final: String(a.final) };
    case 'mcq': return { choice: a.value };
    case 'order': return { order: a.order };
    default: return {};
  }
}
