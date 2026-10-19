// 题库生成器：根据课本第 23、29 页的题型生成可验证的题目。
// 运行：node content/generate-questions.js  → 输出 content/questions.json
// 生成结果固定（使用固定随机种子），每道题由 scripts/verify-questions.js 独立验证。
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { evaluate, exprText, stepText, fmt, answerText, seededRandom, shuffle, trailingZeros, OP_SYMBOL } from '../shared/math.js';
import { stepErrorVariants } from '../shared/marking.js';
import { workedSolution, firstStepHint, hint2For, likelyMistakes } from './builders.js';
import { layoutFor } from '../shared/vertical.js';

const here = dirname(fileURLToPath(import.meta.url));
const rand = seededRandom(20261019);
const ri = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

export const UNITS = [
  {
    id: 'U1-7', code: '1.7', title: '混合运算', sort: 1,
    description: '100 000 以内整数的加减混合运算与乘除混合运算（课本第 23、29 页）',
    objectives: ['能按从左到右的顺序计算混合运算', '能用课本竖式格式写出计算过程', '能解答两步应用题'],
  },
];
export const SUBTOPICS = [
  { id: 'U1-7-1', unit_id: 'U1-7', code: '1.7.1', title: '加减混合运算', sort: 1,
    objectives: ['按从左到右的顺序计算加减混合运算', '正确进位与退位（包括连续退位）', '判断能否先做减法'] },
  { id: 'U1-7-2', unit_id: 'U1-7', code: '1.7.2', title: '乘除混合运算', sort: 2,
    objectives: ['按从左到右的顺序计算乘除混合运算', '长除法中写出商中间的 0 与余数', '运用末尾有 0 的规律简化计算'] },
];

const questions = [];
const counters = { 'U1-7-1': 0, 'U1-7-2': 0 };
function nextId(sub) {
  counters[sub] += 1;
  return `${sub === 'U1-7-1' ? 'AS' : 'MD'}-${String(counters[sub]).padStart(3, '0')}`;
}

function base(sub, fields) {
  const id = nextId(sub);
  return {
    id, unit_id: 'U1-7', subtopic_id: sub, marks: null, alternatives: [], unit_label: null, source: '系统生成',
    is_textbook: false, choices: null, items: null, vertical: null, step: null, given: null, expr: null, ...fields,
  };
}

/** 计算题（number 或 remainder） */
function calcQuestion(sub, expr, { difficulty, stages, source, isTextbook, text, unitLabel, answerSentence, qtype, labels }) {
  const ev = evaluate(expr);
  if (!ev.valid) throw new Error('无效算式 ' + exprText(expr));
  const hasR = ev.remainder !== 0;
  const t = qtype || (hasR ? 'remainder' : 'number');
  const q = base(sub, {
    difficulty, stages, qtype: t, context: text ? 'word' : 'calc',
    text: text || `${exprText(expr)} = ?`,
    expr,
    answer: t === 'remainder' ? { q: ev.final, r: ev.remainder } : t === 'steps' ? { steps: [ev.steps[0].result], final: ev.final, remainder: ev.remainder || 0 } : { value: ev.final },
    worked_solution: workedSolution(expr, answerSentence),
    explanation: hasR ? `最后一步除不尽，答案要写商和余数：${answerText(ev.final, ev.remainder)}。` : `按从左到右计算，答案是 ${fmt(ev.final)}。`,
    hint: firstStepHint(expr),
    hint2: hint2For(expr),
    misconception: likelyMistakes(expr),
    unit_label: unitLabel || null,
    source: source || '系统生成',
    is_textbook: !!isTextbook,
    labels: labels || null,
  });
  return q;
}

function stepsQuestion(sub, expr, opts) {
  return calcQuestion(sub, expr, { ...opts, qtype: 'steps' });
}

/** 由错误类型生成选择题干扰项 */
function answerMcq(sub, expr, { difficulty, stages, text, source, isTextbook }) {
  const ev = evaluate(expr);
  const correct = ev.remainder ? `${fmt(ev.final)} 余 ${ev.remainder}` : fmt(ev.final);
  const distract = [];
  const seen = new Set([ev.final]);
  const add = (v, mc) => { if (Number.isInteger(v) && v >= 0 && !seen.has(v) && distract.length < 3) { seen.add(v); distract.push({ v, mc }); } };
  add(ev.steps[0].result, 'STOP_HALFWAY');
  const [a, b, c] = expr.nums; const [o1, o2] = expr.ops;
  const inner = o2 === '+' ? b + c : o2 === '-' ? b - c : o2 === '*' ? b * c : (b % c === 0 ? b / c : null);
  if (inner !== null) {
    const rtl = o1 === '+' ? a + inner : o1 === '-' ? a - inner : o1 === '*' ? a * inner : (a % inner === 0 ? a / inner : null);
    if (rtl !== null) add(rtl, 'ORDER_RTL');
  }
  ev.steps.forEach((st, i) => stepErrorVariants(st.a, st.op, st.b).forEach(v => {
    let acc = v.value; for (let k = i + 1; k < expr.ops.length; k++) { const n = expr.nums[k + 1]; const op = expr.ops[k]; acc = op === '+' ? acc + n : op === '-' ? acc - n : op === '*' ? acc * n : Math.floor(acc / n); }
    add(acc, v.code);
  }));
  let bump = 1;
  while (distract.length < 3) { add(ev.final + (bump % 2 ? 10 : -10) * Math.ceil(bump / 2), 'CALC_SLIP'); bump++; }
  const fmtD = (v) => ev.remainder ? `${fmt(v)} 余 ${ev.remainder}` : fmt(v);
  const choices = [{ text: correct, value: 'c' }, ...distract.map((d, i) => ({ text: fmtD(d.v), value: 'd' + i, mc: d.mc }))];
  return base(sub, {
    difficulty, stages, qtype: 'mcq', context: text ? 'word' : 'calc',
    text: text || `${exprText(expr)} = ?`, expr, choices, answer: { value: 'c' },
    worked_solution: workedSolution(expr), explanation: `正确答案是 ${correct}。`,
    hint: firstStepHint(expr), hint2: hint2For(expr), misconception: likelyMistakes(expr),
    source: source || '系统生成', is_textbook: !!isTextbook,
  });
}

