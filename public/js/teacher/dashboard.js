// 教师管理中心
import { esc, el, toast, modal, confirmBox, loading, fmtTime } from '../ui.js';
import { api, download, openPdf } from '../api.js';
import { getTeacher, clearTeacher } from '../main.js';
import { individualReportHTML, classReportHTML } from '../report-view.js';
import { barChart, hBars, donut } from '../charts.js';
import { renderBank } from './bank.js';
import { renderAssetCheck } from './assets-check.js';

const NAV = [
  ['records', '学生学习记录'], ['stats', '班级成绩统计'], ['topics', '知识点掌握分析'], ['support', '学习困难与补救建议'],
  ['reports', '报告生成中心'], ['bank', '题库管理'], ['quizzes', '小测与复习活动'], ['roster', '班级与学生名单'], ['assets', '美术素材'], ['settings', '设置与账户'],
];

// 筛选条件（保存在本分页）
const F = {
  get() { try { return JSON.parse(sessionStorage.getItem('ma_filters') || '{}'); } catch { return {}; } },
  set(v) { sessionStorage.setItem('ma_filters', JSON.stringify({ ...F.get(), ...v })); },
};
let cache = { classes: null, units: null };

async function base() {
  if (!cache.classes) cache.classes = (await api.get('/api/teacher/classes')).classes;
  if (!cache.units) cache.units = (await api.get('/api/teacher/units')).units;
  const f = F.get();
  if (!f.class_id || !cache.classes.some(c => String(c.id) === String(f.class_id))) F.set({ class_id: cache.classes[0]?.id || '' });
  if (!f.unit_id) F.set({ unit_id: cache.units[0]?.id || '' });
  return cache;
}
export function invalidateCache() { cache = { classes: null, units: null }; }

const qs = (extra = {}) => {
  const f = { ...F.get(), ...extra };
  const p = new URLSearchParams();
  for (const k of ['class_id', 'unit_id', 'quiz_id', 'from', 'to', 'q', 'ids']) if (f[k]) p.set(k, f[k]);
  return p.toString();
};

function filtersHTML({ search = false, quiz = true } = {}) {
  const f = F.get();
  return `<div class="t-card filters">
    <label>班级<select class="input" data-f="class_id">${cache.classes.map(c => `<option value="${c.id}" ${String(c.id) === String(f.class_id) ? 'selected' : ''}>${esc(c.name)}${c.is_demo ? '（示范）' : ''}</option>`).join('') || '<option value="">请先建立班级</option>'}</select></label>
    <label>单元（评估主题）<select class="input" data-f="unit_id">${cache.units.map(u => `<option value="${esc(u.id)}" ${u.id === f.unit_id ? 'selected' : ''}>${esc(u.code)} ${esc(u.title)}</option>`).join('')}</select></label>
    ${quiz ? `<label>评估类型<select class="input" data-f="quiz_id"><option value="">数学王者认证（单元评估）</option>${(cache.quizzes || []).filter(q => q.mode === 'formal' && String(q.class_id) === String(f.class_id)).map(q => `<option value="${q.id}" ${String(q.id) === String(f.quiz_id) ? 'selected' : ''}>${esc(q.title)}</option>`).join('')}</select></label>` : ''}
    <label>开始日期<input class="input" type="date" data-f="from" value="${esc(f.from || '')}"></label>
    <label>结束日期<input class="input" type="date" data-f="to" value="${esc(f.to || '')}"></label>
    ${search ? `<label>搜索学生姓名<input class="input" data-f="q" value="${esc(f.q || '')}" placeholder="输入姓名"></label>` : ''}
    <button class="btn small ghost" data-f-clear>清除日期</button>
  </div>`;
}
function bindFilters(root, rerender) {
  root.querySelectorAll('[data-f]').forEach(i => i.addEventListener('change', () => {
    const v = { [i.dataset.f]: i.value };
    if (i.dataset.f === 'class_id') v.quiz_id = '';
    F.set(v); rerender();
  }));
  root.querySelector('[data-f-clear]')?.addEventListener('click', () => { F.set({ from: '', to: '' }); rerender(); });
}

export async function renderDashboard(app, tab, id) {
  document.body.classList.add('theme-teacher');
  const t = await getTeacher();
  app.innerHTML = `<div class="t-shell">
    <aside class="t-side"><a class="brand" href="#/admin">教师管理中心<small>数学冒险王</small></a>
      <nav>${NAV.map(([k, n]) => `<a href="#/admin/${k}" class="${k === tab || (tab === 'report' && k === 'records') ? 'on' : ''}">${n}</a>`).join('')}</nav>
      <div class="who">${esc(t.displayName)}（${t.role === 'admin' ? '管理员' : '教师'}）<br><button class="linkbtn" id="logout" style="color:#c7d3f5">登出</button>
        <br><a href="#/teach" style="color:#c7d3f5">前往教学模式</a><br><a href="#/" style="color:#c7d3f5">返回首页</a></div>
    </aside>
    <main class="t-main" id="tmain">${loading()}</main></div>`;
  app.querySelector('#logout').onclick = async () => { await api.post('/api/teacher/logout'); clearTeacher(); invalidateCache(); location.hash = '#/'; };
  const main = app.querySelector('#tmain');
  await base();
  cache.quizzes = (await api.get('/api/teacher/quizzes')).quizzes;
  const views = { records, report: (m) => reportView(m, id), stats, topics, support, reports, bank: (m) => renderBank(m, cache), quizzes, roster, assets: renderAssetCheck, settings };
  const fn = views[tab] || records;
  try { await fn(main, t); } catch (e) { main.innerHTML = `<div class="t-card"><p class="error-text">${esc(e.message)}</p></div>`; }
}

