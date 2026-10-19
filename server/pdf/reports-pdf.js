// A4 中文 PDF 报告：个人报告、全班报告、批量合并
import { join } from 'node:path';
import { PDFDoc } from './pdfdoc.js';
import { config } from '../config.js';

const FONTS = { regular: join(config.root, 'server/fonts/NotoSansSC-Regular.ttf'), bold: join(config.root, 'server/fonts/NotoSansSC-Bold.ttf') };
const C = { primary: '#1d4ed8', dark: '#1f2937', muted: '#6b7280', line: '#cbd5e1', soft: '#eef2ff', good: '#15803d', warn: '#b45309', bad: '#b91c1c' };

function newDoc(title, orientation = 'portrait') {
  const doc = new PDFDoc({ fonts: FONTS, title, orientation, margins: { top: 48, bottom: 54, left: 48, right: 48 } });
  doc.sections = [];
  return doc;
}

function section(doc, title) {
  doc.ensureSpace(100);
  doc.y += 6;
  doc.rect(doc.margins.left, doc.y, 4, 16, { fill: C.primary });
  doc.textAt(title, doc.margins.left + 10, doc.y + 1, { size: 12.5, bold: true, color: C.primary });
  doc.y += 24;
}

function bullets(doc, items, color = C.dark) {
  for (const it of items) {
    const lines = doc.wrap(it, doc.contentWidth - 16, 10.2);
    doc.ensureSpace(lines.length * 14.5);
    doc.circle(doc.margins.left + 5, doc.y + 6, 1.8, { fill: C.primary });
    lines.forEach((ln, i) => doc.textAt(ln, doc.margins.left + 14, doc.y + i * 14.5, { size: 10.2, color }));
    doc.y += lines.length * 14.5 + 3;
  }
  doc.y += 3;
}

function statGrid(doc, items, perRow = 4) {
  const gap = 8;
  const w = (doc.contentWidth - gap * (perRow - 1)) / perRow;
  const h = 46;
  for (let i = 0; i < items.length; i += perRow) {
    doc.ensureSpace(h + gap);
    items.slice(i, i + perRow).forEach((it, k) => {
      const x = doc.margins.left + k * (w + gap);
      doc.rect(x, doc.y, w, h, { fill: '#f8fafc', stroke: C.line, radius: 5 });
      doc.textAt(it.label, x + 8, doc.y + 7, { size: 8.8, color: C.muted });
      doc.textAt(String(it.value ?? '—'), x + 8, doc.y + 21, { size: 13.5, bold: true, color: it.color || C.dark, width: w - 16 });
    });
    doc.y += h + gap;
  }
  doc.y += 2;
}

function kvTable(doc, pairs, cols = 2) {
  const rows = [];
  for (let i = 0; i < pairs.length; i += cols) {
    const r = {};
    pairs.slice(i, i + cols).forEach(([k, v], j) => { r['k' + j] = k; r['v' + j] = v ?? ''; });
    rows.push(r);
  }
  const columns = [];
  for (let j = 0; j < cols; j++) columns.push({ key: 'k' + j, title: '项目', width: 1 }, { key: 'v' + j, title: '内容', width: 1.8 });
  // 不要表头：直接画行
  const size = 10;
  const widths = columns.map(c => c.width);
  const sum = widths.reduce((a, b) => a + b, 0);
  const W = widths.map(w => w / sum * doc.contentWidth);
  for (const r of rows) {
    const cells = columns.map((c, i) => doc.wrap(r[c.key] ?? '', W[i] - 10, size, c.key.startsWith('k')));
    const h = Math.max(22, Math.max(...cells.map(l => l.length)) * 14 + 8);
    doc.ensureSpace(h);
    let x = doc.margins.left;
    columns.forEach((c, i) => {
      doc.rect(x, doc.y, W[i], h, { fill: c.key.startsWith('k') ? '#eef2ff' : '#ffffff', stroke: C.line });
      cells[i].forEach((ln, k) => doc.textAt(ln, x + 5, doc.y + 5 + k * 14, { size, bold: c.key.startsWith('k'), color: c.key.startsWith('k') ? '#1e3a8a' : C.dark }));
      x += W[i];
    });
    doc.y += h;
  }
  doc.y += 10;
}

