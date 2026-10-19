// 确定性批改引擎（服务器为准，浏览器也可预览）
import { applyOp, evaluate, parseIntAnswer, parseRemainderAnswer, normalizeInput, fmt, OP_SYMBOL } from './math.js';
import { MISCONCEPTIONS } from './misconceptions.js';

const digits = (n) => String(n).split('').map(Number);

function fromDigits(arr) {
  const s = arr.join('').replace(/^0+(?=\d)/, '');
  return Number(s);
}

export function addNoCarry(a, b) {
  const A = digits(a).reverse(), B = digits(b).reverse();
  const n = Math.max(A.length, B.length);
  const out = [];
  for (let i = 0; i < n; i++) out.push(((A[i] ?? 0) + (B[i] ?? 0)) % 10);
  return fromDigits(out.reverse());
}

export function subSwap(a, b) {
  const A = digits(a).reverse(), B = digits(b).reverse();
  const out = A.map((x, i) => Math.abs(x - (B[i] ?? 0)));
  return fromDigits(out.reverse());
}

export function subNoDec(a, b) {
  const A = digits(a).reverse(), B = digits(b).reverse();
  const out = A.map((x, i) => { const y = B[i] ?? 0; return x < y ? x + 10 - y : x - y; });
  return fromDigits(out.reverse());
}

export function mulNoShift(a, b) {
  if (b < 10 || b > 99 || b % 10 === 0) return null;
  return a * (b % 10) + a * Math.floor(b / 10);
}

export function quotientZeroDrops(q) {
  const s = String(q);
  const out = new Set();
  for (let i = 1; i < s.length; i++) {
    if (s[i] === '0') out.add(Number(s.slice(0, i) + s.slice(i + 1)));
  }
  if (/0/.test(s.slice(1))) out.add(Number(s[0] + s.slice(1).replace(/0/g, '')));
  out.delete(q);
  return [...out].filter(v => Number.isFinite(v) && v > 0);
}

/** 某一步的常见错误结果 */
export function stepErrorVariants(a, op, b) {
  const v = [];
  const right = applyOp(a, op, b);
  if (op === '+') v.push({ value: addNoCarry(a, b), code: 'CARRY_FORGOT' });
  if (op === '-') {
    v.push({ value: subSwap(a, b), code: 'BORROW_SWAP' });
    v.push({ value: subNoDec(a, b), code: 'BORROW_NODEC' });
  }
  if (op === '*') {
    const ns = mulNoShift(a, b);
    if (ns !== null) v.push({ value: ns, code: 'MUL_NOSHIFT' });
    v.push({ value: right / 10, code: 'ZERO_LOST' });
    v.push({ value: right * 10, code: 'ZERO_EXTRA' });
  }
  if (op === '/') {
    for (const x of quotientZeroDrops(right)) v.push({ value: x, code: 'QUOTIENT_ZERO' });
    v.push({ value: right * 10, code: 'ZERO_EXTRA' });
  }
  return v.filter(x => Number.isInteger(x.value) && x.value !== right && x.value >= 0);
}

function continueFrom(expr, stepIndex, value) {
  let acc = value;
  for (let i = stepIndex + 1; i < expr.ops.length; i++) acc = applyOp(acc, expr.ops[i], expr.nums[i + 1]);
  return acc;
}

const SWAP = { '+': '-', '-': '+', '*': '/', '/': '*' };

/** 根据学生的最后答案推断错误类型（找不到就返回 CALC_SLIP） */
export function diagnoseFinal(expr, studentValue) {
  if (!expr || studentValue === null || studentValue === undefined) return null;
  const ev = evaluate(expr);
  const correct = ev.final;
  if (studentValue === correct) return null;
  const checks = [];
  if (expr.ops.length >= 2) {
    checks.push({ value: ev.steps[0].result, code: 'STOP_HALFWAY' });
    // 从右到左
    const [a, b, c] = expr.nums, [o1, o2] = expr.ops;
    const inner = applyOp(b, o2, c);
    if (Number.isFinite(inner) && !(o2 === '/' && b % c !== 0)) {
      const rtl = applyOp(a, o1, inner);
      if (Number.isFinite(rtl) && rtl !== correct) checks.push({ value: rtl, code: 'ORDER_RTL' });
    }
  }
  // 看错符号
  expr.ops.forEach((op, i) => {
    const ops2 = expr.ops.slice(); ops2[i] = SWAP[op];
    const alt = evaluate({ nums: expr.nums, ops: ops2 });
    if (alt.final >= 0 && Number.isInteger(alt.final) && alt.final !== correct) checks.push({ value: alt.final, code: 'WRONG_OP' });
  });
  if (studentValue * 10 === correct || studentValue * 100 === correct) checks.push({ value: studentValue, code: 'ZERO_LOST' });
  if (studentValue === correct * 10 || studentValue === correct * 100) checks.push({ value: studentValue, code: 'ZERO_EXTRA' });
  // 每一步的常见错误，延续到最后
  ev.steps.forEach((st, i) => {
    for (const ve of stepErrorVariants(st.a, st.op, st.b)) {
      checks.push({ value: continueFrom(expr, i, ve.value), code: ve.code });
    }
  });
  const hit = checks.find(c => c.value === studentValue);
  return hit ? hit.code : 'CALC_SLIP';
}

