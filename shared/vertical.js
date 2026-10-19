// 竖式布局引擎：按课本格式生成加法、减法、乘法、长除法的竖式，
// 每个格子标记“第几步出现”，教师模式和学生模式都可以逐步展示。
import { fmt, trailingZeros } from './math.js';

export const PLACE = ['个位', '十位', '百位', '千位', '万位', '十万位', '百万位'];

const digitsOf = (n) => String(n).split('').map(Number);

function emptyRow(cols) {
  return { cells: new Array(cols).fill(null) };
}

/** 加法竖式 a + b */
export function layoutAdd(a, b) {
  const sum = a + b;
  const W = Math.max(String(a).length, String(b).length, String(sum).length);
  const cols = W + 1;
  const col = (p) => cols - 1 - p;
  const rows = [emptyRow(cols), emptyRow(cols), emptyRow(cols), emptyRow(cols)];
  const da = digitsOf(a).reverse(), db = digitsOf(b).reverse(), ds = digitsOf(sum).reverse();
  da.forEach((d, p) => { rows[1].cells[col(p)] = { t: String(d), s: 0, c: 'num' }; });
  db.forEach((d, p) => { rows[2].cells[col(p)] = { t: String(d), s: 0, c: 'num' }; });
  rows[2].cells[0] = { t: '+', s: 0, c: 'op' };
  rows[3].line = { from: 0, to: cols - 1, s: 1 };
  const steps = [{ text: `把 ${fmt(a)} 和 ${fmt(b)} 的数位对齐，从个位加起。` }];
  let carry = 0;
  for (let p = 0; p < ds.length; p++) {
    const x = da[p] ?? 0, y = db[p] ?? 0;
    const s = steps.length;
    const total = x + y + carry;
    const write = total % 10;
    const out = Math.floor(total / 10);
    rows[3].cells[col(p)] = { t: String(write), s, c: 'num result' };
    let text;
    if (p >= da.length && p >= db.length) {
      text = `${PLACE[p]}：把进位的 ${carry} 写下来。`;
    } else {
      const parts = [];
      if (p < da.length) parts.push(String(x));
      if (p < db.length) parts.push(String(y));
      let expr = parts.join(' + ');
      if (carry) expr += ` + ${carry}（进位）`;
      text = `${PLACE[p]}：${expr} = ${total}，写 ${write}`;
      if (out) {
        text += `，向${PLACE[p + 1]}进 ${out}。`;
        rows[0].cells[col(p + 1)] = { t: String(out), s, c: 'carry' };
      } else text += '。';
    }
    steps.push({ text });
    carry = out;
  }
  steps.push({ text: `所以 ${fmt(a)} + ${fmt(b)} = ${fmt(sum)}。`, final: true });
  return { kind: 'add', cols, rows, steps, result: sum };
}