function writeBox(doc, title, text, lines = 4) {
  const h = Math.max(lines * 22, (text ? doc.wrap(text, doc.contentWidth - 16, 10.2).length * 15 : 0) + 26);
  doc.ensureSpace(h + 6);
  doc.rect(doc.margins.left, doc.y, doc.contentWidth, h, { stroke: C.line, radius: 4 });
  if (title) doc.textAt(title, doc.margins.left + 8, doc.y + 6, { size: 9.5, color: C.muted });
  if (text) {
    doc.wrap(text, doc.contentWidth - 16, 10.2).forEach((ln, i) => doc.textAt(ln, doc.margins.left + 8, doc.y + 22 + i * 15, { size: 10.2 }));
  } else {
    for (let i = 1; i < lines; i++) doc.line(doc.margins.left + 8, doc.y + 8 + i * 22, doc.margins.left + doc.contentWidth - 8, doc.y + 8 + i * 22, { color: '#d1d5db', dash: [2, 2] });
  }
  doc.y += h + 8;
}

function signRow(doc, labels) {
  doc.ensureSpace(60);
  const w = doc.contentWidth / labels.length;
  labels.forEach((l, i) => {
    const x = doc.margins.left + i * w;
    doc.textAt(l, x, doc.y, { size: 10, color: C.dark });
    doc.line(x, doc.y + 38, x + w - 18, doc.y + 38, { color: '#9ca3af' });
  });
  doc.y += 50;
}

function titleBlock(doc, title, sub) {
  doc.rect(doc.margins.left, doc.y, doc.contentWidth, 52, { fill: '#eff6ff', radius: 6 });
  doc.textAt(title, doc.margins.left, doc.y + 9, { size: 17, bold: true, color: '#1e3a8a', align: 'center', width: doc.contentWidth });
  if (sub) doc.textAt(sub, doc.margins.left, doc.y + 33, { size: 9.5, color: C.muted, align: 'center', width: doc.contentWidth });
  doc.y += 64;
}

// ---------------------------------------------------------------- 个人报告
export function drawIndividual(doc, r) {
  doc.sections.push({ start: doc.pages.length - 1, label: `${r.student.name} 的学习报告` });
  titleBlock(doc, r.title, [r.school, r.isDemo ? '（示范数据）' : ''].filter(Boolean).join(' '));
  section(doc, '一、学生基本资料');
  kvTable(doc, [['学生姓名', r.student.name], ['班级', r.student.className], ['学习日期', r.date], ['评估主题', r.topic], ['学号', r.student.pupilNo || '—'], ['评估次数', `第 ${r.attemptNo} 次`]]);

  section(doc, '二、整体学习表现');
  const pc = r.overall.percentage;
  statGrid(doc, [
    { label: '题目总数', value: r.overall.total }, { label: '答对题数', value: r.overall.correct },
    { label: '总分', value: r.overall.maxScore }, { label: '得分', value: r.overall.score },
    { label: '正确率（得分率）', value: `${pc}%`, color: pc >= 70 ? C.good : pc >= 50 ? C.warn : C.bad },
    { label: '完成关卡', value: r.overall.stagesText }, { label: '评估用时', value: r.overall.duration },
    { label: '掌握程度', value: r.overall.mastery, color: C.primary },
  ]);
  doc.paragraph(`练习时间：${r.overall.practiceTime}；练习中使用提示 ${r.overall.hintsUsed} 次、重答 ${r.overall.retries} 次（练习记录不计入评估分数）。`, { size: 9.5, color: C.muted });

  section(doc, '三、各知识点表现');
  doc.table([
    { key: 'title', title: '知识点', width: 3 }, { key: 'count', title: '题数', width: 1, align: 'center' },
    { key: 'correct', title: '答对', width: 1, align: 'center' }, { key: 'acc', title: '得分率', width: 1.2, align: 'center' },
    { key: 'label', title: '掌握情况', width: 1.4, align: 'center' },
  ], r.topics.map(t => ({ title: t.title, count: String(t.count), correct: String(t.correct), acc: `${t.accuracy}%`, label: t.label,
    _colors: { label: t.label === '掌握良好' ? C.good : t.label === '需要加强' ? C.bad : C.warn } })));

  section(doc, '四、学习强项');
  bullets(doc, r.strengths);
  section(doc, '五、需要加强的知识点');
  bullets(doc, r.weaknesses);

  section(doc, '六、常见错误分析');
  if (!r.errors.length) doc.paragraph('本次评估没有答错的题目。', { size: 10.2 });
  else doc.table([
    { key: 'name', title: '错误类型', width: 1.6 }, { key: 'count', title: '题数', width: 0.6, align: 'center' },
    { key: 'ex', title: '实例（学生答案 → 正确答案）', width: 4 },
  ], r.errors.map(e => ({ name: e.name, count: String(e.count), ex: e.examples.map(x => `${x.text}\n学生：${x.student} → 正确：${x.correct}（${x.marks} 分）`).join('\n') + (e.explain ? `\n说明：${e.explain}` : '') })), { size: 9 });

  section(doc, '七、个性化复习建议');
  bullets(doc, r.recommendations);

  section(doc, '八、教师评语');
  writeBox(doc, '', r.teacherComment, 4);
  section(doc, '九、家长签阅');
  signRow(doc, ['家长签名：', '日期：']);

  // 附录：逐题记录
  section(doc, '附录：评估逐题记录');
  doc.table([
    { key: 'no', title: '题号', width: 0.5, align: 'center' }, { key: 'text', title: '题目', width: 3.6 },
    { key: 'student', title: '学生答案', width: 1.6 }, { key: 'correct', title: '正确答案', width: 1.6 }, { key: 'm', title: '得分', width: 0.7, align: 'center' },
  ], r.questions.map(x => ({ no: String(x.no), text: x.text, student: x.student, correct: x.correct, m: `${x.marks}/${x.max}`, _colors: { m: x.ok ? C.good : C.bad } })), { size: 8.6 });
  doc.paragraph(`报告生成时间：${new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')}（以实际作答记录为依据）`, { size: 8.5, color: C.muted });
}

