// 学生主页：单元、老师布置的任务、我的报告、徽章
import { esc, loading, fmtTime } from '../ui.js';
import { sapi } from '../api.js';
import { badge, mascot, setPageScene } from '../assets/index.js';
import { BADGES_ALL } from './badges.js';
import { requireLogin, topbar, bindTopbar } from './common.js';
import { music } from '../audio.js';

export async function renderHub(app) {
  if (!requireLogin()) return;
  document.body.classList.add('theme-game');
  setPageScene('bg.hub');
  music(true, 'map');
  app.innerHTML = `<div class="game-page">${topbar({ back: '#/', backLabel: '首页' })}${loading('正在打开冒险背包……')}</div>`;
  let units, quizzes, reports;
  try {
    [units, quizzes, reports] = await Promise.all([sapi.get('/api/student/units'), sapi.get('/api/student/quizzes'), sapi.get('/api/student/reports')]);
  } catch (e) {
    if (e.status === 401) { location.hash = '#/student/login'; return; }
    throw e;
  }
  const earned = new Set(units.units.flatMap(u => u.progress.badges.map(b => b.key)));
  app.innerHTML = `<div class="game-page">${topbar({ back: '#/', backLabel: '首页', xp: units.xp })}
    <div class="hub-grid">
      <section class="parchment">
        <div class="guide-bubble">${mascot('happy', 80)}<div class="bubble">选择一个单元，开始闯关吧！每一关都要先学会，再挑战。</div></div>
        ${units.units.map(u => `<article class="unit-card" style="margin-top:16px">
          <h2>单元 ${esc(u.code)}　${esc(u.title)}</h2>
          <ul class="subtopic-list">${(u.subtopics || []).map(s => `<li><b>${esc(s.code)}</b>${esc(s.title)}</li>`).join('')}</ul>
          <div class="mini-progress" aria-label="关卡进度">${u.progress.stages.map(s => `<span class="${s.completed ? 'done' : s.unlocked ? 'open' : ''}" title="${esc(s.name)}">${s.stage}</span>`).join('')}</div>
          <a class="btn orange big" href="#/student/map/${encodeURIComponent(u.id)}">${u.progress.stages.some(s => s.completed) ? '继续冒险' : '开始冒险'}</a>
        </article>`).join('') || '<p>老师还没有开放任何单元。</p>'}
      </section>
      <aside class="side-stack">
        <section class="parchment"><h3 style="margin-top:0">老师布置的任务</h3>
          ${quizzes.quizzes.length ? `<ul class="list-plain">${quizzes.quizzes.map(q => `<li><span><b>${esc(q.title)}</b><br><small>${q.mode === 'formal' ? '正式评估' : '练习'} · ${q.count} 题${q.due_date ? ` · ${esc(q.due_date)} 前完成` : ''}</small></span>
            ${q.mode === 'formal' && q.submitted ? '<span class="tag">已提交</span>' : `<a class="btn small ${q.mode === 'formal' ? 'purple' : 'green'}" href="${q.mode === 'formal' ? `#/student/exam/${encodeURIComponent(q.unit_id)}/${q.id}` : `#/student/quiz/${q.id}/${encodeURIComponent(q.unit_id)}`}">开始</a>`}</li>`).join('')}</ul>` : '<p>目前没有新任务。</p>'}
        </section>
        <section class="parchment"><h3 style="margin-top:0">我的学习报告</h3>
          ${reports.reports.length ? `<ul class="list-plain">${reports.reports.map(r => `<li><span>${esc(r.title)}（第 ${r.attempt_no} 次）<br><small>${fmtTime(r.submitted_at)} · 得分率 ${Number(r.percentage)}%</small></span><a class="btn small" href="#/student/report/${r.id}">查看</a></li>`).join('')}</ul>` : '<p>完成第六关“数学王者认证”后，这里会出现你的学习报告。</p>'}
        </section>
        <section class="parchment"><h3 style="margin-top:0">我的徽章</h3>
          <div class="badges">${Object.entries(BADGES_ALL).map(([k, b]) => badge(k, b.name, earned.has(k))).join('')}</div>
        </section>
      </aside>
    </div></div>`;
  bindTopbar(app);
}
