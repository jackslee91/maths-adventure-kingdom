// 逐题验证题库：node scripts/verify-questions.js
import { readFileSync } from 'node:fs';
import { verifyQuestion } from '../server/verify.js';
import { markAnswer } from '../shared/marking.js';
import { layoutFor } from '../shared/vertical.js';

const bank = JSON.parse(readFileSync(new URL('../content/questions.json', import.meta.url)));
let bad = 0;
const ids = new Set();
for (const q of bank.questions) {
  if (ids.has(q.id)) { console.log('重复 ID', q.id); bad++; }
  ids.add(q.id);
  const errs = verifyQuestion(q);
  if (errs.length) { bad++; console.log(q.id, errs); }
}
const perSub = {};
for (const q of bank.questions) perSub[q.subtopic_id] = (perSub[q.subtopic_id] || 0) + 1;
for (const [k, v] of Object.entries(perSub)) if (v < 30) { console.log(`${k} 题目少于 30 道`); bad++; }

// 课本答案核对
const expect = {
  '3801+8632-1472': 10961, '5608+43391-8192': 40807, '80008+12354-6008': 86354, '100000-57057+5757': 48700,
  '36*4/2': 72, '72/8*3': 27, '27*150/9': 450, '30000/50*20': 12000, '100000/1000*99': 9900,
};
for (const q of bank.questions.filter(q => q.is_textbook && q.expr)) {
  const key = `${q.expr.nums[0]}${q.expr.ops[0]}${q.expr.nums[1]}${q.expr.ops[1]}${q.expr.nums[2]}`;
  const v = q.answer.value ?? q.answer.final ?? q.answer.q;
  if (key in expect && expect[key] !== v) { console.log('课本答案不符', key, v); bad++; }
}
const t4 = bank.questions.find(q => q.expr && q.expr.nums.join() === '3245,19,30');
if (!(t4.answer.final === 2055 && t4.answer.remainder === 5)) { console.log('例4 答案错'); bad++; }
const t8 = bank.questions.find(q => q.expr && q.expr.nums.join() === '357,88,13');
if (!(t8.answer.q === 2416 && t8.answer.r === 8)) { console.log('自我学习4 答案错'); bad++; }

// 错误类型识别抽查
const checks = [
  [{ qtype: 'number', expr: { nums: [100000, 57057, 5757], ops: ['-', '+'] }, answer: { value: 48700 } }, '37186', 'ORDER_RTL'],
  [{ qtype: 'number', expr: { nums: [3801, 8632, 1472], ops: ['+', '-'] }, answer: { value: 10961 } }, '12433', 'STOP_HALFWAY'],
  [{ qtype: 'remainder', expr: { nums: [3245, 19, 30], ops: ['*', '/'] }, answer: { q: 2055, r: 5 } }, { q: '255', r: '5' }, 'QUOTIENT_ZERO'],
  [{ qtype: 'remainder', expr: { nums: [3245, 19, 30], ops: ['*', '/'] }, answer: { q: 2055, r: 5 } }, { q: '2055', r: '' }, 'REMAINDER_MISSING'],
  [{ qtype: 'number', expr: { nums: [30000, 50, 20], ops: ['/', '*'] }, answer: { value: 12000 } }, '1200', 'ZERO_LOST'],
  [{ qtype: 'number', expr: { nums: [30000, 50, 20], ops: ['/', '*'] }, answer: { value: 12000 } }, '30', 'ORDER_RTL'],
];
for (const [q, resp, code] of checks) {
  const m = markAnswer(q, typeof resp === 'string' ? { value: resp } : resp);
  if (m.misconception !== code) { console.log('错误识别不符', resp, m.misconception, '应为', code); bad++; }
}
// 部分分
const st = bank.questions.find(q => q.qtype === 'steps' && q.expr.nums.join() === '3801,8632,1472');
const pm = markAnswer(st, { steps: ['12443'], final: '10971' });
if (pm.marks !== 1 || !pm.detail.followThrough) { console.log('方法分规则失败', pm); bad++; }
const pm2 = markAnswer(st, { steps: ['12433'], final: '10971' });
if (pm2.marks !== 1) { console.log('第一步分规则失败', pm2); bad++; }

// 大量随机竖式核对
for (let i = 0; i < 3000; i++) {
  const a = 1 + Math.floor(Math.random() * 99999);
  const b = 1 + Math.floor(Math.random() * 99);
  for (const [op, expect] of [['+', a + b], ['-', a >= b ? a - b : null], ['*', a * b <= 100000 ? a * b : null], ['/', Math.floor(a / b)]]) {
    if (expect === null) continue;
    const L = layoutFor(a, op, b);
    if (L.result !== expect) { console.log('竖式错误', a, op, b); bad++; }
  }
}

console.log(bad ? `❌ 发现 ${bad} 个问题` : `✅ 全部 ${bank.questions.length} 道题验证通过（${Object.entries(perSub).map(([k, v]) => `${k}: ${v} 道`).join('，')}）`);
process.exit(bad ? 1 : 0);