export function individualPdf(reports, title) {
  const doc = newDoc(title);
  reports.forEach((r, i) => { if (i > 0) doc.addPage(); drawIndividual(doc, r); });
  return doc.finish({ footer: footerFor(doc) });
}

function footerFor(doc) {
  return (i, n) => {
    const secs = doc.sections;
    let s = null, idx = -1;
    for (let k = 0; k < secs.length; k++) if (secs[k].start <= i - 1) { s = secs[k]; idx = k; }
    if (!s) return `第 ${i} 页，共 ${n} 页`;
    const end = idx + 1 < secs.length ? secs[idx + 1].start : n;
    const local = i - s.start, total = end - s.start;
    return secs.length > 1 ? `${s.label} · 第 ${local} 页，共 ${total} 页（全文第 ${i}/${n} 页）` : `第 ${local} 页，共 ${total} 页`;
  };
}

// ---------------------------------------------------------------- 图表
function barChart(doc, { title, labels, values, max = 100, suffix = '', color = '#3b82f6', height = 150 }) {
  doc.ensureSpace(height + 50);
  const x0 = doc.margins.left + 30, y0 = doc.y + 18, w = doc.contentWidth - 40, h = height;
  doc.textAt(title, doc.margins.left, doc.y, { size: 10.5, bold: true });
  const top = Math.max(max, ...values, 1);
  for (let k = 0; k <= 4; k++) {
    const yy = y0 + h - h * k / 4;
    doc.line(x0, yy, x0 + w, yy, { color: '#e5e7eb', width: 0.5 });
    doc.textAt(String(Math.round(top * k / 4)) + suffix, doc.margins.left, yy - 5, { size: 7.5, color: C.muted, align: 'right', width: 26 });
  }
  const n = values.length, bw = Math.min(46, (w / n) * 0.6);
  values.forEach((v, i) => {
    const cx = x0 + (w / n) * (i + 0.5);
    const bh = h * v / top;
    if (bh > 0) doc.rect(cx - bw / 2, y0 + h - bh, bw, bh, { fill: Array.isArray(color) ? color[i] : color });
    doc.textAt(String(v) + suffix, cx - 30, y0 + h - bh - 12, { size: 8, color: C.dark, align: 'center', width: 60 });
    doc.wrap(labels[i], w / n - 4, 7.8).slice(0, 2).forEach((ln, k) => doc.textAt(ln, cx - (w / n) / 2, y0 + h + 4 + k * 10, { size: 7.8, color: C.muted, align: 'center', width: w / n }));
  });
  doc.y = y0 + h + 32;
}

function hBars(doc, { title, rows, threshold }) {
  const rowH = 20;
  doc.ensureSpace(rows.length * rowH + 40);
  doc.textAt(title, doc.margins.left, doc.y, { size: 10.5, bold: true });
  doc.y += 18;
  const labelW = 150, w = doc.contentWidth - labelW - 50;
  const startY = doc.y;
  rows.forEach((r) => {
    doc.textAt(r.label, doc.margins.left, doc.y + 3, { size: 8.8, width: labelW - 6 });
    doc.rect(doc.margins.left + labelW, doc.y + 2, w, 12, { fill: '#f1f5f9' });
    doc.rect(doc.margins.left + labelW, doc.y + 2, Math.max(0.5, w * r.value / 100), 12, { fill: r.value >= (threshold?.good ?? 70) ? '#22c55e' : r.value < (threshold?.weak ?? 50) ? '#ef4444' : '#f59e0b' });
    doc.textAt(`${r.value}%`, doc.margins.left + labelW + w + 6, doc.y + 2, { size: 8.8 });
    doc.y += rowH;
  });
  if (threshold?.good) {
    const xx = doc.margins.left + labelW + w * threshold.good / 100;
    doc.line(xx, startY, xx, doc.y, { color: '#16a34a', dash: [3, 2] });
  }
  doc.y += 10;
}