function noClass(main) {
  if (cache.classes.length) return false;
  main.innerHTML = `<h1>还没有班级</h1><div class="t-card"><p>请先到“班级与学生名单”建立班级并输入学生名单，学生才能登记并开始闯关。</p><a class="btn" href="#/admin/roster">建立班级</a></div>`;
  return true;
}

// ------------------------------------------------------------ 学生学习记录
async function records(main) {
  if (noClass(main)) return;
  const draw = async () => {
    main.innerHTML = `<h1>学生学习记录</h1><p class="desc">每一次正式评估的提交记录，以及全班名单的闯关进度。点“报告”可预览、打印、下载个人报告。</p>${filtersHTML({ search: true })}<div id="rec">${loading()}</div>`;
    bindFilters(main, draw);
    const d = await api.get(`/api/teacher/records?${qs()}`);
    const s = d.summary;
    main.querySelector('#rec').innerHTML = `
      <div class="kpis"><div class="kpi"><span>名单人数</span><b>${d.roster.length}</b></div><div class="kpi"><span>已提交</span><b>${d.roster.filter(r => r.assessmentId).length}</b></div>
        <div class="kpi"><span>完成率</span><b>${s.completionRate}%</b></div><div class="kpi"><span>平均得分率</span><b>${s.average ?? '—'}${s.average !== null ? '%' : ''}</b></div></div>
      <div class="t-card"><h2>提交记录（${d.records.length} 份）</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>学生</th><th>评估</th><th>得分</th><th>正确率</th><th>答对</th><th>用时</th><th>提示（练习）</th><th>提交时间</th><th></th></tr></thead><tbody>
        ${d.records.map(r => `<tr><td>${esc(r.name)} ${r.is_demo ? '<span class="pill demo">示范</span>' : ''}</td><td>${esc(r.title)}（第 ${r.attempt_no} 次）</td><td class="num">${Number(r.score)} / ${Number(r.max_score)}</td>
          <td><span class="pill ${Number(r.percentage) >= 70 ? 'ok' : Number(r.percentage) >= 50 ? 'warn' : 'bad'}">${Number(r.percentage)}%</span></td><td class="num">${r.correct_count} / ${r.total_questions}</td>
          <td class="num">${Math.round(r.duration_sec / 60)} 分钟</td><td class="num">${r.hints ?? 0}</td><td class="num">${esc(r.submitted)}</td>
          <td><a class="btn small" href="#/admin/report/${r.id}">报告</a></td></tr>`).join('') || '<tr><td colspan="9">所选范围内还没有提交记录。</td></tr>'}
      </tbody></table></div></div>
      <div class="t-card"><h2>全班名单与提交状态</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>序号</th><th>学生</th><th>闯关进度（1–6 关）</th><th>经验值</th><th>统计用成绩</th><th>状态</th></tr></thead><tbody>
        ${d.roster.map(r => `<tr><td>${r.no}</td><td>${esc(r.name)}${r.source === 'self' ? ' <span class="pill warn" title="学生自己登记，不在老师输入的名单中">自行登记</span>' : ''}</td>
          <td><span class="stage-dots">${r.stages.map((on, i) => `<i class="${on ? 'on' : ''}" title="第 ${i + 1} 关"></i>`).join('')}</span></td><td class="num">${r.xp}</td>
          <td>${r.percentage === null ? '—' : `${r.percentage}%（${esc(r.mastery)}）`}</td>
          <td><span class="pill ${r.status === '已完成' ? 'ok' : 'warn'}">${esc(r.status)}</span></td></tr>`).join('')}
      </tbody></table></div></div>`;
  };
  await draw();
}

// ------------------------------------------------------------ 个人报告
async function reportView(main, id) {
  main.innerHTML = loading('正在生成报告……');
  const r = await api.get(`/api/teacher/assessments/${id}/report`);
  main.innerHTML = `<div class="report-toolbar no-print"><a class="btn ghost" href="#/admin/records">返回记录</a>
    <button class="btn green" id="save">保存评语</button><button class="btn" id="pdf">下载 PDF</button><button class="btn ghost" id="view">在新分页查看 PDF</button><button class="btn ghost" id="print">打印</button>
    <span class="grow"></span><button class="btn red small" id="del">删除这份记录</button></div>
    <div class="report-shell"><div class="print-area">${individualReportHTML(r, { editable: true })}</div></div>`;
  main.querySelector('#save').onclick = async () => {
    await api.patch(`/api/teacher/assessments/${id}`, { teacher_comment: main.querySelector('.comment-edit').value });
    toast('评语已保存，PDF 也会显示这段评语。', 'ok');
  };
  main.querySelector('#pdf').onclick = async () => toast(`已下载：${await download(`/api/teacher/assessments/${id}/pdf`)}`, 'ok');
  main.querySelector('#view').onclick = () => openPdf(`/api/teacher/assessments/${id}/pdf`);
  main.querySelector('#print').onclick = () => window.print();
  main.querySelector('#del').onclick = async () => {
    if (!(await confirmBox('删除评估记录', `确定要删除 ${r.student.name} 的这份评估记录吗？删除后无法恢复，统计会重新计算。`, '删除'))) return;
    await api.del(`/api/teacher/assessments/${id}`);
    toast('记录已删除', 'ok'); location.hash = '#/admin/records';
  };
}