/** 单步算式的错误诊断（a op b） */
export function diagnoseStep(a, op, b, studentValue) {
  const right = applyOp(a, op, b);
  if (studentValue === right) return null;
  const hit = stepErrorVariants(a, op, b).find(v => v.value === studentValue);
  if (hit) return hit.code;
  if (studentValue * 10 === right) return 'ZERO_LOST';
  if (studentValue === right * 10) return 'ZERO_EXTRA';
  return 'CALC_SLIP';
}

function matchesAlternative(question, raw) {
  const alts = question.alternatives || [];
  const n = normalizeInput(raw);
  return alts.some(a => normalizeInput(a) === n);
}

/** 题目满分（固定、透明） */
export function maxMarksFor(question) {
  if (question.marks) return Number(question.marks);
  switch (question.qtype) {
    case 'steps': return 2;
    case 'remainder': return 2;
    default: return 1;
  }
}

export const RUBRIC_TEXT = {
  number: '答案正确得满分。',
  remainder: '商正确得 1 分；商和余数都正确再得 1 分。',
  steps: '第一步正确得 1 分；最后答案正确得 1 分；第一步错了但第二步按错的结果算对，得 1 分方法分。',
  mcq: '选对得 1 分。',
  order: '顺序完全正确得 1 分。',
};

/**
 * 批改一道题
 * @returns {correct, marks, maxMarks, misconception, feedback, detail}
 */
export function markAnswer(question, response) {
  const maxMarks = maxMarksFor(question);
  const ans = question.answer || {};
  const out = { correct: false, marks: 0, maxMarks, misconception: null, feedback: '', detail: {} };
  const resp = response || {};

  if (question.qtype === 'number') {
    const v = parseIntAnswer(resp.value);
    out.detail.parsed = v;
    if (v === null) {
      if (matchesAlternative(question, resp.value)) { out.correct = true; out.marks = maxMarks; out.feedback = '答对了！'; return out; }
      out.feedback = resp.value ? '请只输入数字（可以带单位），例如 10961 或 10 961。' : '你还没有作答。';
      out.misconception = null;
      out.invalid = true;
      return out;
    }
    if (v === ans.value || matchesAlternative(question, resp.value)) {
      out.correct = true; out.marks = maxMarks; out.feedback = '答对了！'; return out;
    }
    out.misconception = question.expr ? diagnoseFinal(question.expr, v)
      : (question.step ? diagnoseStep(question.step.a, question.step.op, question.step.b, v) : 'CALC_SLIP');
    out.feedback = MISCONCEPTIONS[out.misconception]?.pupil || '答案不对，再想一想。';
    return out;
  }

  if (question.qtype === 'remainder') {
    let q, r;
    if (resp.q !== undefined || resp.r !== undefined) {
      q = parseIntAnswer(resp.q);
      r = (resp.r === '' || resp.r === undefined || resp.r === null) ? null : parseIntAnswer(resp.r);
    } else {
      const p = parseRemainderAnswer(resp.value);
      q = p ? p.q : null; r = p && !p.noRemainderWritten ? p.r : null;
    }
    out.detail = { q, r };
    if (q === null) { out.feedback = resp.q || resp.value ? '商要填数字。' : '你还没有作答。'; out.invalid = !!(resp.q || resp.value); return out; }
    const divisor = question.expr ? question.expr.nums[question.expr.nums.length - 1] : ans.divisor;
    if (q === ans.q) {
      out.marks = Math.min(1, maxMarks);
      if ((r ?? 0) === ans.r) {
        out.correct = true; out.marks = maxMarks; out.feedback = '商和余数都正确！'; return out;
      }
      if (r === null || r === 0) out.misconception = 'REMAINDER_MISSING';
      else if (divisor && r >= divisor) out.misconception = 'REMAINDER_TOO_BIG';
      else out.misconception = 'REMAINDER_WRONG';
      out.feedback = MISCONCEPTIONS[out.misconception].pupil;
      return out;
    }
    if (r !== null && divisor && r >= divisor) out.misconception = 'REMAINDER_TOO_BIG';
    else out.misconception = question.expr ? diagnoseFinal(question.expr, q) : 'CALC_SLIP';
    out.feedback = MISCONCEPTIONS[out.misconception]?.pupil || '再检查一次。';
    return out;
  }

  if (question.qtype === 'steps') {
    const expected1 = ans.steps?.[0];
    const s1 = parseIntAnswer(resp.steps?.[0]);
    let fin, finR = null;
    if (ans.remainder) {
      if (resp.q !== undefined) { fin = parseIntAnswer(resp.q); finR = resp.r === '' || resp.r == null ? null : parseIntAnswer(resp.r); }
      else { const p = parseRemainderAnswer(resp.final); fin = p ? p.q : null; finR = p && !p.noRemainderWritten ? p.r : null; }
    } else fin = parseIntAnswer(resp.final);
    out.detail = { step1: s1, final: fin, finalR: finR };
    if (s1 === null && fin === null) { out.feedback = '你还没有作答。'; return out; }
    const step1Right = s1 === expected1;
    const finalRight = fin === ans.final && (!ans.remainder || (finR ?? 0) === ans.remainder);
    let marks = 0;
    if (step1Right) marks += 1;
    if (finalRight) marks += 1;
    else if (!step1Right && s1 !== null && question.expr) {
      // 方法分：用学生自己的第一步结果正确完成第二步
      const op2 = question.expr.ops[1], c = question.expr.nums[2];
      const follow = applyOp(s1, op2, c);
      const followR = op2 === '/' ? s1 % c : 0;
      if (fin === follow && (!ans.remainder || (finR ?? 0) === followR)) { marks += 1; out.detail.followThrough = true; }
    }
    out.marks = Math.min(marks, maxMarks);
    out.correct = step1Right && finalRight;
    if (out.correct) { out.feedback = '两步都正确！'; return out; }
    if (!step1Right) {
      const e = question.expr;
      if (s1 !== null && e) {
        const rtlFirst = applyOp(e.nums[1], e.ops[1], e.nums[2]);
        out.misconception = s1 === rtlFirst ? 'ORDER_RTL' : diagnoseStep(e.nums[0], e.ops[0], e.nums[1], s1);
      } else out.misconception = 'CALC_SLIP';
      out.detail.wrongStep = 1;
    } else {
      const e = question.expr;
      if (ans.remainder && fin === ans.final) {
        out.misconception = (finR === null || finR === 0) ? 'REMAINDER_MISSING' : 'REMAINDER_WRONG';
      } else if (e && fin !== null) {
        const d = diagnoseStep(s1, e.ops[1], e.nums[2], fin);
        out.misconception = d === 'CALC_SLIP' ? 'STEP2_SLIP' : d;
      } else out.misconception = 'STEP2_SLIP';
      out.detail.wrongStep = 2;
    }
    out.feedback = (out.detail.wrongStep === 1 ? '第一步不对。' : '第一步正确！') + (MISCONCEPTIONS[out.misconception]?.pupil || '');
    return out;
  }

  if (question.qtype === 'mcq') {
    const chosen = resp.choice;
    out.detail.choice = chosen;
    if (chosen === undefined || chosen === null || chosen === '') { out.feedback = '请选一个答案。'; return out; }
    if (String(chosen) === String(ans.value)) { out.correct = true; out.marks = maxMarks; out.feedback = '选对了！'; return out; }
    const c = (question.choices || []).find(x => String(x.value) === String(chosen));
    out.misconception = c?.mc || 'METHOD_WRONG';
    out.feedback = c?.why || MISCONCEPTIONS[out.misconception]?.pupil || '再想一想。';
    return out;
  }

  if (question.qtype === 'order') {
    const got = resp.order || [];
    out.detail.order = got;
    const right = JSON.stringify(got) === JSON.stringify(ans.order);
    if (right) { out.correct = true; out.marks = maxMarks; out.feedback = '顺序完全正确！'; return out; }
    out.misconception = question.orderMisconception || 'ORDER_RTL';
    out.feedback = '顺序不对。' + (MISCONCEPTIONS[out.misconception]?.pupil || '');
    return out;
  }

  out.feedback = '无法批改这道题。';
  return out;
}