/** “先算哪一步”选择题 */
function orderMcq(sub, expr, { difficulty, stages }) {
  const [a, b, c] = expr.nums, [o1, o2] = expr.ops;
  return base(sub, {
    difficulty, stages, qtype: 'mcq', context: 'concept',
    text: `计算 ${exprText(expr)} 时，按照课本的计算顺序，应该先算哪一步？`, expr,
    choices: [
      { text: `先算 ${fmt(a)} ${OP_SYMBOL[o1]} ${fmt(b)}`, value: 'c' },
      { text: `先算 ${fmt(b)} ${OP_SYMBOL[o2]} ${fmt(c)}`, value: 'd0', mc: 'ORDER_RTL' },
      { text: '哪一步都不用算，直接写答案', value: 'd1', mc: 'METHOD_WRONG' },
    ],
    answer: { value: 'c' },
    worked_solution: [`${o1 === '+' || o1 === '-' ? '加减' : '乘除'}混合运算，按从左到右的顺序计算。`, `所以先算 ${fmt(a)} ${OP_SYMBOL[o1]} ${fmt(b)}。`],
    explanation: '同一级的混合运算要从左到右计算。', hint: '看一看哪一个运算符号在最左边。', hint2: '从左到右，就像读句子一样。',
    misconception: '先算后面两个数（没有从左到右）',
  });
}

/** 部分已解：给出第一步，学生完成第二步 */
function guidedQuestion(sub, expr, { difficulty, stages }) {
  const ev = evaluate(expr);
  const s1 = ev.steps[0], s2 = ev.steps[1];
  const hasR = s2.remainder !== 0;
  const q = base(sub, {
    difficulty, stages, qtype: hasR ? 'remainder' : 'number', context: 'guided',
    text: `${exprText(expr)} = ?\n第一步已经算好了：${stepText(s1)}\n请完成第二步：${fmt(s1.result)} ${OP_SYMBOL[s2.op]} ${fmt(s2.b)} = ?`,
    given: { step1: stepText(s1), step2: `${fmt(s1.result)} ${OP_SYMBOL[s2.op]} ${fmt(s2.b)}` },
    step: { a: s1.result, op: s2.op, b: s2.b },
    answer: hasR ? { q: s2.result, r: s2.remainder, divisor: s2.b } : { value: s2.result },
    worked_solution: workedSolution(expr), explanation: `第二步：${stepText(s2)}。`,
    hint: `用第一步的结果 ${fmt(s1.result)} 继续${s2.op === '+' ? '加' : s2.op === '-' ? '减' : s2.op === '*' ? '乘' : '除以'} ${fmt(s2.b)}。`, hint2: hint2For(expr),
    misconception: likelyMistakes(expr),
  });
  return q;
}

/** 竖式填空：竖式中有一格空着 */
function verticalFill(sub, a, op, b, { difficulty, stages }) {
  const L = layoutFor(a, op, b);
  // 选结果行中的一格（不是最后答案的最高位）
  const resultRowIdx = op === '/' ? 0 : L.rows.length - 1;
  const row = L.rows[resultRowIdx];
  const candidates = row.cells.map((c, i) => (c && /\d/.test(c.t) ? i : -1)).filter(i => i >= 0);
  const col = candidates[Math.floor(candidates.length / 2)];
  const cell = row.cells[col];
  const place = op === '/' ? '商' : '得数';
  return base(sub, {
    difficulty, stages, qtype: 'number', context: 'vertical',
    text: `看竖式 ${fmt(a)} ${OP_SYMBOL[op]} ${fmt(b)}，${place}中 □ 里应该填什么数字？`,
    vertical: { a, op, b, row: resultRowIdx, col },
    step: null,
    answer: { value: Number(cell.t) },
    worked_solution: L.steps.map(s => s.text),
    explanation: `${fmt(a)} ${OP_SYMBOL[op]} ${fmt(b)} = ${op === '/' ? answerText(L.result, L.remainder) : fmt(L.result)}，所以 □ 里是 ${cell.t}。`,
    hint: op === '/' ? '按长除法一步一步地试商。' : '从个位开始，一位一位地算。',
    hint2: hint2For({ ops: [op, op] }),
    misconception: op === '/' ? '商中间漏写 0；试商错误' : op === '-' ? '退位错误' : '进位错误',
  });
}

