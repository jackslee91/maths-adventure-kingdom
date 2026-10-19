// 教师教学模式：适合互动白板、投影与 Google Meet 分享屏幕
import { esc, el, toast, loading } from '../ui.js';
import { api } from '../api.js';
import { demoPlayer } from '../demo-player.js';
import { MISCONCEPTIONS } from '/shared/misconceptions.js';
import { evaluate, fmt, OP_SYMBOL, applyOp } from '/shared/math.js';
import { stepErrorVariants } from '/shared/marking.js';
import { mascot } from '../assets/index.js';
import { play, music } from '../audio.js';

let data = null;

export async function renderTeach(app, lessonId) {
  music(false);
  document.body.classList.add('theme-teach');
  app.innerHTML = loading('正在载入教学内容……');
  data = await api.get('/api/teacher/lessons?unit_id=U1-7');
  const lessons = data.lessons;
  app.innerHTML = `<div class="teach">
    <aside class="teach-toc" aria-label="教学目录">
      <h2>单元 1.7 混合运算</h2>
      ${lessons.map(l => `<button data-l="${l.id}"><b>${esc(l.title)}</b><small>${esc(l.source)}</small></button>`).join('')}
      ${data.teacherQuestions.length ? `<hr><h2>老师新增的题目</h2>${data.teacherQuestions.map(q => `<button data-tq="${esc(q.id)}">${esc(q.text.split('\n')[0].slice(0, 26))}<small>${esc(q.id)}</small></button>`).join('')}` : ''}
      <hr><h2>课堂工具</h2>
      <button data-tool="quiz"><b>课堂小测</b><small>全班一起选答案</small></button>
      <button data-tool="timer"><b>倒数计时</b><small>思考或练习时间</small></button>
      <button data-tool="random"><b>随机抽题</b><small>从题库随机出一道</small></button>
      <hr><a class="btn small ghost" href="#/admin" style="width:100%">前往管理中心</a>
      <a class="btn small ghost" href="#/" style="width:100%;margin-top:6px">返回首页</a>
    </aside>
    <main class="teach-main" id="tm"></main>
  </div>`;
  const shell = app.querySelector('.teach');
  const main = app.querySelector('#tm');
  let cleanup = () => {};
  const select = (btn) => { app.querySelectorAll('.teach-toc button').forEach(b => b.classList.toggle('on', b === btn)); };
  app.querySelectorAll('.teach-toc [data-l]').forEach(b => b.onclick = () => { cleanup(); select(b); cleanup = lessonView(main, shell, lessons.find(l => l.id === b.dataset.l), toc); });
  app.querySelectorAll('.teach-toc [data-tq]').forEach(b => b.onclick = () => { cleanup(); select(b); const q = data.teacherQuestions.find(x => x.id === b.dataset.tq); cleanup = lessonView(main, shell, lessonFromQuestion(q), toc); });
  app.querySelectorAll('.teach-toc [data-tool]').forEach(b => b.onclick = () => { cleanup(); select(b); cleanup = ({ quiz: quizView, timer: timerView, random: randomView })[b.dataset.tool](main, shell, toc); });
  function toc() {
    cleanup(); cleanup = () => {};
    select(null);
    main.innerHTML = `<div class="teach-head"><h1>教学目录</h1></div>
      <p>选择一个课节开始讲解。每个课节都按照课本的计算方法逐步演示，可以暂停、回到上一步或重新演示。</p>
      <div class="compare-grid">${lessons.map(l => `<div><b>${esc(l.title)}</b><p style="font-size:15px;font-weight:400;margin:4px 0">${esc(l.source)}</p><button class="btn small" data-go="${l.id}">开始这一课</button></div>`).join('')}</div>
      <div class="guide-panel"><h3>使用建议</h3><ul><li>Google Meet：分享这个分页，按“全屏”让学生看得更清楚。</li><li>互动白板：底部按钮够大，可以直接用手指点。</li><li>快捷键：→ 下一步骤，← 上一步骤，空格 自动播放 / 暂停。</li></ul></div>`;
    main.querySelectorAll('[data-go]').forEach(b => b.onclick = () => app.querySelector(`.teach-toc [data-l="${b.dataset.go}"]`).click());
  }
  const first = lessonId ? app.querySelector(`.teach-toc [data-l="${lessonId}"]`) : null;
  if (first) first.click(); else toc();
  return () => cleanup();
}