/** 把正确答案写成文字（报告与讲解用） */
export function correctAnswerText(question) {
  const a = question.answer || {};
  const unit = question.unit_label ? ` ${question.unit_label}` : '';
  switch (question.qtype) {
    case 'number': return fmt(a.value) + unit;
    case 'remainder': return `${fmt(a.q)} 余 ${fmt(a.r)}`;
    case 'steps': return `第一步 ${fmt(a.steps[0])}；答案 ${fmt(a.final)}${a.remainder ? ' 余 ' + fmt(a.remainder) : ''}${unit}`;
    case 'mcq': {
      const c = (question.choices || []).find(x => String(x.value) === String(a.value));
      return c ? c.text : String(a.value);
    }
    case 'order': return (a.order || []).map(id => (question.items || []).find(i => i.id === id)?.text || id).join(' → ');
    default: return '';
  }
}

/** 学生答案写成文字 */
export function responseText(question, response) {
  const r = response || {};
  switch (question.qtype) {
    case 'number': return r.value ? String(r.value) : '（未作答）';
    case 'remainder': return r.q !== undefined ? `${r.q || '?'}${r.r ? ' 余 ' + r.r : ''}` : (r.value || '（未作答）');
    case 'steps': {
      const fin = r.q !== undefined ? `${r.q || '?'}${r.r ? ' 余 ' + r.r : ''}` : (r.final || '?');
      return `第一步 ${r.steps?.[0] || '?'}；答案 ${fin}`;
    }
    case 'mcq': {
      const c = (question.choices || []).find(x => String(x.value) === String(r.choice));
      return c ? c.text : '（未作答）';
    }
    case 'order': return (r.order || []).map(id => (question.items || []).find(i => i.id === id)?.text || id).join(' → ') || '（未作答）';
    default: return '';
  }
}

export { OP_SYMBOL };