/** 减法竖式 a − b（包括连续退位） */
export function layoutSub(a, b) {
  const diff = a - b;
  const W = Math.max(String(a).length, String(b).length);
  const cols = W + 1;
  const col = (p) => cols - 1 - p;
  const rows = [emptyRow(cols), emptyRow(cols), emptyRow(cols), emptyRow(cols)];
  const da = digitsOf(a).reverse(), db = digitsOf(b).reverse();
  const cur = da.slice();
  da.forEach((d, p) => { rows[1].cells[col(p)] = { t: String(d), s: 0, c: 'num' }; });
  db.forEach((d, p) => { rows[2].cells[col(p)] = { t: String(d), s: 0, c: 'num' }; });
  rows[2].cells[0] = { t: '−', s: 0, c: 'op' };
  rows[3].line = { from: 0, to: cols - 1, s: 1 };
  const marks = {}; // p -> [{s,t}]
  const setMark = (p, t, s) => {
    (marks[p] ||= []).push({ s, t: String(t) });
    const cell = rows[1].cells[col(p)];
    if (cell && cell.x === undefined) cell.x = s; // 划去原数字
  };
  const steps = [{ text: `把 ${fmt(a)} 和 ${fmt(b)} 的数位对齐，从个位减起。` }];
  const diffLen = String(diff).length;
  for (let p = 0; p < da.length; p++) {
    const s = steps.length;
    const y = db[p] ?? 0;
    let text = '';
    if (cur[p] < y) {
      // 需要退位：找到左边第一个不是 0 的数位
      let k = p + 1;
      while (k < da.length && cur[k] === 0) k++;
      const before = cur[k];
      cur[k] -= 1;
      setMark(k, cur[k], s);
      const nines = [];
      for (let m = k - 1; m > p; m--) { cur[m] = 9; setMark(m, 9, s); nines.push(PLACE[m]); }
      const old = cur[p];
      cur[p] += 10;
      (marks[p] ||= []).push({ s, t: String(cur[p]) });
      if (nines.length === 0) {
        text = `${PLACE[p]}：${old} 不够减 ${y}，向${PLACE[k]}借 1，${PLACE[k]}的 ${before} 变成 ${cur[k]}；`;
      } else {
        text = `${PLACE[p]}：${old} 不够减 ${y}，${nines.join('、')}都是 0，要向${PLACE[k]}借 1：${PLACE[k]}的 ${before} 变成 ${cur[k]}，${nines.join('、')}的 0 都变成 9；`;
      }
      text += `${cur[p]} − ${y} = ${cur[p] - y}`;
    } else {
      text = `${PLACE[p]}：${cur[p]} − ${y} = ${cur[p] - y}`;
    }
    const r = cur[p] - y;
    if (p < diffLen) {
      rows[3].cells[col(p)] = { t: String(r), s, c: 'num result' };
      text += `，写 ${r}。`;
    } else {
      text += `，最高位是 0，不用写。`;
    }
    steps.push({ text });
  }
  for (const p of Object.keys(marks)) {
    rows[0].cells[col(Number(p))] = { tv: marks[p], s: marks[p][0].s, c: 'borrow' };
  }
  steps.push({ text: `所以 ${fmt(a)} − ${fmt(b)} = ${fmt(diff)}。`, final: true });
  return { kind: 'sub', cols, rows, steps, result: diff };
}