/** 排列解题步骤 */
function orderQuestion(sub, expr, story, { difficulty, stages }) {
  const ev = evaluate(expr);
  const items = [
    { id: 'a', text: `先算 ${stepText(ev.steps[0])}` },
    { id: 'b', text: `再算 ${stepText(ev.steps[1])}` },
    { id: 'c', text: story.answer(ev) },
  ];
  return base(sub, {
    difficulty, stages, qtype: 'order', context: 'word',
    text: `${story.text}\n请把下面的解题步骤按正确的顺序排好。`, expr,
    items, answer: { order: ['a', 'b', 'c'] },
    worked_solution: workedSolution(expr, story.answer(ev)), explanation: '先算第一步，再用第一步的结果算第二步，最后写答句。',
    hint: '想一想：哪一步要先算出来，下一步才能用？', hint2: '答句一定是最后写的。', misconception: '步骤顺序颠倒',
  });
}

// ------------------------------------------------------------------
// 数字生成
const addSubExpr = (difficulty, pattern) => {
  for (let tries = 0; tries < 5000; tries++) {
    let a, b, c;
    if (difficulty === 1) { a = ri(1000, 8999); b = ri(1000, 8999); c = ri(1000, 8999); }
    else if (difficulty === 2) { a = ri(10000, 59999); b = ri(1000, 39999); c = ri(1000, 29999); }
    else {
      a = pick([100000, 90000, 80000, 70000, 60000, 50000, 40000 + ri(0, 9) * 1000 + 8, 60000 + ri(1, 9) * 100 + ri(0, 9)]);
      b = ri(10000, 49999); c = ri(1000, 29999);
      if (rand() < 0.5) { const z = String(b).split(''); z[2] = '0'; b = Number(z.join('')); }
    }
    const expr = { nums: [a, b, c], ops: pattern };
    const ev = evaluate(expr);
    if (!ev.valid || ev.final < 0 || ev.final > 100000 || ev.steps[0].result > 100000) continue;
    // 难度 1：最多两次进位/退位；难度 2、3：至少一次进位/退位
    const regroups = countRegroup(expr);
    if (difficulty === 1 && regroups > 2) continue;
    if (difficulty >= 2 && regroups < 2) continue;
    return expr;
  }
  throw new Error('生成失败');
};

function countRegroup(expr) {
  const ev = evaluate(expr);
  let n = 0;
  for (const st of ev.steps) {
    const A = String(st.a).split('').reverse().map(Number), B = String(st.b).split('').reverse().map(Number);
    let carry = 0;
    for (let i = 0; i < A.length; i++) {
      if (st.op === '+') { const s = (A[i] ?? 0) + (B[i] ?? 0) + carry; carry = s >= 10 ? 1 : 0; n += carry; }
      else { const s = A[i] - carry - (B[i] ?? 0); carry = s < 0 ? 1 : 0; n += carry; }
    }
  }
  return n;
}

const mulDivExpr = (difficulty, pattern, wantRemainder) => {
  for (let tries = 0; tries < 20000; tries++) {
    let a, b, c;
    if (pattern[0] === '*') {
      if (difficulty === 1) { a = ri(12, 99); b = ri(2, 9); c = ri(2, 9); }
      else if (difficulty === 2) { a = ri(120, 999); b = ri(3, 9); c = ri(3, 9); if (rand() < 0.4) { b = ri(11, 25); } }
      else { a = ri(1000, 4999); b = ri(12, 29); c = ri(11, 45); if (rand() < 0.3) { c = pick([20, 30, 40, 50]); } }
    } else {
      if (difficulty === 1) { b = ri(2, 9); a = b * ri(11, 99); c = ri(2, 9); }
      else if (difficulty === 2) { b = ri(3, 9); a = b * ri(101, 999); c = ri(3, 12); if (rand() < 0.4) { b = ri(11, 30); a = b * ri(21, 300); } }
      else {
        if (rand() < 0.5) { b = pick([20, 30, 40, 50, 60, 80]); a = b * pick([100, 200, 300, 400, 500, 600, 150, 250]); c = pick([20, 30, 40, 50, 12, 15]); }
        else { b = ri(12, 45); a = b * ri(101, 999); c = ri(11, 40); }
      }
    }
    const expr = { nums: [a, b, c], ops: pattern };
    const ev = evaluate(expr);
    if (!ev.valid || ev.final > 100000 || ev.steps[0].result > 100000 || ev.final < 1) continue;
    if (b === c || ev.final === a) continue; // 避免“乘了又除回原数”的无意义题
    if (pattern[1] === '/' && wantRemainder !== undefined && (ev.remainder !== 0) !== wantRemainder) continue;
    return expr;
  }
  throw new Error('生成失败 ' + pattern + difficulty);
};

// ------------------------------------------------------------------
// 应用题模板（马来西亚生活情境）
const PLACES = ['吉隆坡', '槟城', '怡保', '马六甲', '新山', '古晋', '亚庇', '关丹'];
const NAMES = ['阿明', '美玲', '古玛', '茜蒂', '志强', '丽莎', '嘉欣', '阿里'];

