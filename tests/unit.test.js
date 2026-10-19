// 单元测试：数学引擎、批改、竖式、PDF、ZIP（不需要数据库）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';
import { evaluate, parseIntAnswer, parseRemainderAnswer, fmt } from '../shared/math.js';
import { markAnswer, diagnoseFinal } from '../shared/marking.js';
import { layoutFor } from '../shared/vertical.js';
import { verifyQuestion } from '../server/verify.js';
import { makeZip, makeXlsx, makeCsv } from '../server/zip.js';
import { PDFDoc } from '../server/pdf/pdfdoc.js';
import { parseExpression, buildFromExpression } from '../content/builders.js';

test('课本答案', () => {
  assert.equal(evaluate({ nums: [3801, 8632, 1472], ops: ['+', '-'] }).final, 10961);
  const e4 = evaluate({ nums: [3245, 19, 30], ops: ['*', '/'] });
  assert.deepEqual([e4.final, e4.remainder], [2055, 5]);
  assert.equal(evaluate({ nums: [30000, 50, 20], ops: ['/', '*'] }).final, 12000);
  assert.equal(evaluate({ nums: [100000, 57057, 5757], ops: ['-', '+'] }).final, 48700);
});

test('数字输入的等值写法', () => {
  for (const s of ['10961', '10 961', '10,961', '１０９６１', '10961张', 'RM10 961']) assert.equal(parseIntAnswer(s), 10961, s);
  assert.equal(parseIntAnswer('十'), null);
  assert.deepEqual(parseRemainderAnswer('2 055 余 5'), { q: 2055, r: 5 });
  assert.equal(fmt(100000), '100 000');
});

test('批改：部分分与错误识别', () => {
  const q = { qtype: 'steps', expr: { nums: [3801, 8632, 1472], ops: ['+', '-'] }, answer: { steps: [12433], final: 10961, remainder: 0 } };
  assert.equal(markAnswer(q, { steps: ['12433'], final: '10961' }).marks, 2);
  assert.equal(markAnswer(q, { steps: ['12433'], final: '10000' }).marks, 1);
  const ft = markAnswer(q, { steps: ['12443'], final: '10971' });
  assert.equal(ft.marks, 1); assert.ok(ft.detail.followThrough);
  assert.equal(markAnswer(q, { steps: ['8632'], final: '1' }).marks, 0);
  const r = { qtype: 'remainder', expr: { nums: [3245, 19, 30], ops: ['*', '/'] }, answer: { q: 2055, r: 5 } };
  assert.equal(markAnswer(r, { q: '2055', r: '' }).marks, 1);
  assert.equal(markAnswer(r, { q: '2055', r: '' }).misconception, 'REMAINDER_MISSING');
  assert.equal(markAnswer(r, { q: '255', r: '5' }).misconception, 'QUOTIENT_ZERO');
  assert.equal(markAnswer(r, { q: '2054', r: '35' }).misconception, 'REMAINDER_TOO_BIG');
  assert.equal(diagnoseFinal({ nums: [100000, 57057, 5757], ops: ['-', '+'] }, 37186), 'ORDER_RTL');
  const mcq = { qtype: 'mcq', choices: [{ text: 'a', value: 'c' }, { text: 'b', value: 'd0', mc: 'ORDER_RTL' }], answer: { value: 'c' } };
  assert.equal(markAnswer(mcq, { choice: 'd0' }).misconception, 'ORDER_RTL');
});

test('竖式与长除法（课本格式）', () => {
  const d = layoutFor(61655, '/', 30);
  assert.equal(d.result, 2055); assert.equal(d.remainder, 5);
  assert.ok(d.steps.some(s => s.text.includes('商 0')), '商中间的 0 要有讲解');
  const s = layoutFor(12433, '-', 1472);
  const marks = s.rows[0].cells.filter(Boolean).map(c => c.tv.at(-1).t);
  assert.deepEqual(marks, ['1', '13', '13']);
  for (let i = 0; i < 500; i++) {
    const a = 1000 + Math.floor(Math.random() * 90000), b = 2 + Math.floor(Math.random() * 97);
    assert.equal(layoutFor(a, '/', b).result, Math.floor(a / b));
    assert.equal(layoutFor(a, '-', b).result, a - b);
  }
});

