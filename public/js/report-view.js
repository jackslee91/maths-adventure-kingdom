// A4 报告的网页版本（预览与打印），内容与服务器 PDF 相同
import { esc } from './ui.js';
import { barChart, hBars, donut } from './charts.js';

const lbClass = (l) => (l === '掌握良好' ? 'good' : l === '需要加强' ? 'bad' : 'mid');

export function individualReportHTML(r, { editable = false } = {}) {
  const o = r.overall;
  return `<article class="a4" lang="zh-CN">
    <header class="a4-title"><h1>${esc(r.title)}</h1><p>${esc(r.school || '')}${r.isDemo ? '（示范数据）' : ''}</p></header>
    <h2>一、学生基本资料</h2>
    <table class="kv"><tr><th>学生姓名</th><td>${esc(r.student.name)}</td><th>班级</th><td>${esc(r.student.className)}</td></tr>
      <tr><th>学习日期</th><td>${esc(r.date)}</td><th>评估主题</th><td>${esc(r.topic)}</td></tr>
      <tr><th>学号</th><td>${esc(r.student.pupilNo || '—')}</td><th>评估次数</th><td>第 ${r.attemptNo} 次</td></tr></table>
    <h2>二、整体学习表现</h2>
    <div class="stats">
      ${[['题目总数', o.total], ['答对题数', o.correct], ['总分', o.maxScore], ['得分', o.score], ['正确率（得分率）', `${o.percentage}%`], ['完成关卡', o.stagesText], ['评估用时', o.duration], ['掌握程度', o.mastery]]
        .map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}
    </div>
    <p class="muted">练习时间：${esc(o.practiceTime)}；练习中使用提示 ${o.hintsUsed} 次、重答 ${o.retries} 次（练习记录不计入评估分数）。</p>
    <h2>三、各知识点表现</h2>
    <table class="grid"><thead><tr><th>知识点</th><th>题数</th><th>答对</th><th>得分率</th><th>掌握情况</th></tr></thead>
      <tbody>${r.topics.map(t => `<tr><td>${esc(t.title)}</td><td class="c">${t.count}</td><td class="c">${t.correct}</td><td class="c">${t.accuracy}%</td><td class="c ${lbClass(t.label)}">${esc(t.label)}</td></tr>`).join('')}</tbody></table>
    <h2>四、学习强项</h2><ul>${r.strengths.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    <h2>五、需要加强的知识点</h2><ul>${r.weaknesses.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    <h2>六、常见错误分析</h2>
    ${r.errors.length ? `<table class="grid"><thead><tr><th style="width:22%">错误类型</th><th style="width:8%">题数</th><th>实例（学生答案 → 正确答案）</th></tr></thead><tbody>
      ${r.errors.map(e => `<tr><td>${esc(e.name)}</td><td class="c">${e.count}</td><td>${e.examples.map(x => `<div class="ex">${esc(x.text)}<br><span class="muted">学生：</span>${esc(x.student)} → <span class="muted">正确：</span>${esc(x.correct)}（${esc(x.marks)} 分）</div>`).join('')}${e.explain ? `<div class="muted">说明：${esc(e.explain)}</div>` : ''}</td></tr>`).join('')}
    </tbody></table>` : '<p>本次评估没有答错的题目。</p>'}
    <h2>七、个性化复习建议</h2><ul>${r.recommendations.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    <h2>八、教师评语</h2>
    ${editable ? `<textarea class="input comment-edit" maxlength="1000" placeholder="在这里写评语，按“保存评语”后会出现在报告与 PDF 中。">${esc(r.teacherComment)}</textarea>` : `<div class="writebox">${esc(r.teacherComment) || '<span class="lines"></span>'}</div>`}
    <h2>九、家长签阅</h2>
    <div class="signs"><div>家长签名：<span></span></div><div>日期：<span></span></div></div>
    <h2 class="page-break-before">附录：评估逐题记录</h2>
    <table class="grid small"><thead><tr><th>题号</th><th>题目</th><th>学生答案</th><th>正确答案</th><th>得分</th></tr></thead>
      <tbody>${r.questions.map(q => `<tr><td class="c">${q.no}</td><td>${esc(q.text)}</td><td>${esc(q.student)}</td><td>${esc(q.correct)}</td><td class="c ${q.ok ? 'good' : 'bad'}">${q.marks}/${q.max}</td></tr>`).join('')}</tbody></table>
  </article>`;
}