// 每个模板配上人工挑选、合乎情理的数字（答案仍由程序计算并验证）
const AS_WORD = [
  { ops: ['+', '-'], nums: [28465, 3870, 2595], d: 1, qtype: 'steps', unit: '本',
    make: (a, b, c) => `槟城一间图书馆原有 ${fmt(a)} 本书，今年又买进 ${fmt(b)} 本，后来把 ${fmt(c)} 本旧书捐给乡村学校。图书馆现在有多少本书？`, ans: (v) => `答：图书馆现在有 ${fmt(v)} 本书。` },
  { ops: ['+', '-'], nums: [3517, 2449, 5663], d: 1, unit: '个',
    make: (a, b, c) => `一间面包厂星期一生产了 ${fmt(a)} 个咖椰面包，星期二生产了 ${fmt(b)} 个，两天共卖出 ${fmt(c)} 个。还剩下多少个咖椰面包？`, ans: (v) => `答：还剩下 ${fmt(v)} 个咖椰面包。` },
  { ops: ['+', '-'], nums: [12450, 9785, 6890], d: 2, unit: '令吉',
    make: (a, b, c) => `学校义卖会第一天筹得 RM${fmt(a)}，第二天筹得 RM${fmt(b)}。扣除开销 RM${fmt(c)} 后，学校一共筹得多少令吉？`, ans: (v) => `答：学校一共筹得 RM${fmt(v)}。` },
  { ops: ['+', '-'], nums: [34970, 28305, 41260], d: 2, unit: '公斤',
    make: (a, b, c) => `一个油棕园上个月收成 ${fmt(a)} 公斤油棕果，这个月收成 ${fmt(b)} 公斤，两个月共运走了 ${fmt(c)} 公斤。还剩下多少公斤油棕果？`, ans: (v) => `答：还剩下 ${fmt(v)} 公斤油棕果。` },
  { ops: ['-', '+'], nums: [85000, 27460, 12895], d: 3, qtype: 'steps', unit: '公升',
    make: (a, b, c) => `一个水库原有 ${fmt(a)} 公升水，用去了 ${fmt(b)} 公升，下雨后又增加了 ${fmt(c)} 公升。水库现在有多少公升水？`, ans: (v) => `答：水库现在有 ${fmt(v)} 公升水。` },
  { ops: ['-', '+'], nums: [50000, 23015, 3202], d: 3, unit: '粒',
    make: (a, b, c) => `一个榴梿园收成了 ${fmt(a)} 粒榴梿，卖出 ${fmt(b)} 粒后，又收成了 ${fmt(c)} 粒。榴梿园现在有多少粒榴梿？`, ans: (v) => `答：榴梿园现在有 ${fmt(v)} 粒榴梿。` },
  { ops: ['-', '+'], nums: [33937, 2518, 1811], d: 2, unit: '张',
    make: (a, b, c) => `一场羽毛球比赛售出 ${fmt(a)} 张门票，有 ${fmt(b)} 人退票，后来又售出 ${fmt(c)} 张。现在一共售出多少张门票？`, ans: (v) => `答：现在一共售出 ${fmt(v)} 张门票。` },
  { ops: ['-', '+'], nums: [60000, 18575, 7650], d: 3, unit: '令吉',
    make: (a, b, c) => `嘉欣爸爸的储蓄户口有 RM${fmt(a)}，他取出 RM${fmt(b)} 装修房子，后来又存入 RM${fmt(c)}。户口里现在有多少令吉？`, ans: (v) => `答：户口里现在有 RM${fmt(v)}。` },
];

const MD_WORD = [
  { ops: ['*', '/'], nums: [24, 36, 8], d: 2, qtype: 'steps', unit: '罐',
    make: (a, b, c) => `每箱有 ${fmt(a)} 罐椰水，${fmt(b)} 箱椰水平均分给 ${fmt(c)} 间学校。每间学校分得多少罐椰水？`, ans: (v) => `答：每间学校分得 ${fmt(v)} 罐椰水。` },
  { ops: ['*', '/'], nums: [1250, 8, 25], d: 2, unit: '个',
    make: (a, b, c) => `一间工厂每天生产 ${fmt(a)} 个零件，${fmt(b)} 天生产的零件平均装进 ${fmt(c)} 个箱子。每个箱子装多少个零件？`, ans: (v) => `答：每个箱子装 ${fmt(v)} 个零件。` },
  { ops: ['*', '/'], nums: [8, 365, 6], d: 2, labels: ['礼袋（个）', '剩下（块）'],
    make: (a, b, c) => `每盒有 ${fmt(a)} 块月饼，${fmt(b)} 盒月饼每 ${fmt(c)} 块装成一个礼袋。可以装满多少个礼袋？还剩下多少块月饼？`, ans: (q, r) => `答：可以装满 ${fmt(q)} 个礼袋，还剩下 ${fmt(r)} 块月饼。` },
  { ops: ['*', '/'], nums: [3016, 16, 40], d: 3, labels: ['盒数', '剩下（个）'],
    make: (a, b, c) => `一间工厂每天生产 ${fmt(a)} 个口罩，${fmt(b)} 天生产的口罩每 ${fmt(c)} 个装成一盒。可以装满多少盒？还剩下多少个口罩？`, ans: (q, r) => `答：可以装满 ${fmt(q)} 盒，还剩下 ${fmt(r)} 个口罩。` },
  { ops: ['/', '*'], nums: [4800, 6, 4], d: 1, unit: '张',
    make: (a, b, c) => `${fmt(a)} 张演唱会门票平均分成 ${fmt(b)} 叠。${fmt(c)} 叠共有多少张门票？`, ans: (v) => `答：共有 ${fmt(v)} 张门票。` },
  { ops: ['/', '*'], nums: [1200, 48, 7], d: 2, unit: '公斤',
    make: (a, b, c) => `${fmt(a)} 公斤白米平均装成 ${fmt(b)} 包。${fmt(c)} 包白米重多少公斤？`, ans: (v) => `答：7 包白米重 ${fmt(v)} 公斤。` },
  { ops: ['/', '*'], nums: [7596, 9, 7], d: 2, unit: '粒',
    make: (a, b, c) => `屠妖节时，${fmt(a)} 粒糖果平均分给 ${fmt(b)} 个班级。${fmt(c)} 个班级一共分得多少粒糖果？`, ans: (v) => `答：一共分得 ${fmt(v)} 粒糖果。` },
];

