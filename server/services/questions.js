// 题库：读取、缓存、给学生的安全版本、选题、技能标签
import crypto from 'node:crypto';
import { all } from '../db.js';
import { trailingZeros, shuffle } from '../../shared/math.js';

let cache = null;
let cacheAt = 0;

export function invalidateBank() { cache = null; }

export async function loadBank() {
  if (cache && Date.now() - cacheAt < 60_000) return cache;
  const rows = await all('SELECT id, unit_id, subtopic_id, difficulty, qtype, stages, data, marks, source, is_textbook, verified, is_active FROM questions');
  const map = new Map();
  for (const r of rows) {
    map.set(r.id, { ...r.data, id: r.id, unit_id: r.unit_id, subtopic_id: r.subtopic_id, difficulty: r.difficulty, qtype: r.qtype,
      stages: r.stages, marks: r.marks, source: r.source, is_textbook: r.is_textbook, verified: r.verified, is_active: r.is_active });
  }
  cache = map; cacheAt = Date.now();
  return map;
}

export async function getQuestion(id) { return (await loadBank()).get(id) || null; }

export async function unitQuestions(unitId, { activeOnly = true } = {}) {
  return [...(await loadBank()).values()].filter(q => q.unit_id === unitId && (!activeOnly || (q.is_active && q.verified)));
}

const rnd = () => crypto.randomInt(0, 2 ** 31) / 2 ** 31;

/** 学生看到的题目：不含答案、解题步骤、错误分析；选项位置每次随机 */
export function sanitize(q, { formal = false } = {}) {
  const out = {
    id: q.id, subtopic_id: q.subtopic_id, difficulty: q.difficulty, qtype: q.qtype, context: q.context, text: q.text,
    expr: q.expr || null, unit_label: q.unit_label || null, labels: q.labels || null, given: q.given || null,
    marks: q.marks, enrichment: !!q.enrichment,
  };
  if (q.vertical) out.vertical = q.vertical;
  if (!formal) { out.hint = q.hint || null; out.hint2 = q.hint2 || null; }
  if (q.qtype === 'mcq') out.choices = shuffle(q.choices.map(c => ({ text: c.text, value: c.value })), rnd);
  if (q.qtype === 'order') out.items = shuffle(q.items.map(i => ({ id: i.id, text: i.text })), rnd);
  if (q.qtype === 'steps') out.stepPrompt = q.expr ? stepPrompt(q.expr) : '第一步';
  if (q.qtype === 'remainder' || (q.qtype === 'steps' && q.answer?.remainder)) out.hasRemainder = true;
  return out;
}