test('题库全部通过验证', () => {
  const bank = JSON.parse(readFileSync(new URL('../content/questions.json', import.meta.url)));
  for (const q of bank.questions) assert.deepEqual(verifyQuestion(q), [], q.id);
  const per = {};
  for (const q of bank.questions) per[q.subtopic_id] = (per[q.subtopic_id] || 0) + 1;
  for (const v of Object.values(per)) assert.ok(v >= 30);
});

test('错误的题目会被拒绝', () => {
  const bad = { id: 'X', subtopic_id: 's', difficulty: 1, qtype: 'number', text: 't', expr: { nums: [1, 2, 3], ops: ['+', '+'] }, answer: { value: 7 }, worked_solution: ['x'], explanation: 'e', hint: 'h', misconception: 'm' };
  assert.ok(verifyQuestion(bad).length > 0);
});

test('老师输入算式自动建题', () => {
  const e = parseExpression('3 801 + 8 632 − 1 472');
  const q = buildFromExpression({ expr: e, qtype: 'steps' });
  assert.deepEqual(q.answer, { steps: [12433], final: 10961, remainder: 0 });
  assert.deepEqual(verifyQuestion({ ...q, id: 'T', subtopic_id: 's' }), []);
});

test('ZIP、Excel、CSV', () => {
  const z = makeZip([{ name: '中文/报告.txt', data: '你好' }]);
  assert.equal(z.readUInt32LE(0), 0x04034b50);
  const nameLen = z.readUInt16LE(26), compLen = z.readUInt32LE(18);
  assert.equal(z.subarray(30, 30 + nameLen).toString('utf8'), '中文/报告.txt');
  assert.equal(zlib.inflateRawSync(z.subarray(30 + nameLen, 30 + nameLen + compLen)).toString(), '你好');
  assert.ok(makeXlsx([{ name: '成绩', columns: [{ title: '姓名' }], rows: [['张小明']] }]).length > 500);
  assert.ok(makeCsv([{ title: '姓名' }], [['张,小明']]).toString().includes('"张,小明"'));
});

test('中文 PDF', () => {
  const doc = new PDFDoc({ fonts: { regular: new URL('../server/fonts/NotoSansSC-Regular.ttf', import.meta.url).pathname, bold: new URL('../server/fonts/NotoSansSC-Bold.ttf', import.meta.url).pathname } });
  doc.paragraph('四年级数学个人学习表现报告 鍾');
  doc.table([{ key: 'a', title: '知识点' }], Array.from({ length: 80 }, (_, i) => ({ a: '加减混合运算 ' + i })));
  const pdf = doc.finish({ footer: (i, n) => `第 ${i} 页，共 ${n} 页` });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(doc.pages.length >= 2, '长表格应该自动分页');
});

test('美术素材清单完整', async () => {
  const { ASSETS, FOLDERS, MAP_LAYOUT } = await import('../public/js/assets/manifest.js');
  const files = new Set();
  for (const [k, a] of Object.entries(ASSETS)) {
    assert.ok(FOLDERS[a.folder], `${k} 的文件夹不正确`);
    assert.ok(/^[a-z0-9-]+$/.test(a.name), `${k} 的文件名只能用小写英文、数字和 -`);
    const f = `${a.folder}/${a.name}`;
    assert.ok(!files.has(f), `${f} 重复`); files.add(f);
    assert.ok(a.label && a.use && a.ext?.length, `${k} 缺少说明`);
    const DRAW = new Set(['scene.home', 'scene.maze', 'scene.boss', 'scene.victory', 'css', 'none', 'synth', 'map.svg', 'emoji.hit', 'badge', 'medal', 'key', 'teacher',
      'kid.boy.stand', 'kid.girl.stand', 'kid.boy.head', 'mascot.happy', 'mascot.wow', 'mascot.sad', 'boss.idle', 'boss.hurt', 'chest.closed', 'chest.open', 'door.closed', 'door.open']);
    assert.ok(ASSETS[a.fallback] || DRAW.has(a.fallback), `${k} 的备用图案 ${a.fallback} 不存在`);
  }
  assert.equal(MAP_LAYOUT.islands.length, 6);
});