// ------------------------------------------------------------------
// 课本原题（第 23 页、第 29 页）
const AS = 'U1-7-1', MD = 'U1-7-2';
const TB23 = '课本第 23 页';
const TB29 = '课本第 29 页';

// 例 3（罚单）
questions.push(Object.assign(stepsQuestion(AS, { nums: [3801, 8632, 1472], ops: ['+', '-'] }, {
  difficulty: 2, stages: [1, 3, 5, 6], source: `${TB23} 例 3`, isTextbook: true,
  text: '主要触犯的交通条例共 3 801 张罚单，自动安全醒觉系统共 8 632 张罚单。扣除超载的 1 472 张罚单，执法单位发出了多少张罚单？',
  unitLabel: '张', answerSentence: '答：执法单位发出了 10 961 张罚单。',
}), { lesson: 'L1' }));
questions.push(calcQuestion(AS, { nums: [5608, 43391, 8192], ops: ['+', '-'] }, { difficulty: 2, stages: [3, 5, 6], source: `${TB23} 自我学习 1`, isTextbook: true }));
questions.push(calcQuestion(AS, { nums: [80008, 12354, 6008], ops: ['+', '-'] }, { difficulty: 2, stages: [3, 5, 6], source: `${TB23} 自我学习 2`, isTextbook: true }));
questions.push(calcQuestion(AS, { nums: [100000, 57057, 5757], ops: ['-', '+'] }, { difficulty: 3, stages: [3, 5, 6], source: `${TB23} 自我学习 3`, isTextbook: true }));
// 讨论题
questions.push(base(AS, {
  difficulty: 2, stages: [1, 2, 4], qtype: 'mcq', context: 'concept', source: `${TB23} 讨论`, is_textbook: true,
  text: '3 801 + 8 632 − 1 472，可以先算 3 801 − 1 472，再加 8 632 吗？',
  choices: [
    { text: '可以，因为 3 801 比 1 472 大，够减', value: 'c' },
    { text: '不可以，加减混合运算一定不能改变顺序', value: 'd0', mc: 'METHOD_WRONG', why: '课本说明：当被减数大于减数时，可以先做减法。3 801 比 1 472 大，所以可以。' },
    { text: '可以，任何时候都可以先减', value: 'd1', mc: 'METHOD_WRONG', why: '不是任何时候都可以。如果被减数比减数小，就不能先减，例如 1 000 + 5 000 − 3 000 不能先算 1 000 − 3 000。' },
  ],
  answer: { value: 'c' },
  worked_solution: ['3 801 − 1 472 = 2 329', '2 329 + 8 632 = 10 961', '和从左到右计算的答案一样。', '只有被减数大于减数时，才能先做减法。'],
  explanation: '3 801 比 1 472 大，所以可以先减后加，答案一样是 10 961。', hint: '比较 3 801 和 1 472，哪个大？', hint2: '先减的时候，被减数一定要比减数大。',
  misconception: '以为顺序绝对不能改变，或以为任何时候都可以先减',
}));
// 思考题 6 177
questions.push(base(AS, {
  difficulty: 3, stages: [3, 5], qtype: 'mcq', context: 'word', source: `${TB23} 思考题（答案为推断）`, is_textbook: true, enrichment: true,
  text: '看课本第 23 页的两个罚单表：哪两种交通罚单的数量相差 6 177 张？\n（提示：两个表里都有“闯红灯”）',
  choices: [
    { text: '超速和闯红灯（565 + 945 = 1 510，7 687 − 1 510 = 6 177）', value: 'c' },
    { text: '超速和超载', value: 'd0', mc: 'CALC_SLIP', why: '7 687 − 1 472 = 6 215，不是 6 177。' },
    { text: '超速和闯红灯（只看第二个表的 945 张）', value: 'd1', mc: 'METHOD_WRONG', why: '7 687 − 945 = 6 742。要把两个表的闯红灯罚单加起来。' },
    { text: '超速和没有系上安全带', value: 'd2', mc: 'CALC_SLIP', why: '7 687 − 541 = 7 146，不是 6 177。' },
  ],
  answer: { value: 'c' },
  worked_solution: ['闯红灯罚单：565 + 945 = 1 510（张）', '超速罚单：7 687 张', '7 687 − 1 510 = 6 177', '所以是超速和闯红灯。'],
  explanation: '把两个表中的闯红灯罚单合起来，再和超速比较。', hint: '两个表里都有闯红灯，先把它们加起来。', hint2: '用超速的数量去减。',
  misconception: '只看其中一个表的数量',
}));