function stepPrompt(expr) {
  const sym = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  const f = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${f(expr.nums[0])} ${sym[expr.ops[0]]} ${f(expr.nums[1])} =`;
}

/** 技能标签（报告中用来说明“掌握了什么”，只根据题目本身推断） */
export function skillTags(q) {
  const tags = new Set();
  if (q.context === 'word') tags.add('解答应用题');
  if (q.context === 'concept') tags.add('理解运算顺序与规律');
  const e = q.expr;
  if (e) {
    if (e.ops.length > 1) tags.add('按从左到右的顺序计算');
    let acc = e.nums[0];
    e.ops.forEach((op, i) => {
      const b = e.nums[i + 1];
      if (op === '+') {
        const A = String(acc).split('').reverse().map(Number), B = String(b).split('').reverse().map(Number);
        let c = 0, carried = false;
        for (let k = 0; k < Math.max(A.length, B.length); k++) { const s = (A[k] || 0) + (B[k] || 0) + c; c = s >= 10 ? 1 : 0; if (c) carried = true; }
        tags.add(carried ? '加法进位' : '加法');
        acc = acc + b;
      } else if (op === '-') {
        const A = String(acc).split('').reverse().map(Number), B = String(b).split('').reverse().map(Number);
        let br = 0, borrowed = false, chain = false;
        for (let k = 0; k < A.length; k++) { const d = A[k] - br - (B[k] || 0); if (d < 0) { if (A[k + 1] === 0) chain = true; borrowed = true; br = 1; } else br = 0; }
        tags.add(chain ? '连续退位减法' : borrowed ? '退位减法' : '减法');
        acc = acc - b;
      } else if (op === '*') {
        tags.add(b >= 10 && trailingZeros(b) === 0 ? '两位数乘法' : trailingZeros(b) > 0 ? '末尾有 0 的乘法' : '乘一位数');
        acc = acc * b;
      } else if (op === '/') {
        const qv = Math.floor(acc / b);
        if (trailingZeros(acc) && trailingZeros(b) && acc % b === 0) tags.add('末尾有 0 的除法');
        else tags.add(b >= 10 ? '除以两位数（长除法）' : '除以一位数（长除法）');
        if (String(qv).slice(1).includes('0')) tags.add('商中间或末尾有 0');
        if (acc % b) tags.add('有余数的除法');
        acc = qv;
      }
    });
  }
  if (q.vertical) tags.add(q.vertical.op === '/' ? '长除法竖式' : '竖式计算');
  if (q.qtype === 'order') tags.add('有条理地排列解题步骤');
  return [...tags];
}

function pickBalanced(pool, n, { bySub = true, sortByDifficulty = true, prefer = new Set() } = {}) {
  const groups = {};
  for (const q of shuffle(pool, rnd)) (groups[bySub ? q.subtopic_id : 'all'] ||= []).push(q);
  for (const k of Object.keys(groups)) groups[k].sort((a, b) => (prefer.has(a.id) ? 1 : 0) - (prefer.has(b.id) ? 1 : 0));
  const keys = Object.keys(groups).sort();
  const out = [];
  let i = 0;
  while (out.length < n && keys.some(k => groups[k].length)) {
    const k = keys[i % keys.length];
    if (groups[k].length) out.push(groups[k].shift());
    i++;
  }
  return sortByDifficulty ? out.sort((a, b) => a.difficulty - b.difficulty) : out;
}

/**
 * 选题。seen：学生已经做过的题（尽量避免重复）
 */
export async function selectForStage(unitId, stage, { seen = new Set(), count, weakSubtopic, subtopics } = {}) {
  const qs = (await unitQuestions(unitId)).filter(q => !subtopics || subtopics.includes(q.subtopic_id));
  const inStage = (s) => qs.filter(q => q.stages.includes(s));
  switch (stage) {
    case 1: return pickBalanced(inStage(1).filter(q => q.qtype === 'mcq'), count || 3, { sortByDifficulty: false });
    case 2: {
      const pool = inStage(2);
      const byType = (t) => pool.filter(q => (t === 'guided' ? q.context === 'guided' : t === 'vertical' ? !!q.vertical : q.qtype === t && !q.vertical && q.context !== 'guided'));
      const picks = [
        ...pickBalanced(byType('guided'), 2), ...pickBalanced(byType('vertical'), 2), ...pickBalanced(byType('steps'), 2),
        ...pickBalanced(byType('mcq'), 1), ...pickBalanced(byType('order'), 1),
      ];
      return picks.slice(0, count || 8);
    }
    case 3: return pickBalanced(inStage(3).filter(q => !q.enrichment && q.qtype !== 'mcq'), count || 8, { prefer: seen });
    case 4: {
      const pool = inStage(4);
      const lock = pickBalanced(pool.filter(q => (q.qtype === 'number' || q.qtype === 'remainder') && q.context !== 'guided' && !q.vertical), 2);
      const fork = pickBalanced(pool.filter(q => q.qtype === 'mcq' && q.context !== 'concept'), 2);
      const bridge = pickBalanced(pool.filter(q => q.context === 'guided' || q.vertical), 1);
      const key = pickBalanced(pool.filter(q => q.qtype === 'mcq' && q.context === 'concept'), 1);
      const rooms = [
        { room: 'lock', q: lock[0] }, { room: 'fork', q: fork[0] }, { room: 'bridge', q: bridge[0] },
        { room: 'key', q: key[0] }, { room: 'fork', q: fork[1] }, { room: 'lock', q: lock[1] },
      ].filter(r => r.q);
      return rooms;
    }
    case 5: {
      const pool = inStage(5).filter(q => !q.enrichment);
      const easy = pickBalanced(pool.filter(q => q.difficulty === 1), 2, { prefer: seen });
      const mid = pickBalanced(pool.filter(q => q.difficulty === 2), 3, { prefer: seen });
      const hard = pickBalanced(pool.filter(q => q.difficulty === 3), 3, { prefer: seen });
      return [...easy, ...mid, ...hard];
    }
    case 6: {
      const pool = inStage(6).filter(q => !q.enrichment);
      const n = count || 10;
      // 难度搭配：约 30% 容易、40% 中等、30% 较难
      const nEasy = Math.round(n * 0.3), nHard = Math.round(n * 0.3), nMid = n - nEasy - nHard;
      let picks = [
        ...pickBalanced(pool.filter(q => q.difficulty === 1), nEasy, { prefer: seen }),
        ...pickBalanced(pool.filter(q => q.difficulty === 2), nMid, { prefer: seen }),
        ...pickBalanced(pool.filter(q => q.difficulty === 3), nHard, { prefer: seen }),
      ];
      if (picks.length < n) {
        const rest = pool.filter(q => !picks.includes(q));
        picks = picks.concat(pickBalanced(rest, n - picks.length));
      }
      return picks.sort((a, b) => a.difficulty - b.difficulty);
    }
    case 'remedial': {
      const pool = qs.filter(q => (!weakSubtopic || q.subtopic_id === weakSubtopic) && q.difficulty === 1 && (q.qtype === 'number' || q.qtype === 'remainder') && !q.vertical && q.context !== 'concept');
      return pickBalanced(pool, 3, { bySub: false, prefer: seen });
    }
    case 'bonus': return pickBalanced(qs.filter(q => q.enrichment), 1, { bySub: false, prefer: seen });
    default: return [];
  }
}

/** 找一道同类但更简单的题（补救用） */
export async function easierQuestion(q, excludeIds) {
  const qs = await unitQuestions(q.unit_id);
  const cands = qs.filter(x => x.subtopic_id === q.subtopic_id && !excludeIds.has(x.id) && x.difficulty <= Math.max(1, q.difficulty - 1)
    && (x.qtype === 'number' || x.qtype === 'remainder') && !x.vertical && x.context !== 'concept' && !x.enrichment);
  const sameOps = cands.filter(x => x.expr && q.expr && x.expr.ops.join() === q.expr.ops.join());
  const pool = sameOps.length ? sameOps : cands;
  return pool.length ? pool[crypto.randomInt(0, pool.length)] : null;
}