function lessonFromQuestion(q) {
  return { id: q.id, title: `${q.id}：${q.text.split('\n')[0].slice(0, 30)}`, source: q.source || '题库', subtopic_id: q.subtopic_id, question: q, expr: q.expr,
    story: q.context === 'word' ? q.text : null, concept: q.explanation, think: q.hint, mistakes: [], guide: null };
}

function mistakeExamples(expr) {
  // 用真实的错误算法算出“错误答案”，让学生看见错在哪里
  if (!expr) return [];
  const ev = evaluate(expr);
  const out = [];
  if (expr.ops.length > 1) {
    const [a, b, c] = expr.nums, [o1, o2] = expr.ops;
    const inner = applyOp(b, o2, c);
    if (!(o2 === '/' && b % c) && Number.isFinite(inner)) {
      const rtl = applyOp(a, o1, inner);
      if (rtl !== ev.final && rtl >= 0) out.push({ code: 'ORDER_RTL', text: `先算 ${fmt(b)} ${OP_SYMBOL[o2]} ${fmt(c)} = ${fmt(inner)}，再算 ${fmt(a)} ${OP_SYMBOL[o1]} ${fmt(inner)} = ${fmt(rtl)}` });
    }
    out.push({ code: 'STOP_HALFWAY', text: `只算了第一步：${fmt(ev.steps[0].a)} ${OP_SYMBOL[ev.steps[0].op]} ${fmt(ev.steps[0].b)} = ${fmt(ev.steps[0].result)}，就当作答案` });
  }
  ev.steps.forEach((st) => {
    for (const v of stepErrorVariants(st.a, st.op, st.b)) {
      if (out.some(o => o.code === v.code)) continue;
      out.push({ code: v.code, text: `${fmt(st.a)} ${OP_SYMBOL[st.op]} ${fmt(st.b)} 算成了 ${fmt(v.value)}（正确是 ${fmt(st.result)}）` });
    }
  });
  if (ev.remainder) out.push({ code: 'REMAINDER_MISSING', text: `只写 ${fmt(ev.final)}，漏写了余数 ${ev.remainder}` });
  return out;
}

function controlsHTML() {
  return `<div class="teach-controls" role="toolbar" aria-label="教学控制">
    <button class="btn orange" data-c="start">开始讲解</button><button class="btn ghost" data-c="show">显示题目</button><button class="btn purple" data-c="hint">显示提示</button>
    <span class="sep"></span><button class="btn ghost" data-c="prev">上一步骤</button><button class="btn green" data-c="next">下一步骤</button><button class="btn ghost" data-c="auto">自动播放</button>
    <span class="sep"></span><button class="btn orange" data-c="reveal">揭晓答案</button><button class="btn red" data-c="mistakes">常见错误</button>
    <button class="btn" data-c="again">再试一道</button><button class="btn ghost" data-c="replay">重新演示</button>
    <span class="sep"></span><button class="btn ghost" data-c="guide">教学指引</button><button class="btn ghost" data-c="fs">全屏</button><button class="btn wood" data-c="toc">返回目录</button>
  </div>`;
}