// ------------------------------------------------------------ 班级成绩统计
async function stats(main) {
  if (noClass(main)) return;
  const draw = async () => {
    main.innerHTML = `<h1>班级成绩统计</h1><p class="desc">平均分只计算已提交的学生；未提交的学生另外列出，不当作 0 分。</p>${filtersHTML()}<div id="st">${loading()}</div>`;
    bindFilters(main, draw);
    const r = await api.get(`/api/teacher/class-report?${qs()}`);
    const s = r.summary;
    const pc = (v) => (v === null ? '—' : `${v}%`);
    const st = r.students;
    const doneN = st.filter(x => x.status === '已完成').length, prog = st.filter(x => x.status.startsWith('进行中')).length;
    main.querySelector('#st').innerHTML = `
      <div class="kpis">${[['全班平均分', pc(s.average)], ['最高分', pc(s.highest)], ['最低分', pc(s.lowest)], ['完成率', `${s.completionRate}%`], [`达标人数（≥${s.passing}%）`, s.passedCount], ['达标百分比', `${s.passRate}%`], ['未达标人数', s.notPassedCount], ['未提交人数', s.notSubmitted]].map(([k, v]) => `<div class="kpi"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      <div class="two-col">
        <div class="t-card"><h2>成绩分布（人数）</h2>${s.average === null ? '<p>还没有提交记录。</p>' : barChart({ labels: r.bins.map(b => b.label + '%'), values: r.bins.map(b => b.count), max: 4, colors: r.bins.map(b => (b.lo >= s.passing ? '#3b82f6' : '#f59e0b')), title: '成绩分布' })}</div>
        <div class="t-card"><h2>学习完成情况</h2><div class="row">${donut([{ value: doneN, color: '#22c55e' }, { value: prog, color: '#f59e0b' }, { value: st.length - doneN - prog, color: '#9ca3af' }], { label: `${s.completionRate}%` })}
          <ul class="legend"><li><i style="background:#22c55e"></i>已完成 ${doneN} 人</li><li><i style="background:#f59e0b"></i>进行中 ${prog} 人</li><li><i style="background:#9ca3af"></i>未提交 ${st.length - doneN - prog} 人</li></ul></div>
          ${st.filter(x => x.percentage === null).length ? `<p><b>未提交：</b>${st.filter(x => x.percentage === null).map(x => esc(x.name)).join('、')}</p>` : ''}</div>
      </div>
      <div class="t-card"><h2>学生成绩</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>序号</th><th>姓名</th><th>得分</th><th>百分比</th><th>掌握程度</th><th>完成情况</th><th>评估次数</th></tr></thead><tbody>
        ${st.map(x => `<tr><td>${x.no}</td><td>${esc(x.name)}</td><td class="num">${x.score === null ? '—' : `${x.score}/${x.max}`}</td><td class="num">${x.percentage === null ? '—' : x.percentage + '%'}</td><td>${esc(x.mastery)}</td><td><span class="pill ${x.status === '已完成' ? 'ok' : 'warn'}">${esc(x.status)}</span></td><td class="num">${x.attempts}</td></tr>`).join('')}
      </tbody></table></div><p class="desc" style="margin-top:8px">统计依据：${esc(r.info.policy)}的记录（可在“设置”中更改）。</p></div>`;
  };
  await draw();
}

// ------------------------------------------------------------ 知识点掌握分析
async function topics(main) {
  if (noClass(main)) return;
  const draw = async () => {
    main.innerHTML = `<h1>知识点掌握分析</h1><p class="desc">根据已提交的正式评估逐题统计。掌握良好 ≥ 老师设定标准；需要加强 < 老师设定标准。</p>${filtersHTML()}<div id="tp">${loading()}</div>`;
    bindFilters(main, draw);
    const r = await api.get(`/api/teacher/class-report?${qs()}`);
    if (!r.topics.length) { main.querySelector('#tp').innerHTML = '<div class="t-card"><p>所选范围内还没有提交的评估。</p></div>'; return; }
    const best = [...r.topics].sort((a, b) => b.accuracy - a.accuracy)[0], worst = [...r.topics].sort((a, b) => a.accuracy - b.accuracy)[0];
    main.querySelector('#tp').innerHTML = `
      <div class="kpis"><div class="kpi"><span>最强的知识点</span><b style="font-size:18px">${esc(best.title)}（${best.accuracy}%）</b></div><div class="kpi"><span>最弱的知识点</span><b style="font-size:18px">${esc(worst.title)}（${worst.accuracy}%）</b></div></div>
      <div class="two-col"><div class="t-card"><h2>知识点掌握率</h2>${hBars(r.topics.map(t => ({ label: t.title, value: t.accuracy })), { good: r.settings.topic_good, weak: r.settings.topic_weak })}
        <table class="tbl" style="margin-top:10px"><thead><tr><th>知识点</th><th>作答题次</th><th>答对</th><th>掌握百分比</th><th>结论</th></tr></thead><tbody>${r.topics.map(t => `<tr><td>${esc(t.title)}</td><td>${t.items}</td><td>${t.correct}</td><td>${t.accuracy}%</td><td><span class="pill ${t.label === '掌握良好' ? 'ok' : t.label === '需要加强' ? 'bad' : 'warn'}">${t.label}</span></td></tr>`).join('')}</tbody></table></div>
      <div class="t-card"><h2>不同技能的正确率</h2>${hBars(r.skills.map(g => ({ label: `${g.tag}（${g.n} 题次）`, value: g.accuracy })), { good: r.settings.topic_good, weak: r.settings.topic_weak })}</div></div>
      <div class="t-card"><h2>常见错误（由学生实际答案判断）</h2><table class="tbl"><thead><tr><th>错误类型</th><th>出现次数</th><th>涉及人数</th><th>说明</th><th>建议</th></tr></thead><tbody>
        ${r.errors.map(e => `<tr><td><b>${esc(e.name)}</b></td><td>${e.count}</td><td>${e.students}</td><td>${esc(e.teacher)}</td><td>${esc(e.remedy)}</td></tr>`).join('') || '<tr><td colspan="5">没有答错的题目。</td></tr>'}</tbody></table></div>`;
  };
  await draw();
}

// ------------------------------------------------------------ 学习困难与补救
async function support(main) {
  if (noClass(main)) return;
  const draw = async () => {
    main.innerHTML = `<h1>学习困难学生名单与补救教学建议</h1><p class="desc">名单依“设置”中的标准自动产生，只根据已提交的评估资料。</p>${filtersHTML()}<div id="sp">${loading()}</div>`;
    bindFilters(main, draw);
    const r = await api.get(`/api/teacher/class-report?${qs()}`);
    const g = r.groups;
    const grp = (title, list, note) => `<div class="t-card"><h2>${title}（${list.length} 人）</h2><p class="desc">${note}</p>${list.length ? `<ul>${list.map(x => `<li><b>${esc(x.name)}</b> ${x.percentage}%${x.weakest ? `，最弱：${esc(x.weakest)}` : ''}</li>`).join('')}</ul>` : '<p>无</p>'}</div>`;
    main.querySelector('#sp').innerHTML = `
      <div class="t-card"><h2>学习困难学生（${r.struggling.length} 人）</h2><p class="desc">标准：总分低于 ${r.settings.struggling_percent}%，或任何知识点低于 ${r.settings.struggling_topic}%。</p>
        ${r.struggling.length ? `<table class="tbl"><thead><tr><th>学生</th><th>总分</th><th>原因</th></tr></thead><tbody>${r.struggling.map(x => `<tr><td>${esc(x.name)}</td><td>${x.percentage}%</td><td>${esc(x.reasons.join('；'))}</td></tr>`).join('')}</tbody></table>` : '<p>目前没有学生符合学习困难的标准。</p>'}</div>
      <div class="two-col">${grp('基础补救组', g.basic, `低于 ${r.settings.nearLow}%：用课本例题重新示范，进行引导练习。`)}${grp('冲刺及格组', g.nearPass, `${r.settings.nearLow}% 至 ${r.settings.passing}% 以下：针对最弱知识点重点复习。`)}</div>
      ${grp('巩固提升组', g.consolidate, `${r.settings.passing}% 或以上：提供挑战题${r.enrichment.length ? `（${esc(r.enrichment.join('、'))}）` : ''}，请他们解说解题步骤。`)}
      <div class="t-card"><h2>数学补救教学建议</h2><ul>${r.remedial.map(x => `<li>${esc(x)}</li>`).join('') || '<li>全班各知识点都已达到“掌握良好”的标准。</li>'}</ul>
        <p>可以到“小测与复习活动”选这些题目，布置给需要的学生练习。</p><a class="btn small" href="#/admin/quizzes">布置复习活动</a></div>`;
  };
  await draw();
}

// ------------------------------------------------------------ 报告生成中心
async function reports(main) {
  if (noClass(main)) return;
  const draw = async () => {
    main.innerHTML = `<h1>报告生成中心</h1><p class="desc">一键生成全班学习报告：全班分析报告、每位学生的个人报告（合并 PDF 或 ZIP）。下方可以编辑行动计划与教师总结，会印在全班报告上。</p>
      ${filtersHTML()}<div id="rp">${loading()}</div>`;
    bindFilters(main, draw);
    const r = await api.get(`/api/teacher/class-report?${qs()}`);
    const done = r.students.filter(s => s.assessmentId);
    main.querySelector('#rp').innerHTML = `
      <div class="t-card"><h2>一键生成全班学习报告</h2>
        <p>${esc(r.info.className)}：名单 ${r.info.rosterCount} 人，已提交 ${r.info.doneCount} 人，平均得分率 ${r.summary.average ?? '—'}${r.summary.average !== null ? '%' : ''}。</p>
        <div class="row">
          <button class="btn" data-dl="/api/teacher/class-report/pdf">四年级数学_全班学习分析报告.pdf</button>
          <button class="btn green" data-dl="/api/teacher/bulk/individual-pdf" ${done.length ? '' : 'disabled'}>四年级数学_全班个人报告汇总.pdf</button>
          <button class="btn purple" data-dl="/api/teacher/bulk/zip" ${done.length ? '' : 'disabled'}>全部报告 ZIP</button>
          <button class="btn ghost" data-view="/api/teacher/class-report/pdf">预览全班报告 PDF</button>
          <button class="btn ghost" data-view="/api/teacher/bulk/individual-pdf" ${done.length ? '' : 'disabled'}>预览 / 批量打印个人报告</button></div>
        <h3 style="margin-top:16px">只生成部分学生</h3>
        <div class="check-grid">${done.map(s => `<label><input type="checkbox" value="${s.id}" class="pick"> ${esc(s.name)}</label>`).join('') || '<span>还没有学生提交评估。</span>'}</div>
        <div class="row" style="margin-top:8px"><button class="btn small ghost" id="pick-pdf">下载所选学生的个人报告</button><button class="btn small ghost" id="pick-class">所选学生的小组分析报告</button></div>
        <h3 style="margin-top:16px">成绩表</h3><div class="row"><button class="btn small ghost" data-dl="/api/teacher/export?format=csv">导出 CSV</button><button class="btn small ghost" data-dl="/api/teacher/export?format=xlsx">导出 Excel（.xlsx）</button></div>
      </div>
      <div class="report-toolbar"><button class="btn green" id="save-notes">保存行动计划与总结</button><button class="btn ghost" id="print">打印这份全班报告</button><span class="desc">在报告中直接编辑“后续行动计划”“教师总结”“报告确认”。</span></div>
      <div class="report-shell"><div class="print-area">${classReportHTML(r, { editable: true })}</div></div>`;
    const run = async (url, viewOnly) => {
      try {
        if (viewOnly) openPdf(`${url}?${qs()}`);
        else toast(`已下载：${await download(`${url}${url.includes('?') ? '&' : '?'}${qs()}`)}`, 'ok', 5000);
      } catch (e) { toast(e.message, 'err'); }
    };
    main.querySelectorAll('[data-dl]').forEach(b => b.onclick = async () => { b.disabled = true; const t = b.textContent; b.textContent = '正在生成……'; await run(b.dataset.dl); b.textContent = t; b.disabled = false; });
    main.querySelectorAll('[data-view]').forEach(b => b.onclick = () => run(b.dataset.view, true));
    const picked = () => [...main.querySelectorAll('.pick:checked')].map(i => i.value).join(',');
    main.querySelector('#pick-pdf').onclick = async () => { const ids = picked(); if (!ids) return toast('请先勾选学生', 'warn'); toast(`已下载：${await download(`/api/teacher/bulk/individual-pdf?${qs({ ids })}`)}`, 'ok'); };
    main.querySelector('#pick-class').onclick = async () => { const ids = picked(); if (!ids) return toast('请先勾选学生', 'warn'); toast(`已下载：${await download(`/api/teacher/class-report/pdf?${qs({ ids })}`)}`, 'ok'); };
    main.querySelector('#print').onclick = () => window.print();
    main.querySelector('#save-notes').onclick = async () => {
      const notes = {};
      main.querySelectorAll('.note').forEach(n => { notes[n.dataset.k] = n.value; });
      await api.put('/api/teacher/class-report/notes', { class_id: F.get().class_id, key: r.key, notes });
      toast('已保存。下载的全班报告 PDF 会包含这些内容。', 'ok');
    };
  };
  await draw();
}

// ------------------------------------------------------------ 小测与复习活动
async function quizzes(main) {
  if (noClass(main)) return;
  const draw = async () => {
    cache.quizzes = (await api.get('/api/teacher/quizzes')).quizzes;
    main.innerHTML = `<h1>小测与复习活动</h1><p class="desc">从题库挑选题目，布置给一个班级。“练习”模式有提示与重答；“正式评估”按固定评分方式计分，并出现在报告中。</p>
      <div class="t-card"><button class="btn" id="new">新增小测 / 复习活动</button></div>
      <div class="t-card"><table class="tbl"><thead><tr><th>名称</th><th>班级</th><th>模式</th><th>题数</th><th>已提交</th><th>状态</th><th></th></tr></thead><tbody>
        ${cache.quizzes.map(q => `<tr><td>${esc(q.title)}</td><td>${esc(q.class_name)}</td><td>${q.mode === 'formal' ? '正式评估' : '练习'}</td><td>${q.question_ids.length}</td><td>${q.submissions}</td>
          <td><span class="pill ${q.is_active ? 'ok' : ''}">${q.is_active ? '开放中' : '已关闭'}</span></td>
          <td class="row"><button class="btn small ghost" data-toggle="${q.id}" data-on="${q.is_active ? 0 : 1}">${q.is_active ? '关闭' : '开放'}</button><button class="btn small red" data-del="${q.id}">删除</button></td></tr>`).join('') || '<tr><td colspan="7">还没有小测。</td></tr>'}
      </tbody></table></div>`;
    main.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => { await api.patch(`/api/teacher/quizzes/${b.dataset.toggle}`, { is_active: b.dataset.on === '1' }); draw(); });
    main.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (await confirmBox('删除小测', '删除后学生不能再作答。已提交的评估记录会保留。')) { await api.del(`/api/teacher/quizzes/${b.dataset.del}`); draw(); } });
    main.querySelector('#new').onclick = async () => {
      const f = F.get();
      const { questions } = await api.get(`/api/teacher/questions?unit_id=${encodeURIComponent(f.unit_id)}`);
      const body = el(`<div>
        <div class="row"><label class="field grow"><span>名称</span><input class="input" name="title" placeholder="例如：乘除混合运算复习"></label>
          <label class="field"><span>班级</span><select class="input" name="class_id">${cache.classes.map(c => `<option value="${c.id}" ${String(c.id) === String(f.class_id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
          <label class="field"><span>模式</span><select class="input" name="mode"><option value="practice">练习（有提示、可重答）</option><option value="formal">正式评估（计分）</option></select></label>
          <label class="field"><span>截止日期（选填）</span><input class="input" type="date" name="due"></label></div>
        <p><b>选择题目</b>（已选 <span id="cnt">0</span> 题）<button class="linkbtn" id="auto5">随机选 5 题容易与中等题</button></p>
        <div style="max-height:46vh;overflow:auto;border:1px solid var(--line);border-radius:10px"><table class="tbl"><tbody>${questions.map(q => `<tr><td><input type="checkbox" class="qk" value="${esc(q.id)}"></td><td>${esc(q.id)}</td><td>${esc(q.text.split('\n')[0].slice(0, 60))}</td><td>难度 ${q.difficulty}</td><td>${esc(q.answerText)}</td></tr>`).join('')}</tbody></table></div></div>`);
      const cnt = () => { body.querySelector('#cnt').textContent = body.querySelectorAll('.qk:checked').length; };
      body.addEventListener('change', cnt);
      body.querySelector('#auto5').onclick = () => { const ks = [...body.querySelectorAll('.qk')].filter(k => { const q = questions.find(x => x.id === k.value); return q.difficulty <= 2 && q.qtype !== 'order'; }).sort(() => Math.random() - 0.5); body.querySelectorAll('.qk').forEach(k => { k.checked = false; }); ks.slice(0, 5).forEach(k => { k.checked = true; }); cnt(); };
      modal('新增小测 / 复习活动', body, { wide: true, actions: [{ label: '取消', cls: 'ghost' }, { label: '布置给学生', cls: 'green', onClick: async (b) => {
        try {
          await api.post('/api/teacher/quizzes', { title: b.querySelector('[name=title]').value, class_id: b.querySelector('[name=class_id]').value, mode: b.querySelector('[name=mode]').value, due_date: b.querySelector('[name=due]').value || null, question_ids: [...b.querySelectorAll('.qk:checked')].map(k => k.value) });
          toast('已布置，学生在“老师布置的任务”里可以看到。', 'ok'); draw();
        } catch (e) { toast(e.message, 'err'); return false; }
      } }] });
    };
  };
  await draw();
}