/** 乘法竖式 a × b（一位数、两位数、末尾有 0 的乘数） */
export function layoutMul(a, b) {
  const prod = a * b;
  const k = trailingZeros(b);
  const bCore = b / 10 ** k;
  const W = Math.max(String(a).length, String(b).length, String(prod).length);
  const cols = W + 1;
  const col = (p) => cols - 1 - p;
  const steps = [];
  const da = digitsOf(a).reverse();

  if (bCore < 10) {
    // 乘数是一位数（或一位数后面跟 0）
    const rows = [emptyRow(cols), emptyRow(cols), emptyRow(cols), emptyRow(cols)];
    da.forEach((d, p) => { rows[1].cells[col(p)] = { t: String(d), s: 0, c: 'num' }; });
    digitsOf(b).reverse().forEach((d, p) => {
      rows[2].cells[col(p)] = { t: String(d), s: 0, c: p < k ? 'num zero' : 'num' };
    });
    rows[2].cells[0] = { t: '×', s: 0, c: 'op' };
    rows[3].line = { from: 0, to: cols - 1, s: 1 };
    if (k > 0) steps.push({ text: `乘数 ${fmt(b)} 末尾有 ${k} 个 0。先算 ${fmt(a)} × ${bCore}，再在积的末尾添上 ${k} 个 0。` });
    else steps.push({ text: `用 ${bCore} 去乘 ${fmt(a)} 的每一位，从个位乘起。` });
    const core = a * bCore;
    const dc = digitsOf(core).reverse();
    let carry = 0;
    if (a >= 10) {
      for (let p = 0; p < dc.length; p++) {
        const s = steps.length;
        if (p >= da.length) {
          rows[3].cells[col(p + k)] = { t: String(dc[p]), s, c: 'num result' };
          steps.push({ text: `把最后的进位 ${carry} 写在${PLACE[p + k]}。` });
          continue;
        }
        const t = da[p] * bCore + carry;
        let text = `${bCore} × ${da[p]} = ${da[p] * bCore}`;
        if (carry) text += `，加上进位 ${carry}，得 ${t}`;
        const w = t % 10, out = Math.floor(t / 10);
        text += `，写 ${w}`;
        rows[3].cells[col(p + k)] = { t: String(w), s, c: 'num result' };
        if (out && (p + 1 < da.length)) {
          rows[0].cells[col(p + 1 + k)] = { t: String(out), s, c: 'carry' };
          text += `，向前一位进 ${out}。`;
        } else if (out) {
          text += `，进位 ${out}。`;
        } else text += '。';
        steps.push({ text });
        carry = out;
      }
    } else {
      const s = steps.length;
      dc.forEach((d, p) => { rows[3].cells[col(p + k)] = { t: String(d), s, c: 'num result' }; });
      steps.push({ text: `${fmt(a)} × ${bCore} = ${fmt(core)}。` });
    }
    if (k > 0) {
      const s = steps.length;
      for (let z = 0; z < k; z++) rows[3].cells[col(z)] = { t: '0', s, c: 'num result zero' };
      steps.push({ text: `${fmt(a)} × ${bCore} = ${fmt(core)}，在积的末尾添上 ${k} 个 0，得 ${fmt(prod)}。` });
    }
    steps.push({ text: `所以 ${fmt(a)} × ${fmt(b)} = ${fmt(prod)}。`, final: true });
    return { kind: 'mul', cols, rows, steps, result: prod };
  }

  // 两位数乘数（可带末尾 0）：部分积
  const [u, t] = [bCore % 10, Math.floor(bCore / 10)];
  const p1 = a * u, p2 = a * t * 10, core = a * bCore;
  const rows = [emptyRow(cols), emptyRow(cols), emptyRow(cols), emptyRow(cols), emptyRow(cols), emptyRow(cols)];
  da.forEach((d, p) => { rows[1].cells[col(p)] = { t: String(d), s: 0, c: 'num' }; });
  digitsOf(b).reverse().forEach((d, p) => { rows[2].cells[col(p)] = { t: String(d), s: 0, c: p < k ? 'num zero' : 'num' }; });
  rows[2].cells[0] = { t: '×', s: 0, c: 'op' };
  steps.push({ text: k > 0
    ? `乘数 ${fmt(b)} 末尾有 ${k} 个 0。先算 ${fmt(a)} × ${bCore}，最后在积的末尾添上 ${k} 个 0。`
    : `${fmt(b)} 是两位数：先用个位 ${u} 去乘，再用十位上的 ${t}（表示 ${t * 10}）去乘，最后把两个积相加。` });
  // 第一部分积与进位
  let s = steps.length;
  let carry = 0;
  const carries = [];
  da.forEach((d, p) => {
    const v = d * u + carry;
    carry = Math.floor(v / 10);
    if (carry && p + 1 < da.length) rows[0].cells[col(p + 1 + k)] = { t: String(carry), s, c: 'carry' };
    if (carry) carries.push(carry);
  });
  digitsOf(p1).reverse().forEach((d, p) => { rows[3].cells[col(p + k)] = { t: String(d), s, c: 'num result' }; });
  rows[3].line = { from: 0, to: cols - 1, s };
  steps.push({ text: `${fmt(a)} × ${u} = ${fmt(p1)}（进位的数字写在上方）。` });
  s = steps.length;
  const p2digits = digitsOf(p2).reverse();
  p2digits.forEach((d, p) => { rows[4].cells[col(p + k)] = { t: String(d), s, c: p === 0 ? 'num result zero' : 'num result' }; });
  rows[4].cells[0] = { t: '+', s, c: 'op' };
  steps.push({ text: `${fmt(a)} × ${t * 10} = ${fmt(p2)}（个位写 0，其余数字向左移一位）。` });
  s = steps.length;
  digitsOf(core).reverse().forEach((d, p) => { rows[5].cells[col(p + k)] = { t: String(d), s, c: 'num result' }; });
  rows[5].line = { from: 0, to: cols - 1, s };
  steps.push({ text: `${fmt(p1)} + ${fmt(p2)} = ${fmt(core)}。` });
  if (k > 0) {
    s = steps.length;
    for (let z = 0; z < k; z++) rows[5].cells[col(z)] = { t: '0', s, c: 'num result zero' };
    steps.push({ text: `在积的末尾添上 ${k} 个 0，得 ${fmt(prod)}。` });
  }
  steps.push({ text: `所以 ${fmt(a)} × ${fmt(b)} = ${fmt(prod)}。`, final: true });
  return { kind: 'mul', cols, rows, steps, result: prod, partials: [p1, p2] };
}