// 例 4、例 5 与自我学习（第 29 页）
questions.push(Object.assign(stepsQuestion(MD, { nums: [3245, 19, 30], ops: ['*', '/'] }, { difficulty: 3, stages: [1, 3, 5, 6], source: `${TB29} 例 4`, isTextbook: true }), { lesson: 'L4' }));
questions.push(Object.assign(stepsQuestion(MD, { nums: [30000, 50, 20], ops: ['/', '*'] }, { difficulty: 3, stages: [1, 3, 5, 6], source: `${TB29} 例 5`, isTextbook: true }), { lesson: 'L5' }));
questions.push(calcQuestion(MD, { nums: [36, 4, 2], ops: ['*', '/'] }, { difficulty: 1, stages: [3, 5, 6], source: `${TB29} 自我学习 1`, isTextbook: true }));
questions.push(calcQuestion(MD, { nums: [72, 8, 3], ops: ['/', '*'] }, { difficulty: 1, stages: [3, 5, 6], source: `${TB29} 自我学习 2`, isTextbook: true }));
questions.push(calcQuestion(MD, { nums: [27, 150, 9], ops: ['*', '/'] }, { difficulty: 2, stages: [3, 5, 6], source: `${TB29} 自我学习 3`, isTextbook: true }));
questions.push(calcQuestion(MD, { nums: [357, 88, 13], ops: ['*', '/'] }, { difficulty: 3, stages: [3, 5, 6], source: `${TB29} 自我学习 4`, isTextbook: true }));
questions.push(calcQuestion(MD, { nums: [100000, 1000, 99], ops: ['/', '*'] }, {
  difficulty: 2, stages: [3, 5, 6], source: `${TB29} 自我学习 5`, isTextbook: true,
  text: '10 万除以 1 千，再乘 99，等于多少？', answerSentence: '答：等于 9 900。',
}));
// 末尾 0 的规律
questions.push(base(MD, {
  difficulty: 2, stages: [1, 2, 4], qtype: 'mcq', context: 'concept', source: `${TB29} 例 5 规律`, is_textbook: true,
  text: '计算 30 000 ÷ 50 时，被除数和除数末尾都有 0。可以先把算式变成哪一个？',
  choices: [
    { text: '3 000 ÷ 5', value: 'c' },
    { text: '3 000 ÷ 50', value: 'd0', mc: 'ZERO_LOST', why: '被除数和除数要同时除以 10，不能只改一个。' },
    { text: '30 000 ÷ 5', value: 'd1', mc: 'ZERO_LOST', why: '被除数和除数要同时除以 10，不能只改一个。' },
    { text: '300 ÷ 50', value: 'd2', mc: 'ZERO_LOST', why: '被除数去掉了两个 0，除数却没有改，不对。' },
  ],
  answer: { value: 'c' },
  worked_solution: ['被除数和除数末尾都有 0，可以先将它们都除以 10。', '30 000 ÷ 10 = 3 000，50 ÷ 10 = 5', '所以 30 000 ÷ 50 = 3 000 ÷ 5 = 600'],
  explanation: '被除数和除数同时除以 10，商不变。', hint: '被除数和除数都要变。', hint2: '同时去掉一个 0。',
  misconception: '只去掉被除数或除数其中一个的 0',
}));
questions.push(base(MD, {
  difficulty: 2, stages: [1, 2, 4, 6], qtype: 'mcq', context: 'concept', source: '课本第 29 页 例 4 延伸',
  text: '一个数除以 30，余数可能是下面哪一个？',
  choices: [
    { text: '5', value: 'c' },
    { text: '30', value: 'd0', mc: 'REMAINDER_TOO_BIG', why: '余数必须比除数 30 小，30 不可以。' },
    { text: '35', value: 'd1', mc: 'REMAINDER_TOO_BIG', why: '35 比 30 大，说明还可以再除。' },
    { text: '31', value: 'd2', mc: 'REMAINDER_TOO_BIG', why: '31 比 30 大，说明还可以再除。' },
  ],
  answer: { value: 'c' },
  worked_solution: ['余数一定要比除数小。', '比 30 小的只有 5。'], explanation: '余数 < 除数。', hint: '余数和除数比，谁大？', hint2: '余数一定比除数小。',
  misconception: '余数大于或等于除数',
}));
questions.push(base(MD, {
  difficulty: 2, stages: [1, 2, 4], qtype: 'mcq', context: 'concept', source: '课本第 29 页 例 4 延伸',
  text: '用长除法计算 61 655 ÷ 30 时，算到 16 ÷ 30 不够除，商应该怎样写？',
  choices: [
    { text: '在百位上商 0', value: 'c' },
    { text: '跳过，不用写', value: 'd0', mc: 'QUOTIENT_ZERO', why: '不够除也要在那一位商 0，否则商会少一位。' },
    { text: '商 1', value: 'd1', mc: 'CALC_SLIP', why: '1 × 30 = 30，比 16 大，不够减。' },
  ],
  answer: { value: 'c' },
  worked_solution: ['16 比 30 小，不够除。', '在百位上商 0：0 × 30 = 0，16 − 0 = 16。', '再把下一位 5 移下来，得 165。'],
  explanation: '商中间的 0 不能漏写，课本特别写出“16 − 0”这一步。', hint: '不够除时，那一位商几？', hint2: '想一想 2 055 和 255 哪个对。',
  misconception: '商中间漏写 0',
}));