export function classReportHTML(r, { editable = false } = {}) {
  const s = r.summary, info = r.info, n = r.notes || {};
  const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);
  const st = r.students;
  const doneN = st.filter(x => x.status === '已完成').length, prog = st.filter(x => x.status.startsWith('进行中')).length;
  const field = (k, label, rows = 2) => editable ? `<textarea class="input note" data-k="${k}" rows="${rows}" aria-label="${label}">${esc(n[k] || '')}</textarea>` : `<div class="writebox">${esc(n[k] || '')}</div>`;
  return `<article class="a4" lang="zh-CN">
    <header class="a4-title"><h1>${esc(r.title)}</h1><p>${esc(info.school || '')}　${esc(info.className)}</p></header>
    <h2>一、基本资料</h2>
    <table class="kv"><tr><th>学校名称</th><td>${esc(info.school || '—')}</td><th>班级</th><td>${esc(info.className)}</td></tr>
      <tr><th>科目</th><td>${esc(info.subject)}</td><th>教师姓名</th><td>${esc(info.teacherName || '—')}</td></tr>
      <tr><th>评估主题</th><td>${esc(info.topic)}</td><th>评估日期</th><td>${esc(info.period)}</td></tr>
      <tr><th>全班人数</th><td>${info.rosterCount} 人</td><th>已完成评估人数</th><td>${info.doneCount} 人</td></tr></table>
    <p class="muted">统计说明：${esc(info.policy)}的正式评估记录；未提交的学生不计入平均分，也不当作 0 分。</p>
    <h2>二、全班整体表现</h2>
    <div class="stats">${[['全班平均分（得分率）', pct(s.average)], ['最高分', pct(s.highest)], ['最低分', pct(s.lowest)], ['完成率', `${s.completionRate}%`],
      [`达标人数（≥${s.passing}%）`, `${s.passedCount} 人`], ['达标百分比', `${s.passRate}%`], ['未达标人数', `${s.notPassedCount} 人`], ['未提交人数', `${s.notSubmitted} 人`]].map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>
    <h2>三、学生成绩记录</h2>
    <table class="grid"><thead><tr><th>序号</th><th>学生姓名</th><th>得分</th><th>百分比</th><th>掌握程度</th><th>完成情况</th></tr></thead>
      <tbody>${st.map(x => `<tr><td class="c">${x.no}</td><td>${esc(x.name)}</td><td class="c">${x.score === null ? '—' : `${x.score}/${x.max}`}</td><td class="c ${x.passed === false ? 'bad' : ''}">${x.percentage === null ? '—' : x.percentage + '%'}</td><td class="c">${esc(x.mastery)}</td><td class="c ${x.status === '已完成' ? 'good' : 'mid'}">${esc(x.status)}</td></tr>`).join('')}</tbody></table>
    <h2>四、知识点掌握分析</h2>
    ${r.topics.length ? `<table class="grid"><thead><tr><th>知识点</th><th>作答题次</th><th>答对</th><th>掌握百分比</th><th>结论</th></tr></thead>
      <tbody>${r.topics.map(t => `<tr><td>${esc(t.title)}</td><td class="c">${t.items}</td><td class="c">${t.correct}</td><td class="c">${t.accuracy}%</td><td class="c ${lbClass(t.label)}">${esc(t.label)}</td></tr>`).join('')}</tbody></table>
      <ul><li><b>掌握良好的知识点：</b>${esc(r.topics.filter(t => t.label === '掌握良好').map(t => `${t.title}（${t.accuracy}%）`).join('；') || '暂无')}</li>
      <li><b>需要加强的知识点：</b>${esc(r.topics.filter(t => t.label !== '掌握良好').map(t => `${t.title}（${t.accuracy}%）`).join('；') || '暂无')}</li></ul>
      ${r.errors.length ? `<h3>常见错误</h3><table class="grid small"><thead><tr><th>错误类型</th><th>出现次数</th><th>涉及人数</th><th>说明</th></tr></thead><tbody>${r.errors.map(e => `<tr><td>${esc(e.name)}</td><td class="c">${e.count}</td><td class="c">${e.students}</td><td>${esc(e.teacher)}</td></tr>`).join('')}</tbody></table>` : ''}`
    : '<p>暂时没有已提交的评估，无法分析。</p>'}
    <h2>五、学习表现图表</h2>
    <div class="charts">
      ${s.average !== null ? `<figure><figcaption>成绩分布图（人数）</figcaption>${barChart({ labels: r.bins.map(b => b.label + '%'), values: r.bins.map(b => b.count), max: 4, colors: r.bins.map(b => (b.lo >= s.passing ? '#3b82f6' : '#f59e0b')), title: '成绩分布图' })}</figure>
      <figure><figcaption>知识点掌握率</figcaption>${hBars(r.topics.map(t => ({ label: t.title, value: t.accuracy })), { good: r.settings.topic_good, weak: r.settings.topic_weak })}</figure>` : ''}
      <figure><figcaption>学习完成情况</figcaption><div class="row">${donut([{ value: doneN, color: '#22c55e' }, { value: prog, color: '#f59e0b' }, { value: st.length - doneN - prog, color: '#9ca3af' }], { label: `${s.completionRate}%` })}
        <ul class="legend"><li><i style="background:#22c55e"></i>已完成 ${doneN} 人</li><li><i style="background:#f59e0b"></i>进行中 ${prog} 人</li><li><i style="background:#9ca3af"></i>未提交 ${st.length - doneN - prog} 人</li></ul></div></figure>
      ${r.skills.length ? `<figure><figcaption>不同技能的正确率</figcaption>${hBars(r.skills.slice(0, 12).map(g => ({ label: `${g.tag}（${g.n}）`, value: g.accuracy })), { good: r.settings.topic_good, weak: r.settings.topic_weak })}</figure>` : ''}
    </div>
    <h2>六、补救教学与提升计划</h2>
    <table class="grid small"><thead><tr><th>组别</th><th>标准</th><th>学生（最弱知识点）</th></tr></thead><tbody>
      <tr><td>基础补救组</td><td>低于 ${r.settings.nearLow}%</td><td>${r.groups.basic.map(x => `${esc(x.name)} ${x.percentage}%${x.weakest ? '：' + esc(x.weakest) : ''}`).join('<br>') || '无'}</td></tr>
      <tr><td>冲刺及格组</td><td>${r.settings.nearLow}% – ${r.settings.passing}% 以下</td><td>${r.groups.nearPass.map(x => `${esc(x.name)} ${x.percentage}%${x.weakest ? '：' + esc(x.weakest) : ''}`).join('<br>') || '无'}</td></tr>
      <tr><td>巩固提升组</td><td>${r.settings.passing}% 或以上</td><td>${r.groups.consolidate.map(x => `${esc(x.name)} ${x.percentage}%`).join('、') || '无'}</td></tr></tbody></table>
    <ul><li>基础补救组：用课本例题重新示范，进行引导练习（第二关解题训练营与补救小站）。</li>
      <li>冲刺及格组：针对最弱知识点做重点复习，再进行一次王者认证。</li>
      <li>巩固提升组：提供多步思考的挑战题${r.enrichment.length ? `（${esc(r.enrichment.join('、'))}）` : ''}，并请他们向同学解说解题步骤。</li>
      ${r.remedial.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    ${r.struggling.length ? `<h3>学习困难学生名单（依老师设定的标准）</h3><table class="grid small"><thead><tr><th>学生</th><th>原因</th></tr></thead><tbody>${r.struggling.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.reasons.join('；'))}</td></tr>`).join('')}</tbody></table>` : ''}
    <h2>七、后续行动计划</h2>
    <table class="kv plan">${[['measures', '改进措施'], ['method', '辅导方式'], ['owner', '负责教师'], ['when', '实施日期'], ['goal', '预期目标'], ['followup', '跟进情况']].map(([k, l]) => `<tr><th>${l}</th><td>${field(k, l)}</td></tr>`).join('')}</table>
    <h2>八、教师总结</h2>${field('summary', '教师总结', 5)}
    <h2>九、报告确认</h2>
    <table class="kv"><tr><th>报告教师</th><td>${editable ? `<input class="input note" data-k="reporter" value="${esc(n.reporter || info.teacherName || '')}">` : esc(n.reporter || info.teacherName || '')}</td><th>审阅者</th><td>${editable ? `<input class="input note" data-k="reviewer" value="${esc(n.reviewer || '')}">` : esc(n.reviewer || '')}</td></tr>
      <tr><th>日期</th><td>${editable ? `<input class="input note" data-k="confirmDate" value="${esc(n.confirmDate || '')}" placeholder="例如：2026年10月20日">` : esc(n.confirmDate || '')}</td><th>签名</th><td class="signcell"></td></tr></table>
  </article>`;
}