/** 长除法 D ÷ d（课本格式，商中间的 0 也要写出来） */
export function layoutDiv(D, d) {
  const dd = digitsOf(D);
  const n = dd.length;
  const dlen = String(d).length;
  const off = dlen + 1; // 除数 + “）”
  const cols = off + n;
  const colOf = (i) => off + i; // 被除数第 i 位（从左数）
  const rows = [emptyRow(cols), emptyRow(cols)];
  digitsOf(d).forEach((x, i) => { rows[1].cells[i] = { t: String(x), s: 0, c: 'num divisor' }; });
  rows[1].cells[dlen] = { t: ')', s: 0, c: 'bracket' };
  dd.forEach((x, i) => { rows[1].cells[colOf(i)] = { t: String(x), s: 0, c: 'num' }; });
  rows[1].line = { from: dlen, to: cols - 1, s: 0 };
  const steps = [{ text: `用长除法计算 ${fmt(D)} ÷ ${fmt(d)}，从被除数的最高位除起。` }];
  let partial = 0, started = false;
  const q = Math.floor(D / d), r = D % d;
  let firstPartialDigits = 0;
  for (let i = 0; i < n; i++) {
    partial = partial * 10 + dd[i];
    if (!started && partial < d && i < n - 1) continue;
    const s = steps.length;
    const qd = Math.floor(partial / d);
    const prod = qd * d;
    const rem = partial - prod;
    const place = PLACE[n - 1 - i];
    rows[0].cells[colOf(i)] = { t: String(qd), s, c: qd === 0 ? 'num result quotient zero' : 'num result quotient' };
    // 乘积行
    const prow = emptyRow(cols);
    digitsOf(prod).reverse().forEach((x, p) => { prow.cells[colOf(i) - p] = { t: String(x), s, c: 'num' }; });
    const pLeft = colOf(i) - (String(prod).length - 1);
    prow.cells[pLeft - 1] = { t: '−', s, c: 'op' };
    rows.push(prow);
    // 余数行（加上移下来的数字）
    const rrow = emptyRow(cols);
    digitsOf(rem).reverse().forEach((x, p) => { rrow.cells[colOf(i) - p] = { t: String(x), s, c: 'num' }; });
    const last = i === n - 1;
    if (!last) rrow.cells[colOf(i + 1)] = { t: String(dd[i + 1]), s, c: 'num brought' };
    const lineFrom = Math.min(pLeft - 1, colOf(i) - String(Math.max(partial, 1)).length + 1);
    rrow.line = { from: lineFrom, to: colOf(i), s };
    rows.push(rrow);
    let text;
    if (!started) {
      firstPartialDigits = String(partial).length;
      text = firstPartialDigits > 1 && String(partial).length > String(dd[0]).length && dd[0] < d
        ? `${dd[0]} 不够除以 ${fmt(d)}，看前 ${firstPartialDigits} 位：${partial} ÷ ${fmt(d)}，商 ${qd}，写在${place}上；`
        : `${partial} ÷ ${fmt(d)}，商 ${qd}，写在${place}上；`;
    } else if (qd === 0) {
      text = `${partial} 不够除以 ${fmt(d)}，商 0，写在${place}上（这个 0 不能漏写！）；`;
    } else {
      text = `${partial} ÷ ${fmt(d)}，商 ${qd}，写在${place}上；`;
    }
    text += `${qd} × ${fmt(d)} = ${prod}，${partial} − ${prod} = ${rem}`;
    text += last ? '。' : `，把下一位 ${dd[i + 1]} 移下来，得 ${rem * 10 + dd[i + 1]}。`;
    steps.push({ text });
    started = true;
    partial = rem;
  }
  if (r > 0) {
    const lastRow = rows[rows.length - 1];
    lastRow.suffix = { t: '（余）', s: steps.length - 1 };
    steps.push({ text: `${r} 比除数 ${fmt(d)} 小，不能再除，所以余数是 ${r}。` });
  }
  steps.push({ text: r ? `所以 ${fmt(D)} ÷ ${fmt(d)} = ${fmt(q)} 余 ${r}。` : `所以 ${fmt(D)} ÷ ${fmt(d)} = ${fmt(q)}。`, final: true });
  return { kind: 'div', cols, rows, steps, result: q, remainder: r };
}

export function layoutFor(a, op, b) {
  if (op === '+') return layoutAdd(a, b);
  if (op === '-') return layoutSub(a, b);
  if (op === '*') return layoutMul(a, b);
  if (op === '/') return layoutDiv(a, b);
  throw new Error('未知运算');
}

/** 把一个格子按步骤取出当前应显示的文字 */
export function cellText(cell, step) {
  if (!cell) return null;
  if (cell.tv) {
    const vis = cell.tv.filter(v => v.s <= step);
    return vis.length ? vis[vis.length - 1].t : null;
  }
  return cell.s <= step ? cell.t : null;
}