// ------------------------------------------------------------------
// 生成：加减混合
for (const d of [1, 1, 1, 2, 2, 2, 3, 3]) {
  const pat = rand() < 0.5 ? ['+', '-'] : ['-', '+'];
  questions.push(calcQuestion(AS, addSubExpr(d, pat), { difficulty: d, stages: d === 1 ? [3, 4, 5] : d === 2 ? [3, 4, 5, 6] : [3, 5, 6] }));
}
for (const d of [1, 2, 2, 3]) {
  const pat = rand() < 0.5 ? ['+', '-'] : ['-', '+'];
  questions.push(stepsQuestion(AS, addSubExpr(d, pat), { difficulty: d, stages: [2, 3, 6] }));
}
for (const d of [1, 2, 2, 3]) questions.push(guidedQuestion(AS, addSubExpr(d, pick([['+', '-'], ['-', '+']])), { difficulty: d, stages: [2, 4] }));
for (const d of [1, 2, 3]) questions.push(orderMcq(AS, addSubExpr(d, ['-', '+']), { difficulty: 1, stages: [1, 2, 4] }));
for (const d of [1, 2, 2, 3, 3]) questions.push(answerMcq(AS, addSubExpr(d, pick([['+', '-'], ['-', '+']])), { difficulty: d, stages: [2, 4, 5, 6] }));
// 竖式填空
questions.push(verticalFill(AS, 3801, '+', 8632, { difficulty: 1, stages: [2, 4] }));
questions.push(verticalFill(AS, 12433, '-', 1472, { difficulty: 2, stages: [2, 4] }));
questions.push(verticalFill(AS, 70000, '-', 23456, { difficulty: 3, stages: [2, 4] }));
questions.push(verticalFill(AS, 45678, '+', 37895, { difficulty: 2, stages: [2, 4] }));
// 应用题
for (const tpl of AS_WORD) {
  const expr = { nums: tpl.nums, ops: tpl.ops };
  const ev = evaluate(expr);
  questions.push(calcQuestion(AS, expr, { difficulty: tpl.d, stages: [3, 4, 5, 6], text: tpl.make(...tpl.nums), unitLabel: tpl.unit, answerSentence: tpl.ans(ev.final), qtype: tpl.qtype }));
}
// 排序题
questions.push(orderQuestion(AS, { nums: [24560, 13870, 9845], ops: ['+', '-'] }, {
  text: '一个电子商店上半年卖出 24 560 个充电器，下半年卖出 13 870 个，其中 9 845 个被退回。全年实际卖出多少个充电器？',
  answer: (ev) => `答：全年实际卖出 ${fmt(ev.final)} 个充电器。`,
}, { difficulty: 2, stages: [2, 4] }));
questions.push(orderQuestion(AS, { nums: [56000, 18750, 6420], ops: ['-', '+'] }, {
  text: '一间学校有 RM56 000 的基金，用 RM18 750 买新电脑后，家教协会又捐了 RM6 420。学校现在有多少令吉的基金？',
  answer: (ev) => `答：学校现在有 RM${fmt(ev.final)} 的基金。`,
}, { difficulty: 2, stages: [2, 4] }));
// 挑战题（提升）
questions.push(Object.assign(calcQuestion(AS, { nums: [100000, 36985, 27409], ops: ['-', '-'] }, {
  difficulty: 3, stages: [3, 5], text: '一场马拉松准备了 100 000 瓶水。第一天用了 36 985 瓶，第二天用了 27 409 瓶。还剩下多少瓶水？',
  unitLabel: '瓶', answerSentence: '答：还剩下 35 606 瓶水。',
}), { enrichment: true }));
questions.push(Object.assign(calcQuestion(AS, { nums: [48250, 19675, 30580], ops: ['+', '-'] }, {
  difficulty: 3, stages: [3, 5], text: '甲仓库有 48 250 箱货物，乙仓库比甲仓库少 19 675 箱。两个仓库一共有多少箱货物？\n（提示：先求乙仓库，再求两个仓库的总数）',
  qtype: 'number', unitLabel: '箱', answerSentence: '',
}), { enrichment: true, expr: null, step: null, answer: { value: 48250 + (48250 - 19675) },
  worked_solution: ['乙仓库：48 250 − 19 675 = 28 575（箱）', '一共：48 250 + 28 575 = 76 825（箱）', '答：两个仓库一共有 76 825 箱货物。'],
  explanation: '先求乙仓库的数量，再把两个仓库加起来。', hint: '先算乙仓库有多少箱。', hint2: '乙仓库 = 48 250 − 19 675。', misconception: '以为乙仓库就是 19 675 箱' }));

