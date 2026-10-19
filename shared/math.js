// 共享数学工具：浏览器与服务器共用（ES Module）
// 所有用户可见文字为简体中文。

export const OP_SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' };
export const OP_NAME = { '+': '加', '-': '减', '*': '乘', '/': '除以' };

/** 按课本格式写数字：千位分隔用空格，例如 10 961 */
export function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  const neg = n < 0;
  const s = String(Math.abs(Math.trunc(n)));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
    out += s[i];
  }
  return (neg ? '−' : '') + out;
}

const FULLWIDTH = '０１２３４５６７８９';

/** 把输入统一成半角，去掉空格、逗号与常见单位 */
export function normalizeInput(raw) {
  if (raw === null || raw === undefined) return '';
  let s = String(raw).trim();
  s = s.replace(/[０-９]/g, (c) => String(FULLWIDTH.indexOf(c)));
  s = s.replace(/[，,\s 　']/g, '');
  s = s.replace(/^(RM|rm|Rm|令吉)/, '');
  return s;
}

/** 解析整数答案；允许单位文字，例如 “10 961 张”“RM 2 300” */
export function parseIntAnswer(raw) {
  let s = normalizeInput(raw);
  if (!s) return null;
  // 去掉尾部中文单位或英文单位（例如 张、个、本、令吉、kg）
  s = s.replace(/(令吉|[一-龥]+|[a-zA-Z]+)$/u, '');
  if (!/^-?\d+$/.test(s)) return null;
  const v = Number(s);
  return Number.isSafeInteger(v) ? v : null;
}

/** 解析“商 余 余数”，例如 “2055余5”“2 055 余 5” */
export function parseRemainderAnswer(raw) {
  const s = normalizeInput(raw);
  const m = s.match(/^(\d+)(?:[一-龥]*)?(?:余|r|R|\.\.\.|…|……)(\d+)(?:[一-龥]*)?$/u);
  if (m) return { q: Number(m[1]), r: Number(m[2]) };
  const only = parseIntAnswer(s);
  if (only !== null) return { q: only, r: 0, noRemainderWritten: true };
  return null;
}

/** 单步计算。除法返回 {q, r} */
export function applyOp(a, op, b) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? NaN : Math.floor(a / b);
    default: throw new Error('未知运算');
  }
}

/**
 * 从左到右计算三数混合运算 expr = {nums:[a,b,c], ops:[op1, op2]}
 * 返回 {steps:[{a,op,b,result,remainder}], final, remainder}
 * 只有最后一步除法允许有余数；中间除法必须整除，否则 valid=false。
 */
export function evaluate(expr) {
  const { nums, ops } = expr;
  let acc = nums[0];
  const steps = [];
  let valid = true;
  let remainder = 0;
  for (let i = 0; i < ops.length; i++) {
    const a = acc, b = nums[i + 1], op = ops[i];
    let result = applyOp(a, op, b);
    let r = 0;
    if (op === '/') {
      r = a % b;
      if (r !== 0 && i !== ops.length - 1) valid = false;
    }
    if (op === '-' && result < 0) valid = false;
    steps.push({ a, op, b, result, remainder: r });
    acc = result;
    remainder = r;
  }
  return { steps, final: acc, remainder, valid };
}

/** 把算式写成课本格式，例如 3 801 + 8 632 − 1 472 */
export function exprText(expr) {
  let s = fmt(expr.nums[0]);
  expr.ops.forEach((op, i) => { s += ` ${OP_SYMBOL[op]} ${fmt(expr.nums[i + 1])}`; });
  return s;
}

export function stepText(step) {
  const base = `${fmt(step.a)} ${OP_SYMBOL[step.op]} ${fmt(step.b)} = ${fmt(step.result)}`;
  return step.remainder ? `${base} 余 ${fmt(step.remainder)}` : base;
}

export function answerText(final, remainder) {
  return remainder ? `${fmt(final)} 余 ${fmt(remainder)}` : fmt(final);
}

export function trailingZeros(n) {
  let z = 0;
  if (n === 0) return 0;
  while (n % 10 === 0) { n /= 10; z++; }
  return z;
}

/** 可重复的随机数（题库生成用） */
export function seededRandom(seed) {
  let s = seed >>> 0;
  return function rand() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