// ------------------------------------------------------------ 班级与名单
async function roster(main, t) {
  const draw = async () => {
    invalidateCache(); await base();
    const f = F.get();
    const cls = cache.classes.find(c => String(c.id) === String(f.class_id));
    main.innerHTML = `<h1>班级与学生名单</h1><p class="desc">输入名单后，学生登记时选择班级并输入相同姓名即可对上记录。“未提交名单”也是根据这份名单计算的。</p>
      <div class="t-card"><div class="row">
        <label class="field grow"><span>选择班级</span><select class="input" id="cls">${cache.classes.map(c => `<option value="${c.id}" ${cls && c.id === cls.id ? 'selected' : ''}>${esc(c.name)}${c.is_demo ? '（示范）' : ''}（${c.student_count} 人）</option>`).join('') || '<option>还没有班级</option>'}</select></label>
        <button class="btn" id="newcls">新增班级</button>${cls ? '<button class="btn ghost" id="editcls">修改班级</button><button class="btn red small" id="delcls">删除班级</button>' : ''}</div></div>
      ${cls ? `<div class="two-col"><div class="t-card"><h2>${esc(cls.name)} 的名单</h2><div id="list">${loading()}</div></div>
        <div class="t-card"><h2>加入学生</h2><p class="desc">每行一位学生。可以写“学号 姓名”，例如：<br>01 张小明<br>02 李美玲</p>
          <textarea class="input" id="names" rows="8" placeholder="01 张小明"></textarea><button class="btn green" id="add" style="margin-top:8px">加入名单</button></div></div>` : ''}`;
    main.querySelector('#cls')?.addEventListener('change', (e) => { F.set({ class_id: e.target.value }); draw(); });
    main.querySelector('#newcls').onclick = () => {
      const b = el(`<div><label class="field"><span>班级名称</span><input class="input" name="name" placeholder="例如：四年级爱班"></label><label class="field"><span>学校名称（选填）</span><input class="input" name="school"></label></div>`);
      modal('新增班级', b, { actions: [{ label: '取消', cls: 'ghost' }, { label: '建立', cls: 'green', onClick: async (x) => {
        try { const r = await api.post('/api/teacher/classes', { name: x.querySelector('[name=name]').value, school_name: x.querySelector('[name=school]').value }); F.set({ class_id: r.class.id }); toast('班级已建立', 'ok'); draw(); } catch (e) { toast(e.message, 'err'); return false; }
      } }] });
    };
    if (!cls) return;
    main.querySelector('#editcls').onclick = () => {
      const b = el(`<div><label class="field"><span>班级名称</span><input class="input" name="name" value="${esc(cls.name)}"></label><label class="field"><span>学校名称</span><input class="input" name="school" value="${esc(cls.school_name || '')}"></label></div>`);
      modal('修改班级', b, { actions: [{ label: '取消', cls: 'ghost' }, { label: '保存', cls: 'green', onClick: async (x) => { try { await api.patch(`/api/teacher/classes/${cls.id}`, { name: x.querySelector('[name=name]').value, school_name: x.querySelector('[name=school]').value }); draw(); } catch (e) { toast(e.message, 'err'); return false; } } }] });
    };
    main.querySelector('#delcls').onclick = () => {
      const b = el(`<div><p>删除班级会同时删除班上所有学生的学习记录与报告，<b>无法恢复</b>。请输入班级名称“${esc(cls.name)}”确认：</p><input class="input" name="c"></div>`);
      modal('删除班级', b, { actions: [{ label: '取消', cls: 'ghost' }, { label: '永久删除', cls: 'red', onClick: async (x) => { try { await api.del(`/api/teacher/classes/${cls.id}`, { confirm: x.querySelector('[name=c]').value }); F.set({ class_id: '' }); toast('班级已删除', 'ok'); draw(); } catch (e) { toast(e.message, 'err'); return false; } } }] });
    };
    main.querySelector('#add').onclick = async () => {
      const r = await api.post(`/api/teacher/classes/${cls.id}/students`, { text: main.querySelector('#names').value });
      toast(`已加入 ${r.added.length} 位学生${r.skipped.length ? `，${r.skipped.length} 行已存在或格式不对` : ''}`, 'ok', 5000);
      draw();
    };
    const { students } = await api.get(`/api/teacher/classes/${cls.id}/students`);
    main.querySelector('#list').innerHTML = `<table class="tbl"><thead><tr><th>学号</th><th>姓名</th><th>登记</th><th>评估</th><th>最近登录</th><th></th></tr></thead><tbody>
      ${students.map(s => `<tr><td>${esc(s.pupil_no || '')}</td><td>${esc(s.name)} ${s.source === 'self' ? '<span class="pill warn">自行登记</span>' : ''}</td><td>${s.has_pin ? '<span class="pill ok">已设密码</span>' : '<span class="pill">未登录过</span>'}</td>
        <td>${s.assessments}</td><td>${s.last_seen_at ? esc(fmtTime(s.last_seen_at)) : '—'}</td>
        <td class="row"><button class="btn small ghost" data-edit="${s.id}">修改</button>${s.has_pin ? `<button class="btn small ghost" data-pin="${s.id}">重设密码</button>` : ''}<button class="btn small red" data-del="${s.id}">删除</button></td></tr>`).join('') || '<tr><td colspan="6">名单是空的。</td></tr>'}</tbody></table>`;
    main.querySelectorAll('[data-pin]').forEach(b => b.onclick = async () => { const r = await api.patch(`/api/teacher/students/${b.dataset.pin}`, { resetPin: true }); toast(r.message, 'ok', 5000); draw(); });
    main.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (await confirmBox('删除学生', '这位学生的所有学习记录与报告都会被删除，无法恢复。')) { await api.del(`/api/teacher/students/${b.dataset.del}`); draw(); } });
    main.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
      const s = students.find(x => String(x.id) === b.dataset.edit);
      const bd = el(`<div><label class="field"><span>姓名</span><input class="input" name="n" value="${esc(s.name)}"></label><label class="field"><span>学号</span><input class="input" name="p" value="${esc(s.pupil_no || '')}"></label><p class="desc">保存后这位学生会成为正式名单的一员。</p></div>`);
      modal('修改学生资料', bd, { actions: [{ label: '取消', cls: 'ghost' }, { label: '保存', cls: 'green', onClick: async (x) => { try { await api.patch(`/api/teacher/students/${s.id}`, { name: x.querySelector('[name=n]').value, pupil_no: x.querySelector('[name=p]').value }); draw(); } catch (e) { toast(e.message, 'err'); return false; } } }] });
    });
  };
  await draw();
}