// ------------------------------------------------------------------
// 生成：乘除混合
const mdPlan = [
  [1, ['*', '/'], false], [1, ['/', '*'], false], [1, ['*', '/'], false], [1, ['/', '*'], false],
  [2, ['*', '/'], false], [2, ['*', '/'], true], [2, ['/', '*'], false], [2, ['*', '/'], true],
  [3, ['*', '/'], true], [3, ['/', '*'], false], [3, ['*', '/'], true], [3, ['/', '*'], false],
];
for (const [d, pat, rem] of mdPlan) questions.push(calcQuestion(MD, mulDivExpr(d, pat, rem), { difficulty: d, stages: d === 1 ? [3, 4, 5] : [3, 4, 5, 6] }));
for (const [d, pat, rem] of [[1, ['*', '/'], false], [2, ['/', '*'], false], [2, ['*', '/'], true], [3, ['*', '/'], true]]) {
  questions.push(stepsQuestion(MD, mulDivExpr(d, pat, rem), { difficulty: d, stages: [2, 3, 6] }));
}
for (const [d, pat, rem] of [[1, ['*', '/'], false], [2, ['/', '*'], false], [2, ['*', '/'], true], [3, ['/', '*'], false]]) {
  questions.push(guidedQuestion(MD, mulDivExpr(d, pat, rem), { difficulty: d, stages: [2, 4] }));
}
for (const d of [1, 2]) questions.push(orderMcq(MD, mulDivExpr(d, ['/', '*']), { difficulty: 1, stages: [1, 2, 4] }));
for (const [d, pat, rem] of [[1, ['*', '/'], false], [2, ['/', '*'], false], [2, ['*', '/'], false], [3, ['*', '/'], true], [3, ['/', '*'], false]]) {
  questions.push(answerMcq(MD, mulDivExpr(d, pat, rem), { difficulty: d, stages: [2, 4, 5, 6] }));
}
questions.push(verticalFill(MD, 61655, '/', 30, { difficulty: 3, stages: [2, 4] }));
questions.push(verticalFill(MD, 3245, '*', 19, { difficulty: 3, stages: [2, 4] }));
questions.push(verticalFill(MD, 4824, '/', 8, { difficulty: 2, stages: [2, 4] }));
questions.push(verticalFill(MD, 1278, '*', 6, { difficulty: 1, stages: [2, 4] }));
// 应用题
for (const tpl of MD_WORD) {
  const expr = { nums: tpl.nums, ops: tpl.ops };
  const ev = evaluate(expr);
  questions.push(calcQuestion(MD, expr, { difficulty: tpl.d, stages: [3, 4, 5, 6], text: tpl.make(...tpl.nums), unitLabel: tpl.unit,
    answerSentence: ev.remainder ? tpl.ans(ev.final, ev.remainder) : tpl.ans(ev.final), qtype: tpl.qtype, labels: tpl.labels }));
}
questions.push(orderQuestion(MD, { nums: [2400, 6, 15], ops: ['/', '*'] }, {
  text: '开斋节时，一间商店把 2 400 粒糖果平均装成 6 大包。如果要准备 15 大包同样的糖果，一共需要多少粒糖果？',
  answer: (ev) => `答：一共需要 ${fmt(ev.final)} 粒糖果。`,
}, { difficulty: 2, stages: [2, 4] }));
questions.push(orderQuestion(MD, { nums: [125, 24, 8], ops: ['*', '/'] }, {
  text: '每个篮子有 125 粒红毛丹，24 个篮子的红毛丹平均分给 8 个班级。每个班级分得多少粒红毛丹？',
  answer: (ev) => `答：每个班级分得 ${fmt(ev.final)} 粒红毛丹。`,
}, { difficulty: 2, stages: [2, 4] }));
// 挑战题
questions.push(Object.assign(calcQuestion(MD, { nums: [2450, 36, 25], ops: ['*', '/'] }, {
  difficulty: 3, stages: [3, 5], text: '一间工厂每小时生产 2 450 个塑料瓶，工作 36 小时后，把塑料瓶每 25 个装成一包。一共可以装成多少包？',
  unitLabel: '包', answerSentence: '答：一共可以装成 3 528 包。',
}), { enrichment: true }));
questions.push(Object.assign(calcQuestion(MD, { nums: [90000, 40, 30], ops: ['/', '*'] }, {
  difficulty: 3, stages: [3, 5, 6], text: '90 000 ÷ 40 × 30 = ?（想一想：可以怎样简化？）',
}), { enrichment: true }));

// 去掉辅助字段并补齐满分
for (const q of questions) {
  if (q.marks == null) q.marks = q.qtype === 'steps' || q.qtype === 'remainder' ? 2 : 1;
  if (!q.difficulty) q.difficulty = 1;
}

const out = { generated_at: new Date().toISOString().slice(0, 10), units: UNITS, subtopics: SUBTOPICS, questions };
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(join(here, 'questions.json'), JSON.stringify(out, null, 1));
  const by = {};
  for (const q of questions) by[q.subtopic_id] = (by[q.subtopic_id] || 0) + 1;
  console.log('题目数量：', by, '共', questions.length);
}
export default out;
