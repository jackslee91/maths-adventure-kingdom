import { layoutFor, cellText } from '../shared/vertical.js';
let [a, op, b] = process.argv.slice(2); if (op==='x') op='*';
const L = layoutFor(Number(a), op, Number(b));
const last = L.steps.length;
for (const row of L.rows) {
  if (row.line) console.log(' '.repeat(row.line.from*3) + '-'.repeat((row.line.to-row.line.from+1)*3));
  console.log(row.cells.map(c => { const t = cellText(c, last); return t===null?'   ':(c.x!==undefined?'/'+t:t).padStart(3);}).join('') + (row.suffix?row.suffix.t:''));
}
L.steps.forEach((s,i)=>console.log(i, s.text));