function lessonView(main, shell, lesson, toc) {
  let player = null;
  let shown = false;
  const q = lesson.question;
  const qText = lesson.story || (q ? q.text : '');
  main.innerHTML = `<div class="teach-head"><h1>${esc(lesson.title)}</h1><span class="pill">${esc(lesson.source)}</span></div>
    <div class="board">
      <div class="q-area"><p class="q-big hidden-q" style="color:#9aa3b5">按“显示题目”给学生看题目。</p></div>
      ${lesson.tables ? `<div class="lesson-tables tables hidden">${lesson.tables.map(t => `<table class="mini-table"><caption>${esc(t.title)}</caption>${t.rows.map((r, i) => `<tr class="${t.highlight?.includes(i) ? 'hl' : ''}"><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>`).join('')}</div>` : ''}
      <div class="think-slot"></div>
      <div class="demo-slot"></div>
      <div class="model-slot"></div>
      <div class="extra-slot"></div>
    </div>
    <div class="mistake-slot"></div>
    <div class="guide-slot"></div>
    ${controlsHTML()}`;
  const $ = (s) => main.querySelector(s);
  const autoBtn = $('[data-c=auto]');
  const showQ = () => {
    shown = true;
    $('.q-area').innerHTML = `<p class="q-big">${esc(qText || (lesson.expr ? `${lesson.expr.nums.map((n, i) => (i ? ` ${OP_SYMBOL[lesson.expr.ops[i - 1]]} ` : '') + fmt(n)).join('')} = ?` : ''))}</p>`;
    $('.tables')?.classList.remove('hidden');
    if (lesson.model?.type === 'bar') {
      const m = lesson.model, total = m.parts.reduce((s, p) => s + p.value, 0);
      $('.model-slot').innerHTML = `<div class="bar-model" aria-label="线段图"><div class="bar">${m.parts.map((p, i) => `<span style="width:${p.value / total * 100}%;background:${i ? '#3b82f6' : '#22c55e'}">${esc(p.label)}</span>`).join('')}</div>
        <div class="bar"><span style="width:${m.remove.value / total * 100}%;background:#ef4444">扣除 ${esc(m.remove.label)}</span><span style="flex:1;background:#fbbf24;color:#1f2937">剩下 ？</span></div></div>`;
    }
  };
  const ensurePlayer = () => {
    if (player || !lesson.expr) return;
    // 纯算式题：演示区本身已显示算式，不必重复
    if (!lesson.story && (!q || q.context !== 'word')) $('.q-area').classList.add('hidden');
    player = demoPlayer(lesson.expr, { answerSentence: lesson.answerSentence, size: 46, onChange: (s) => { autoBtn.textContent = player?.playing ? '暂停' : '自动播放'; if (s.done) play('correct'); } });
    $('.demo-slot').appendChild(player.el);
  };
  const discussion = () => {
    if (!lesson.compare) return;
    const parts = lesson.compare.map(c => `<div><div class="pill">${esc(c.label)}</div>${(c.lines || []).map(l => `<div class="num" style="margin-top:6px">${esc(l)}</div>`).join('') || (c.expr ? `<div class="num" style="margin-top:6px">${esc(evaluate(c.expr).steps.map(s => `${fmt(s.a)} ${OP_SYMBOL[s.op]} ${fmt(s.b)} = ${fmt(s.result)}`).join('，'))}</div>` : '')}</div>`).join('');
    $('.extra-slot').innerHTML = `<div class="compare-grid" style="margin-top:12px">${parts}</div>
      ${lesson.counter ? `<div class="guide-panel"><b>想一想：</b>${esc(lesson.counter.text)}<details style="margin-top:6px"><summary>揭晓</summary>${esc(lesson.counter.answer)}</details></div>` : ''}
      <div class="think-overlay" style="font-size:22px">${esc(lesson.concept)}</div>`;
  };
  const handlers = {
    show: showQ,
    start: () => {
      if (!shown) showQ();
      $('.think-slot').innerHTML = `<div class="think-overlay">${mascot('happy', 70)}<div>${esc(lesson.think || '先想一想，再看老师演示。')}</div><div class="big-timer" id="tt">20</div><button class="btn small ghost" id="skip">不用等，开始讲解</button></div>`;
      let t = 20;
      const iv = setInterval(() => { t--; const e = $('#tt'); if (e) e.textContent = t; if (t <= 0) { clearInterval(iv); go(); } }, 1000);
      const go = () => { clearInterval(iv); $('.think-slot').innerHTML = ''; if (lesson.expr) { ensurePlayer(); player.next(); } else discussion(); };
      $('#skip').onclick = go;
      cleanups.push(() => clearInterval(iv));
    },
    hint: () => toast(lesson.think || q?.hint || lesson.concept, '', 6000),
    next: () => { if (!shown) showQ(); if (lesson.expr) { ensurePlayer(); player.next(); } else discussion(); },
    prev: () => player?.prev(),
    auto: () => { if (!shown) showQ(); ensurePlayer(); if (!player) return; if (player.playing) player.pause(); else player.play(2800); autoBtn.textContent = player.playing ? '暂停' : '自动播放'; },
    reveal: () => { if (!shown) showQ(); if (lesson.expr) { ensurePlayer(); player.end(); } else discussion(); },
    replay: () => { player?.reset(); $('.think-slot').innerHTML = ''; $('.mistake-slot').innerHTML = ''; },
    mistakes: () => {
      const codes = new Set(lesson.mistakes || []);
      const ex = mistakeExamples(lesson.expr);
      const list = ex.length ? ex : [...codes].map(c => ({ code: c, text: '' }));
      $('.mistake-slot').innerHTML = `<div class="mistake-card"><h3>常见错误</h3><ul>${list.map(m => `<li><b>${esc(MISCONCEPTIONS[m.code]?.name || m.code)}</b>${m.text ? `：${esc(m.text)}` : ''}<br><span style="color:#5b6478">${esc(MISCONCEPTIONS[m.code]?.pupil || '')}</span></li>`).join('')}</ul></div>`;
      $('.mistake-slot').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    again: async () => {
      try {
        const r = await api.get(`/api/teacher/teach/similar?subtopic_id=${encodeURIComponent(lesson.subtopic_id)}&exclude=${encodeURIComponent(q?.id || '')}`);
        cleanupAll();
        Object.assign(state, { replaced: lessonView(main, shell, lessonFromQuestion(r.question), toc) });
      } catch (e) { toast(e.message, 'err'); }
    },
    guide: () => {
      const g = lesson.guide;
      const s = $('.guide-slot');
      if (s.innerHTML) { s.innerHTML = ''; return; }
      s.innerHTML = g ? `<div class="guide-panel"><h3>学习目标</h3><ul>${g.objectives.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <h3>预期的错误观念</h3><ul>${g.misconceptions.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <h3>建议的教学策略</h3><ul>${g.strategies.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`
        : `<div class="guide-panel"><h3>解题步骤</h3><ol>${(q?.worked_solution || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol><p>${esc(q?.misconception || '')}</p></div>`;
    },
    fs: () => {
      shell.classList.toggle('fs');
      if (shell.classList.contains('fs')) document.documentElement.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen?.();
    },
    toc: () => toc(),
  };
  const state = {};
  const cleanups = [];
  main.querySelectorAll('[data-c]').forEach(b => b.onclick = () => handlers[b.dataset.c]());
  if (!lesson.expr) { main.querySelector('[data-c=prev]').disabled = true; main.querySelector('[data-c=auto]').disabled = true; }
  const onKey = (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.key === 'ArrowRight') handlers.next(); else if (e.key === 'ArrowLeft') handlers.prev(); else if (e.key === ' ') { e.preventDefault(); handlers.auto(); }
  };
  document.addEventListener('keydown', onKey);
  const cleanupAll = () => { player?.destroy(); cleanups.forEach(f => f()); document.removeEventListener('keydown', onKey); };
  return () => { cleanupAll(); if (typeof state.replaced === 'function') state.replaced(); };
}

// ---------------------------------------------------------- 课堂小测
function quizView(main, shell, toc) {
  const pool = [...data.quizPool].sort(() => Math.random() - 0.5);
  let i = 0;
  const show = () => {
    const q = pool[i % pool.length];
    const choices = [...q.choices].sort(() => Math.random() - 0.5);
    const tally = {};
    main.innerHTML = `<div class="teach-head"><h1>课堂小测</h1><span class="pill">第 ${i + 1} 题</span></div>
      <div class="board quiz-board"><p class="q-big">${esc(q.text.split('\n')[0])}</p>${q.text.split('\n').slice(1).map(l => `<p>${esc(l)}</p>`).join('')}
        <p style="color:#5b6478">请学生举手或在聊天室打字选答案，老师按“+1”记录人数。</p>
        <div class="choices">${choices.map((c, k) => `<div class="choice" data-v="${esc(c.value)}"><b>${'ABCD'[k]}</b><span>${esc(c.text)}</span><span class="tally"><button class="btn small ghost" data-plus="${esc(c.value)}">+1</button><b data-n="${esc(c.value)}">0</b></span></div>`).join('')}</div>
        <div class="extra-slot"></div></div>
      <div class="teach-controls"><button class="btn orange" data-c="reveal">揭晓答案</button><button class="btn" data-c="next">下一题</button><button class="btn ghost" data-c="fs">全屏</button><button class="btn wood" data-c="toc">返回目录</button></div>`;
    main.querySelectorAll('[data-plus]').forEach(b => b.onclick = () => { const v = b.dataset.plus; tally[v] = (tally[v] || 0) + 1; main.querySelector(`[data-n="${CSS.escape(v)}"]`).textContent = tally[v]; play('click'); });
    main.querySelector('[data-c=reveal]').onclick = () => {
      main.querySelectorAll('.choice').forEach(c => c.classList.add(c.dataset.v === q.answer.value ? 'right' : 'wrong'));
      const total = Object.values(tally).reduce((a, b) => a + b, 0);
      const right = tally[q.answer.value] || 0;
      main.querySelector('.extra-slot').innerHTML = `<div class="guide-panel"><b>正确答案：${esc(q.answerText)}</b>${total ? `（${right} / ${total} 位学生答对）` : ''}<ol>${(q.worked_solution || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>`;
      play('correct');
    };
    main.querySelector('[data-c=next]').onclick = () => { i++; show(); };
    main.querySelector('[data-c=fs]').onclick = () => shell.classList.toggle('fs');
    main.querySelector('[data-c=toc]').onclick = () => toc();
  };
  show();
  return () => {};
}

// ---------------------------------------------------------- 倒数计时
function timerView(main, shell, toc) {
  let left = 60, total = 60, iv = null;
  main.innerHTML = `<div class="teach-head"><h1>倒数计时</h1></div><div class="board" style="text-align:center">
    <div class="big-timer" id="bt" style="font-size:140px">01:00</div>
    <div class="row" style="justify-content:center">${[30, 60, 120, 180, 300].map(s => `<button class="btn ghost" data-s="${s}">${s < 60 ? s + ' 秒' : s / 60 + ' 分钟'}</button>`).join('')}
      <label class="row">自订 <input class="input" id="cs" type="number" min="5" max="3600" style="width:110px"> 秒</label></div>
    <p style="color:#5b6478">计时只是课堂工具，不会影响学生的评估成绩。</p></div>
    <div class="teach-controls"><button class="btn green" data-c="go">开始</button><button class="btn ghost" data-c="pause">暂停</button><button class="btn ghost" data-c="reset">重设</button><button class="btn ghost" data-c="fs">全屏</button><button class="btn wood" data-c="toc">返回目录</button></div>`;
  const bt = main.querySelector('#bt');
  const draw = () => { bt.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`; bt.style.color = left <= 10 ? '#d64545' : ''; };
  const stop = () => { clearInterval(iv); iv = null; };
  main.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { stop(); left = total = Number(b.dataset.s); draw(); });
  main.querySelector('#cs').onchange = (e) => { stop(); left = total = Math.max(5, Math.min(3600, Number(e.target.value) || 60)); draw(); };
  main.querySelector('[data-c=go]').onclick = () => { if (iv) return; iv = setInterval(() => { left--; draw(); if (left <= 0) { stop(); play('level'); toast('时间到！', 'warn'); } }, 1000); };
  main.querySelector('[data-c=pause]').onclick = stop;
  main.querySelector('[data-c=reset]').onclick = () => { stop(); left = total; draw(); };
  main.querySelector('[data-c=fs]').onclick = () => shell.classList.toggle('fs');
  main.querySelector('[data-c=toc]').onclick = () => toc();
  draw();
  return stop;
}

// ---------------------------------------------------------- 随机抽题
function randomView(main, shell, toc) {
  let inner = () => {};
  const subs = ['U1-7-1', 'U1-7-2'];
  (async () => {
    try {
      const r = await api.get(`/api/teacher/teach/similar?subtopic_id=${subs[Math.floor(Math.random() * 2)]}`);
      inner = lessonView(main, shell, lessonFromQuestion(r.question), toc);
    } catch (e) { main.innerHTML = `<p class="error-text">${esc(e.message)}</p>`; }
  })();
  return () => inner();
}
