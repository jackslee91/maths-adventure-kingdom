// 第六关：数学王者认证（正式评估）——无提示、不能重答、服务器批改
import { esc, el, toast, loading, confirmBox, ActiveTimer } from '../ui.js';
import { sapi } from '../api.js';
import { mascot, chest, medal, setPageScene } from '../assets/index.js';
import { questionTextHTML, answerView } from '../question-view.js';
import { requireLogin, topbar, bindTopbar, prefs, celebrate } from './common.js';
import { play, music } from '../audio.js';

const backupKey = (id) => `ma_exam_${id}`;
const saveBackup = (id, data) => { try { localStorage.setItem(backupKey(id), JSON.stringify(data)); } catch { /* 忽略 */ } };
const loadBackup = (id) => { try { return JSON.parse(localStorage.getItem(backupKey(id)) || 'null'); } catch { return null; } };
const dropBackup = (id) => { try { localStorage.removeItem(backupKey(id)); } catch { /* 忽略 */ } };

export async function renderExam(app, unitId, quizId) {
  if (!requireLogin()) return;
  document.body.classList.add('theme-game');
  setPageScene('bg.exam');
  music(false);
  const back = quizId ? '#/student' : `#/student/map/${encodeURIComponent(unitId)}`;
  app.innerHTML = `<div class="game-page">${topbar({ back, backLabel: quizId ? '背包' : '地图', title: '数学王者认证' })}<div id="exam-root"></div></div>`;
  bindTopbar(app);
  const root = app.querySelector('#exam-root');

  // 开始前说明
  root.innerHTML = `<section class="parchment result-card">${chest(false, 90)}<h2 style="color:var(--berry)">数学王者认证</h2>
    <p>这是正式评估：<b>没有提示，也不能重答</b>，每题按固定方式评分。做完后按“提交”，老师就会收到你的学习记录。</p>
    <p>不用着急，可以先做会做的题，再回来做其他题。中途离开也没关系，答案会自动保存。</p>
    <div class="row" style="justify-content:center"><a class="btn wood" href="${back}">还没准备好</a><button class="btn purple big" id="go">开始认证</button></div></section>`;
  await new Promise(r => { root.querySelector('#go').onclick = r; });
  root.innerHTML = loading('正在准备认证题目……');
  let sess;
  try { sess = await sapi.post('/api/student/assessments/start', { unit_id: unitId, quiz_id: quizId }); }
  catch (e) {
    if (e.status === 401) { location.hash = '#/student/login'; return; }
    root.innerHTML = `<div class="parchment"><p class="error-text">${esc(e.message)}</p><a class="btn" href="${back}">返回</a></div>`;
    return;
  }
  const timer = new ActiveTimer();
  const local = loadBackup(sess.sessionId);
  const answers = { ...(sess.draft?.answers || {}), ...(local?.answers || {}) };
  const baseSeconds = Math.max(sess.draft?.active_seconds || 0, local?.active_seconds || 0);
  let cur = Math.min(sess.draft?.current || 0, sess.questions.length - 1);
  let views = {};
  let saveTimer = null;
  const activeSeconds = () => baseSeconds + timer.seconds();
  const persist = () => {
    saveBackup(sess.sessionId, { answers, active_seconds: activeSeconds() });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => sapi.put(`/api/student/assessments/${sess.sessionId}/draft`, { answers, active_seconds: activeSeconds(), current: cur }).catch(() => {}), 1200);
  };
  const isAnswered = (q) => { const a = answers[q.id]; return a && Object.values(a).some(v => (Array.isArray(v) ? v.some(Boolean) : v !== '' && v !== null && v !== undefined)); };

  root.innerHTML = `${sess.resumed ? '<p class="toast warn" style="position:static;margin-bottom:10px">已恢复你上次的作答，可以继续完成。</p>' : ''}
    <section class="parchment">
      <div class="play-head"><span class="wood-title">${esc(sess.title)}</span><span class="chip">共 ${sess.questions.length} 题</span><span class="spacer" style="flex:1"></span><button class="btn purple" id="submit">提交认证</button></div>
      <nav class="exam-nav" aria-label="题号"></nav>
      <div id="eq"></div>
      <div class="q-actions"><button class="btn ghost" id="prev">上一题</button><button class="btn orange" id="next">下一题</button></div>
      <p class="rubric">${esc(sess.rubric)}</p>
      <div id="submit-state"></div>
    </section>`;
  const nav = root.querySelector('.exam-nav');
  const eq = root.querySelector('#eq');
  const drawNav = () => {
    nav.innerHTML = sess.questions.map((q, i) => `<button class="${isAnswered(q) ? 'answered' : ''} ${i === cur ? 'cur' : ''}" data-i="${i}" aria-label="第 ${i + 1} 题${isAnswered(q) ? '（已作答）' : ''}">${i + 1}</button>`).join('');
    nav.querySelectorAll('button').forEach(b => b.onclick = () => show(Number(b.dataset.i)));
  };
  const capture = () => { const q = sess.questions[cur]; if (views[q.id]) { answers[q.id] = views[q.id].getResponse(); persist(); } };
  function show(i) {
    capture();
    cur = i;
    const q = sess.questions[i];
    eq.innerHTML = `<div class="qcard" data-qid="${esc(q.id)}"><div class="q-meta"><span class="tag">第 ${i + 1} 题</span><span class="tag">${q.marks} 分</span></div>${questionTextHTML(q)}<div class="slot"></div></div>`;
    const av = answerView(q, { keypad: prefs().keypad, saved: answers[q.id] });
    views = { [q.id]: av };
    eq.querySelector('.slot').appendChild(av.el);
    av.el.addEventListener('input', () => { capture(); drawNav(); });
    av.el.addEventListener('click', () => setTimeout(() => { capture(); drawNav(); }, 0));
    av.onEnter(() => { if (cur < sess.questions.length - 1) show(cur + 1); });
    root.querySelector('#prev').disabled = i === 0;
    root.querySelector('#next').disabled = i === sess.questions.length - 1;
    drawNav();
    av.focus();
  }
  root.querySelector('#prev').onclick = () => show(cur - 1);
  root.querySelector('#next').onclick = () => show(cur + 1);
  show(cur);

  const state = root.querySelector('#submit-state');
  const submitBtn = root.querySelector('#submit');
  let submitting = false;
  async function submit() {
    if (submitting) return;
    capture();
    const blank = sess.questions.filter(q => !isAnswered(q)).length;
    if (blank && !(await confirmBox('还有题目没作答', `还有 ${blank} 题没有作答。没作答的题会得 0 分，确定要提交吗？`, '确定提交', 'purple'))) return;
    submitting = true;
    submitBtn.disabled = true;
    state.innerHTML = '<div class="submit-state wait"><span class="spinner"></span> 正在提交，请不要关闭页面……</div>';
    try {
      const r = await sapi.post(`/api/student/assessments/${sess.sessionId}/submit`, { answers, active_seconds: activeSeconds() });
      clearTimeout(saveTimer);
      dropBackup(sess.sessionId);
      timer.stop();
      play('victory');
      celebrate(80);
      setPageScene('bg.victory');
      root.innerHTML = `<section class="parchment result-card"><div class="row" style="justify-content:center;align-items:flex-end">${mascot('wow', 120)}${r.topLevel ? medal('数学王者', 130) : ''}</div>
        <h2>恭喜你完成认证！</h2>
        <p>掌握程度：<b>${esc(r.mastery)}</b></p>
        <div class="submit-state ok" role="status">✅ 提交成功！老师已收到你的学习记录。</div>
        <div class="result-stats"><div><b class="num">${r.correct} / ${r.total}</b>答对题数</div><div><b class="num">${r.score} / ${r.maxScore}</b>得分</div><div><b class="num">${r.percentage}%</b>正确率</div></div>
        <div class="row" style="justify-content:center"><a class="btn orange big" href="#/student/report/${r.assessmentId}">查看学习报告</a><a class="btn wood" href="${back}">返回</a></div></section>`;
    } catch (e) {
      submitting = false;
      submitBtn.disabled = false;
      state.innerHTML = `<div class="submit-state err" role="alert">❌ 提交没有成功：${esc(e.message)}<br>你的答案已经保存在这台电脑上，不会不见。请检查网络，再按“重新提交”。
        <div class="q-actions"><button class="btn purple" id="resubmit">重新提交</button></div></div>`;
      state.querySelector('#resubmit').onclick = submit;
    }
  }
  submitBtn.onclick = submit;
  return () => { clearTimeout(saveTimer); timer.stop(); };
}