// ---------------------------------------------------------------- 全班报告
export function classPdf(r) {
  const doc = newDoc(r.title);
  doc.sections.push({ start: 0, label: r.title });
  titleBlock(doc, r.title, [r.info.school, r.info.className].filter(Boolean).join(' · '));
  section(doc, '一、基本资料');
  kvTable(doc, [['学校名称', r.info.school || '—'], ['班级', r.info.className], ['科目', r.info.subject], ['教师姓名', r.info.teacherName || '—'],
    ['评估主题', r.info.topic], ['评估日期', r.info.period], ['全班人数', `${r.info.rosterCount} 人`], ['已完成评估人数', `${r.info.doneCount} 人`]]);
  doc.paragraph(`统计说明：${r.info.policy}的正式评估记录；未提交的学生不计入平均分，也不当作 0 分。`, { size: 9, color: C.muted });

  section(doc, '二、全班整体表现');
  const s = r.summary;
  const pctOrDash = (v) => (v === null || v === undefined ? '—' : `${v}%`);
  statGrid(doc, [
    { label: '全班平均分（得分率）', value: pctOrDash(s.average) }, { label: '最高分', value: pctOrDash(s.highest) },
    { label: '最低分', value: pctOrDash(s.lowest) }, { label: '完成率', value: `${s.completionRate}%` },
    { label: `达标人数（≥${s.passing}%）`, value: `${s.passedCount} 人`, color: C.good }, { label: '达标百分比', value: `${s.passRate}%` },
    { label: '未达标人数', value: `${s.notPassedCount} 人`, color: s.notPassedCount ? C.bad : C.dark }, { label: '未提交人数', value: `${s.notSubmitted} 人`, color: C.muted },
  ]);
  if (s.averageScore !== null) doc.paragraph(`平均得分：${s.averageScore} / ${s.maxScore} 分。`, { size: 9.5, color: C.muted });

  section(doc, '三、学生成绩记录');
  doc.table([
    { key: 'no', title: '序号', width: 0.6, align: 'center' }, { key: 'name', title: '学生姓名', width: 2 },
    { key: 'score', title: '得分', width: 1, align: 'center' }, { key: 'pct', title: '百分比', width: 1, align: 'center' },
    { key: 'mastery', title: '掌握程度', width: 1.1, align: 'center' }, { key: 'status', title: '完成情况', width: 1.6, align: 'center' },
  ], r.students.map(st => ({
    no: String(st.no), name: st.name, score: st.score === null ? '—' : `${st.score}/${st.max}`, pct: st.percentage === null ? '—' : `${st.percentage}%`,
    mastery: st.mastery, status: st.status, _colors: { status: st.status === '已完成' ? C.good : C.warn, pct: st.passed === false ? C.bad : C.dark },
  })));

  section(doc, '四、知识点掌握分析');
  if (!r.topics.length) doc.paragraph('暂时没有已提交的评估，无法分析。');
  else {
    doc.table([
      { key: 'title', title: '知识点', width: 3 }, { key: 'items', title: '作答题次', width: 1, align: 'center' },
      { key: 'correct', title: '答对', width: 1, align: 'center' }, { key: 'acc', title: '掌握百分比', width: 1.2, align: 'center' }, { key: 'label', title: '结论', width: 1.3, align: 'center' },
    ], r.topics.map(t => ({ title: t.title, items: String(t.items), correct: String(t.correct), acc: `${t.accuracy}%`, label: t.label })));
    const good = r.topics.filter(t => t.label === '掌握良好').map(t => `${t.title}（${t.accuracy}%）`);
    const weak = r.topics.filter(t => t.label !== '掌握良好').map(t => `${t.title}（${t.accuracy}%）`);
    bullets(doc, [`掌握良好的知识点：${good.length ? good.join('；') : '暂无'}`, `需要加强的知识点：${weak.length ? weak.join('；') : '暂无'}`]);
    if (r.errors.length) {
      doc.textAt('常见错误', doc.margins.left, doc.y, { size: 10.5, bold: true }); doc.y += 18;
      doc.table([{ key: 'name', title: '错误类型', width: 1.8 }, { key: 'count', title: '出现次数', width: 0.9, align: 'center' }, { key: 'stu', title: '涉及人数', width: 0.9, align: 'center' }, { key: 't', title: '说明', width: 3.5 }],
        r.errors.map(e => ({ name: e.name, count: String(e.count), stu: String(e.students), t: e.teacher })), { size: 9 });
    }
  }

  section(doc, '五、学习表现图表');
  if (r.summary.average !== null) {
    barChart(doc, { title: '成绩分布图（人数）', labels: r.bins.map(b => b.label + '%'), values: r.bins.map(b => b.count), max: Math.max(4, ...r.bins.map(b => b.count)), color: r.bins.map(b => (b.lo >= r.summary.passing ? '#3b82f6' : '#f59e0b')) });
    hBars(doc, { title: '知识点掌握率', rows: r.topics.map(t => ({ label: t.title, value: t.accuracy })), threshold: { good: r.settings.topic_good, weak: r.settings.topic_weak } });
  }
  const st = r.students;
  const doneN = st.filter(x => x.status === '已完成').length, prog = st.filter(x => x.status.startsWith('进行中')).length, none = st.length - doneN - prog;
  barChart(doc, { title: '学习完成情况（人数）', labels: ['已完成', '进行中', '未开始/未提交'], values: [doneN, prog, none], max: Math.max(4, st.length), color: ['#22c55e', '#f59e0b', '#9ca3af'], height: 110 });
  if (r.skills.length) hBars(doc, { title: '不同技能的正确率', rows: r.skills.slice(0, 12).map(g => ({ label: `${g.tag}（${g.n}）`, value: g.accuracy })), threshold: { good: r.settings.topic_good, weak: r.settings.topic_weak } });

  section(doc, '六、补救教学与提升计划');
  const g = r.groups;
  doc.table([{ key: 'g', title: '组别', width: 1.3 }, { key: 'c', title: '标准', width: 1.6 }, { key: 'n', title: '学生（最弱知识点）', width: 4 }], [
    { g: '基础补救组', c: `低于 ${r.settings.nearLow}%`, n: g.basic.map(x => `${x.name} ${x.percentage}%${x.weakest ? '：' + x.weakest : ''}`).join('\n') || '无' },
    { g: '冲刺及格组', c: `${r.settings.nearLow}% – ${r.settings.passing}% 以下`, n: g.nearPass.map(x => `${x.name} ${x.percentage}%${x.weakest ? '：' + x.weakest : ''}`).join('\n') || '无' },
    { g: '巩固提升组', c: `${r.settings.passing}% 或以上`, n: g.consolidate.map(x => `${x.name} ${x.percentage}%`).join('、') || '无' },
  ], { size: 9 });
  bullets(doc, [
    '基础补救组：用课本例题重新示范，进行引导练习（第二关解题训练营与补救小站）。',
    '冲刺及格组：针对最弱知识点做重点复习，再进行一次王者认证。',
    `巩固提升组：提供多步思考的挑战题${r.enrichment.length ? `（${r.enrichment.join('、')}）` : ''}，并请他们向同学解说解题步骤。`,
    ...r.remedial,
  ]);
  if (r.struggling.length) {
    doc.textAt('学习困难学生名单（依老师设定的标准）', doc.margins.left, doc.y, { size: 10.5, bold: true }); doc.y += 18;
    doc.table([{ key: 'n', title: '学生', width: 1.2 }, { key: 'r', title: '原因', width: 4 }], r.struggling.map(x => ({ n: x.name, r: x.reasons.join('；') })), { size: 9 });
  }

  section(doc, '七、后续行动计划');
  const n = r.notes || {};
  doc.table([{ key: 'k', title: '项目', width: 1.2 }, { key: 'v', title: '内容', width: 4.5 }], [
    ['改进措施', n.measures], ['辅导方式', n.method], ['负责教师', n.owner], ['实施日期', n.when], ['预期目标', n.goal], ['跟进情况', n.followup],
  ].map(([k, v]) => ({ k, v: v || ' \n ' })), { minRow: 30 });

  section(doc, '八、教师总结');
  writeBox(doc, '', n.summary || '', 5);

  section(doc, '九、报告确认');
  doc.table([{ key: 'a', title: '报告教师', width: 1 }, { key: 'b', title: '审阅者', width: 1 }, { key: 'c', title: '日期', width: 1 }, { key: 'd', title: '签名', width: 1 }],
    [{ a: n.reporter || r.info.teacherName || '', b: n.reviewer || '', c: n.confirmDate || '', d: '' }], { minRow: 46 });
  return doc.finish({ footer: (i, nn) => `${r.info.className} · ${r.title} · 第 ${i} 页，共 ${nn} 页` });
}