// ------------------------------------------------------------ 设置
async function settings(main, t) {
  const { settings: s } = await api.get('/api/teacher/settings');
  main.innerHTML = `<h1>设置与账户</h1><p class="desc">所有掌握程度名称、分数线与分组标准都可以修改；报告与统计会立即按照新设定计算。</p>
    <form class="t-card" id="sf"><h2>报告资料</h2><div class="row">
      <label class="field grow"><span>学校名称</span><input class="input" name="school_name" value="${esc(s.school_name)}"></label>
      <label class="field grow"><span>教师姓名（印在报告上）</span><input class="input" name="teacher_name" value="${esc(s.teacher_name)}"></label>
      <label class="field"><span>科目</span><input class="input" name="subject" value="${esc(s.subject)}"></label></div>
      <h2>达标与掌握程度</h2><div class="row">
      <label class="field"><span>达标线（%）</span><input class="input" type="number" name="passing" value="${s.passing}" min="0" max="100"></label>
      <label class="field"><span>冲刺及格范围（达标线以下几个百分点）</span><input class="input" type="number" name="near_pass_band" value="${s.near_pass_band}" min="0" max="100"></label></div>
      <p><b>掌握程度等级</b>（由高到低，最低一级必须是 0）</p>
      <div id="levels">${s.mastery_levels.map(l => `<div class="row lv"><input class="input" style="max-width:180px" value="${esc(l.label)}" data-l="label"><span>≥</span><input class="input" type="number" style="max-width:100px" value="${l.min}" data-l="min"><span>%</span></div>`).join('')}</div>
      <button type="button" class="btn small ghost" id="addlv">加一个等级</button>
      <h2 style="margin-top:14px">知识点与学习困难标准</h2><div class="row">
      <label class="field"><span>知识点“掌握良好”≥（%）</span><input class="input" type="number" name="topic_good" value="${s.topic_good}"></label>
      <label class="field"><span>知识点“需要加强”<（%）</span><input class="input" type="number" name="topic_weak" value="${s.topic_weak}"></label>
      <label class="field"><span>学习困难：总分低于（%）</span><input class="input" type="number" name="struggling_percent" value="${s.struggling_percent}"></label>
      <label class="field"><span>或任何知识点低于（%）</span><input class="input" type="number" name="struggling_topic" value="${s.struggling_topic}"></label></div>
      <h2>闯关与评估</h2><div class="row">
      <label class="field"><span>练习关卡过关：首次答对率 ≥（%）</span><input class="input" type="number" name="stage_pass" value="${s.stage_pass}"></label>
      <label class="field"><span>王者认证题数</span><input class="input" type="number" name="assessment_questions" value="${s.assessment_questions}" min="4" max="30"></label>
      <label class="field"><span>多次评估时统计哪一次</span><select class="input" name="attempt_policy">${[['latest', '最新一次'], ['best', '最高一次'], ['first', '第一次']].map(([v, n]) => `<option value="${v}" ${s.attempt_policy === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field"><span>Boss 计时（学生仍可自行关闭）</span><select class="input" name="boss_timer_default"><option value="false" ${!s.boss_timer_default ? 'selected' : ''}>默认关闭</option><option value="true" ${s.boss_timer_default ? 'selected' : ''}>默认开启</option></select></label>
      <label class="field"><span>Boss 每题秒数</span><input class="input" type="number" name="boss_timer_seconds" value="${s.boss_timer_seconds}"></label>
      <label class="field"><span>第 2 关：魔法森林大冒险（Phaser 测试版）</span><select class="input" name="phaser_forest"><option value="true" ${s.phaser_forest !== false ? 'selected' : ''}>开启</option><option value="false" ${s.phaser_forest === false ? 'selected' : ''}>关闭（回到原本的玩法）</option></select></label></div>
      <button class="btn green" type="submit">保存设置</button></form>
    <form class="t-card" id="pw"><h2>修改我的密码</h2><div class="row"><label class="field"><span>现在的密码</span><input class="input" type="password" name="current" autocomplete="current-password"></label>
      <label class="field"><span>新密码（至少 8 个字符）</span><input class="input" type="password" name="next" autocomplete="new-password"></label></div><button class="btn" type="submit">修改密码</button></form>
    ${t.role === 'admin' ? '<div class="t-card" id="tadmin"><h2>教师账户（管理员）</h2><div id="tl"></div><button class="btn small" id="newt">新增教师账户</button></div>' : ''}`;
  main.querySelector('#addlv').onclick = () => main.querySelector('#levels').appendChild(el('<div class="row lv"><input class="input" style="max-width:180px" data-l="label" placeholder="名称"><span>≥</span><input class="input" type="number" style="max-width:100px" data-l="min" value="0"><span>%</span></div>'));
  main.querySelector('#sf').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const o = Object.fromEntries(fd.entries());
    o.boss_timer_default = o.boss_timer_default === 'true';
    o.phaser_forest = o.phaser_forest !== 'false';
    o.mastery_levels = [...main.querySelectorAll('.lv')].map(r => ({ label: r.querySelector('[data-l=label]').value.trim(), min: Number(r.querySelector('[data-l=min]').value) })).filter(l => l.label);
    try { await api.put('/api/teacher/settings', { settings: o }); toast('设置已保存', 'ok'); } catch (ex) { toast(ex.message, 'err'); }
  };
  main.querySelector('#pw').onsubmit = async (e) => {
    e.preventDefault();
    try { await api.post('/api/teacher/password', { current: e.target.current.value, next: e.target.next.value }); toast('密码已修改', 'ok'); e.target.reset(); } catch (ex) { toast(ex.message, 'err'); }
  };
  if (t.role === 'admin') {
    const drawT = async () => {
      const { teachers } = await api.get('/api/teacher/teachers');
      main.querySelector('#tl').innerHTML = `<table class="tbl"><thead><tr><th>用户名</th><th>名称</th><th>角色</th></tr></thead><tbody>${teachers.map(x => `<tr><td>${esc(x.username)}</td><td>${esc(x.display_name)}</td><td>${x.role === 'admin' ? '管理员' : '教师'}</td></tr>`).join('')}</tbody></table>`;
    };
    await drawT();
    main.querySelector('#newt').onclick = () => {
      const b = el('<div><label class="field"><span>用户名（英文字母或数字）</span><input class="input" name="u"></label><label class="field"><span>显示名称</span><input class="input" name="d"></label><label class="field"><span>初始密码（至少 8 个字符）</span><input class="input" name="p" type="password"></label><label class="row"><input type="checkbox" name="a"> 管理员（可查看所有班级）</label></div>');
      modal('新增教师账户', b, { actions: [{ label: '取消', cls: 'ghost' }, { label: '建立', cls: 'green', onClick: async (x) => { try { await api.post('/api/teacher/teachers', { username: x.querySelector('[name=u]').value, display_name: x.querySelector('[name=d]').value, password: x.querySelector('[name=p]').value, role: x.querySelector('[name=a]').checked ? 'admin' : 'teacher' }); drawT(); toast('教师账户已建立', 'ok'); } catch (e) { toast(e.message, 'err'); return false; } } }] });
    };
  }
}
