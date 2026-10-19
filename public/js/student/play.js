// 关卡游戏：第一关讲解、第二/三关练习、补救小站、宝箱、第四关迷宫、第五关 Boss
import { esc, el, toast, modal, loading, ActiveTimer } from '../ui.js';
import { sapi } from '../api.js';
import { mascot, explorer, partner, starBurst, setHero, coin, boss as bossArt, door, chest, keyItem, stars, badge, heart, scene, setPageScene, playEffect, celebrateBurst, hasAsset, preload } from '../assets/index.js';
import { questionTextHTML, answerView, solutionHTML } from '../question-view.js';
import { demoPlayer } from '../demo-player.js';
import { requireLogin, topbar, bindTopbar, prefs, celebrate, DIFF } from './common.js';
import { play, music } from '../audio.js';

const SUB_NAME = { 'U1-7-1': '加减混合', 'U1-7-2': '乘除混合' };
const PRAISE = ['答对了！你真棒！', '太厉害了！', '完全正确！继续加油！', '漂亮！一步一步算得很清楚！', '答对了！数学王国为你欢呼！'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export async function renderPlay(app, unitId, stage, kind = 'stage', quizId = null) {
  if (!requireLogin()) return;
  const timer = new ActiveTimer();
  document.body.classList.add(stage === 5 && kind === 'stage' ? 'theme-boss' : stage === 4 && kind === 'stage' ? 'theme-maze' : 'theme-game');
  // 迷宫与 Boss：整页用较暗的同一张场景图，关卡区域里再显示清楚的场景
  setPageScene(kind === 'stage' && stage === 4 ? 'bg.maze' : kind === 'stage' && stage === 5 ? 'bg.boss' : 'bg.play');
  music(true, kind === 'stage' && stage === 5 ? 'boss' : kind === 'stage' && stage === 4 ? 'maze' : 'map');
  app.innerHTML = `<div class="game-page">${topbar({ back: `#/student/map/${encodeURIComponent(unitId)}`, backLabel: '地图' })}${loading('正在准备关卡……')}</div>`;
  let run;
  try {
    run = await sapi.post('/api/student/runs', { unit_id: unitId, stage, kind, quiz_id: quizId });
  } catch (e) {
    if (e.status === 401) { location.hash = '#/student/login'; return; }
    app.querySelector('.loading').outerHTML = `<div class="parchment"><p class="error-text">${esc(e.message)}</p><a class="btn" href="#/student/map/${encodeURIComponent(unitId)}">返回地图</a></div>`;
    bindTopbar(app);
    return;
  }
  const title = kind === 'remedial' ? '补救小站' : kind === 'bonus' ? '宝箱挑战' : kind === 'quiz' ? run.stageName : `第 ${stage} 关：${run.stageName}`;
  app.innerHTML = `<div class="game-page">${topbar({ back: kind === 'quiz' ? '#/student' : `#/student/map/${encodeURIComponent(unitId)}`, backLabel: kind === 'quiz' ? '背包' : '地图', title })}<div id="stage-root"></div></div>`;
  bindTopbar(app);
  const root = app.querySelector('#stage-root');
  const ctx = { app, root, run, unitId, stage, kind, timer, destroyed: false, cleanups: [] };

  (async () => {
    if (kind === 'stage' && stage === 1) await lessonFlow(ctx, run.lessons || []);
    if (kind === 'remedial' && run.lessons?.length) await lessonFlow(ctx, run.lessons, true);
    if (ctx.destroyed) return;
    if (kind === 'stage' && stage === 4) await mazeFlow(ctx);
    else if (kind === 'stage' && stage === 5) await bossFlow(ctx);
    else await practiceFlow(ctx);
    if (!ctx.destroyed) await finish(ctx);
  })().catch((e) => { console.error('关卡出错', e); if (!ctx.destroyed) toast(e.message, 'err', 6000); });

  return () => { ctx.destroyed = true; ctx.cleanups.forEach(f => f()); timer.stop(); };
}

// ------------------------------------------------------------ 第一关：讲解
function lessonFlow(ctx, lessons, remedial = false) {
  return new Promise((resolve) => {
    const list = lessons.filter(l => l.expr);
    let li = 0;
    const show = () => {
      if (li >= list.length) { resolve(); return; }
      const L = list[li];
      ctx.root.innerHTML = `<section class="parchment lesson-card">
        <div class="play-head"><span class="wood-title">${remedial ? '补救小站：再看一次例题' : `例题讲解 ${li + 1} / ${list.length}`}</span><span class="tag">${esc(L.source)}</span></div>
        <h2 style="margin:6px 0">${esc(L.title)}</h2>
        ${L.story ? `<p class="story">${esc(L.story)}</p>` : ''}
        ${L.tables ? `<div class="lesson-tables">${L.tables.map(t => `<table class="mini-table"><caption>${esc(t.title)}</caption>${t.rows.map((r, i) => `<tr class="${t.highlight?.includes(i) ? 'hl' : ''}"><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>`).join('')}</div>` : ''}
        <div class="guide-bubble">${mascot('happy', 70)}<div class="bubble">${esc(L.think || L.concept)}</div></div>
        <div class="demo-slot"></div>
        <div class="q-actions"><button class="btn ghost" data-a="prev">上一步骤</button><button class="btn orange" data-a="next">下一步骤</button>
          <button class="btn ghost" data-a="auto">自动播放</button><button class="btn ghost" data-a="replay">重新演示</button>
          <span class="grow"></span><button class="btn green" data-a="done" disabled>我看懂了</button></div>
        <div class="concept hint-box hidden"><b>重点：</b>${esc(L.concept)}</div>
      </section>`;
      const doneBtn = ctx.root.querySelector('[data-a=done]');
      const autoBtn = ctx.root.querySelector('[data-a=auto]');
      let p = null;
      p = demoPlayer(L.expr, { answerSentence: L.answerSentence, onChange: (s) => {
        if (s.done) { doneBtn.disabled = false; ctx.root.querySelector('.concept').classList.remove('hidden'); play('correct'); }
        autoBtn.textContent = p?.playing ? '暂停' : '自动播放';
      } });
      ctx.cleanups.push(() => p.destroy());
      ctx.root.querySelector('.demo-slot').appendChild(p.el);
      ctx.root.querySelector('[data-a=next]').onclick = () => p.next();
      ctx.root.querySelector('[data-a=prev]').onclick = () => p.prev();
      ctx.root.querySelector('[data-a=replay]').onclick = () => p.reset();
      autoBtn.onclick = () => { if (p.playing) p.pause(); else p.play(); autoBtn.textContent = p.playing ? '暂停' : '自动播放'; };
      doneBtn.onclick = () => { p.destroy(); li++; show(); };
    };
    if (!list.length) resolve(); else show();
  });
}

// ------------------------------------------------------------ 作答核心
/**
 * 显示一道题，等到答对（或练习模式下两次答错后继续）。
 * opts.mustBeCorrect：迷宫与 Boss 必须答对才能前进
 * hooks.onResult(res)：每次作答结果
 */
function askQuestion(ctx, q, container, { label = '', mustBeCorrect = false, onResult, hideSolutionUntilDone = false } = {}) {
  return new Promise((resolve) => {
    let hints = 0, tries = 0, finished = false, support = null;
    const card = el(`<section class="parchment qcard" data-qid="${esc(q.id)}">
      <div class="q-meta"><span class="tag">${esc(label)}</span>${q.subtopic_id ? `<span class="tag">${esc(SUB_NAME[q.subtopic_id] || '')}</span>` : ''}<span class="tag d${q.difficulty}">${DIFF[q.difficulty] || ''}</span>${q.enrichment ? '<span class="tag d3">挑战题</span>' : ''}</div>
      ${questionTextHTML(q)}
      <div class="ans-slot"></div>
      <div class="hint-slot"></div>
      <div class="q-actions"><button class="btn purple" data-a="hint">获取提示</button><button class="btn green big" data-a="submit">提交答案</button></div>
      <div class="fb-slot"></div>
    </section>`);
    container.innerHTML = '';
    container.appendChild(card);
    react(ctx, 'idle', 'idle');
    const av = answerView(q, { keypad: prefs().keypad });
    card.querySelector('.ans-slot').appendChild(av.el);
    av.focus();
    const hintBtn = card.querySelector('[data-a=hint]');
    const submitBtn = card.querySelector('[data-a=submit]');
    if (!q.hint) hintBtn.classList.add('hidden');
    hintBtn.onclick = () => {
      hints++;
      play('hint');
      react(ctx, 'think', 'hint');
      const h = hints === 1 ? q.hint : (q.hint2 || q.hint);
      card.querySelector('.hint-slot').innerHTML = `<div class="hint-box"><b>提示 ${Math.min(hints, 2)}：</b>${esc(h)}</div>`;
      if (hints >= 2 || !q.hint2) hintBtn.disabled = true;
    };
    const submit = async () => {
      if (finished) return;
      if (av.isEmpty()) { toast('先写下你的答案哦！', 'warn'); av.focus(); return; }
      submitBtn.disabled = true;
      let res;
      try {
        res = await sapi.post(`/api/student/runs/${ctx.run.runId}/attempt`, { question_id: q.id, response: av.getResponse(), hints_used: hints });
      } catch (e) {
        submitBtn.disabled = false;
        if (e.status === 409 && /已经答对/.test(e.message)) { finished = true; resolve({ correct: true }); return; }
        toast(e.message + '（你的答案还在，可以再按一次提交）', 'err', 5000);
        return;
      }
      submitBtn.disabled = false;
      if (res.invalid) { toast(res.feedback, 'warn'); return; }
      tries = res.tryNo;
      onResult?.(res, q);
      const fb = card.querySelector('.fb-slot');
      if (res.correct) {
        finished = true;
        play('correct');
        celebrateBurst(card, { x: '50%', y: '28%' });
        react(ctx, 'jump', 'happy', 1600);
        av.lock();
        hintBtn.classList.add('hidden'); submitBtn.classList.add('hidden');
        fb.innerHTML = `<div class="feedback ok"><h3>${esc(pick(PRAISE))}</h3>${tries === 1 ? '<p>第一次就答对了！</p>' : ''}${solutionHTML(res.solution)}
          <div class="q-actions"><button class="btn orange big" data-a="next">继续</button></div></div>`;
        const nb = fb.querySelector('[data-a=next]');
        nb.focus();
        nb.onclick = () => resolve({ correct: true, firstTry: tries === 1, support });
        return;
      }
      play('wrong');
      react(ctx, tries < 2 ? 'think' : 'hurt', tries < 2 ? 'hint' : 'sad'); // 第一次答错：给提示；两次答错：温柔鼓励
      const part = res.partial ? `<p>你得到了 ${res.marks} / ${res.maxMarks} 分，${res.detail?.wrongStep === 2 ? '第一步是对的！' : '有一部分是对的。'}</p>` : '';
      if (tries < 2) {
        fb.innerHTML = `<div class="feedback no"><h3>再想一想！</h3>${res.misconception ? `<span class="mc-name">${esc(res.misconception.name)}</span>` : ''}<p>${esc(res.feedback)}</p>${part}<p>改一改你的答案，再提交一次。</p></div>`;
        return;
      }
      // 两次答错：更简单的说明、分解步骤、例题、简单题
      support = res.support;
      const canGoOn = !mustBeCorrect;
      fb.innerHTML = `<div class="feedback no"><h3>没关系，我们一起来看看！</h3>${res.misconception ? `<span class="mc-name">${esc(res.misconception.name)}</span>` : ''}<p>${esc(res.feedback)}</p>${part}
        ${res.support ? `<div class="support-box"><h4>阿算的小秘诀</h4><p>${esc(res.support.simpler)}</p>${res.support.lesson ? '<button class="btn small purple" data-a="demo">看动画一步一步讲解</button>' : ''}</div>` : ''}
        ${hideSolutionUntilDone ? '' : solutionHTML(res.solution)}
        ${res.support?.easier && canGoOn ? '<p><b>接下来先做一道比较简单的同类题，练熟了再继续挑战！</b></p>' : ''}
        <div class="q-actions">${canGoOn ? '<button class="btn orange" data-a="next">我明白了，继续</button>' : ''}<button class="btn ghost" data-a="retry">${canGoOn ? '再试一次这题' : '照着步骤再算一次'}</button></div></div>`;
      fb.querySelector('[data-a=demo]')?.addEventListener('click', () => openDemo(q.expr));
      fb.querySelector('[data-a=next]')?.addEventListener('click', () => { finished = true; resolve({ correct: false, support }); });
      fb.querySelector('[data-a=retry]').onclick = () => { fb.innerHTML = ''; av.focus(); };
    };
    submitBtn.onclick = submit;
    av.onEnter(submit);
    av.el.addEventListener('choose', () => {});
  });
}

/**
 * 勇者与阿算按作答状态换动作：
 *  idle 等待作答 · think 看提示或第一次答错 · hurt 两次答错 · jump 答对（ms 后回到站立）
 * 只在有 ctx.hero（练习关卡、迷宫）时生效；Boss 关自己控制动作。
 */
function react(ctx, heroPose, catMood, ms = 0) {
  if (ctx.hero && !(heroPose === 'idle' && ctx.hero.el.dataset.pose === 'run')) setHero(ctx.hero.el, heroPose, ctx.hero.size, ms ? { ms, back: 'idle' } : {});
  if (ctx.cat && ctx.cat.el.dataset.mood !== catMood) { ctx.cat.el.innerHTML = mascot(catMood, ctx.cat.size); ctx.cat.el.dataset.mood = catMood; }
}

function openDemo(expr) {
  if (!expr) return;
  const p = demoPlayer(expr, { size: 28 });
  const wrap = el('<div></div>');
  wrap.appendChild(p.el);
  const ctl = el('<div class="q-actions"><button class="btn ghost small">上一步骤</button><button class="btn orange small">下一步骤</button></div>');
  ctl.children[0].onclick = () => p.prev(); ctl.children[1].onclick = () => p.next();
  wrap.appendChild(ctl);
  modal('动画讲解', wrap, { actions: [{ label: '关闭', cls: 'green' }], onClose: () => p.destroy() });
  p.next();
}

// ------------------------------------------------------------ 第二、三关与补救、宝箱、练习小测
async function practiceFlow(ctx) {
  const queue = ctx.run.questions.map(q => ({ q, extra: false }));
  const baseTotal = queue.length;
  let doneBase = 0;
  ctx.root.innerHTML = `<div class="play-head"><span class="chip">题目 <span class="num" id="qn">1 / ${baseTotal}</span></span><div class="progress-track"><div class="progress-fill" style="width:0%"></div></div></div>
    <div class="play-layout"><div id="qwrap"></div><aside class="guide-side"><div class="bubble" id="gsay">${esc(ctx.kind === 'bonus' ? '宝箱挑战题需要多想几步，加油！' : '慢慢读题，先想想要先算哪一步。')}</div>
      <div class="guide-cast"><div class="hero-slot" id="hero-slot">${explorer(150)}</div><div class="cat-slot" id="cat-slot">${mascot('idle', 104)}</div></div></aside></div>`;
  ctx.hero = { el: ctx.root.querySelector('#hero-slot'), size: 150 };
  ctx.cat = { el: ctx.root.querySelector('#cat-slot'), size: 104 };
  const wrap = ctx.root.querySelector('#qwrap');
  const fill = ctx.root.querySelector('.progress-fill');
  const say = ctx.root.querySelector('#gsay');
  while (queue.length && !ctx.destroyed) {
    const { q, extra } = queue.shift();
    ctx.root.querySelector('#qn').textContent = extra ? '补充练习' : `${doneBase + 1} / ${baseTotal}`;
    const r = await askQuestion(ctx, q, wrap, {
      label: extra ? '简单同类题' : ctx.kind === 'bonus' ? '宝箱挑战' : `第 ${doneBase + 1} 题`,
      onResult: (res) => { say.textContent = res.correct ? pick(PRAISE) : res.tryNo >= 2 ? '别灰心，看看解题步骤，我们再练一题！' : '差一点点，再检查一下！'; },
    });
    if (!extra) { doneBase++; fill.style.width = `${doneBase / baseTotal * 100}%`; }
    if (!r.correct && r.support?.easier) queue.unshift({ q: r.support.easier, extra: true });
  }
}

// ------------------------------------------------------------ 第四关：迷宫
const ROOM_NAME = { lock: '密码门', fork: '岔路口', bridge: '断桥', key: '钥匙房' };
async function mazeFlow(ctx) {
  const rooms = ctx.run.rooms.map(r => ({ ...r, q: ctx.run.questions.find(q => q.id === r.questionId) }));
  let pos = 0;
  let keys = 0;
  ctx.root.innerHTML = `<section class="maze-scene">${scene('bg.maze')}
      <div class="maze-track">${rooms.map((r, i) => `<div class="room" data-i="${i}"><div class="torch"></div><div class="room-door">${r.room === 'lock' ? door(false, '?') : r.room === 'fork' ? door(false, '?') : r.room === 'bridge' ? '<div class="bridge">' + '<span class="plank"></span><span class="plank gap"></span><span class="plank"></span>' + '</div>' : `<div style="height:110px;display:grid;place-items:center">${keyItem()}</div>`}</div><span class="room-label">${ROOM_NAME[r.room]}</span></div>`).join('')}
        <div class="room" data-i="exit">${chest(false, 80)}<span class="room-label">出口宝藏</span></div></div>
      <div class="maze-hero" style="left:20px">${explorer(72)}</div>
    </section>
    <div class="maze-panel parchment">
      <div class="maze-inv"><span class="chip">房间 <span class="num" id="rn">1 / ${rooms.length}</span></span><span class="chip">钥匙 <span class="num" id="kn">0</span></span><span id="mz-say" class="bubble" style="flex:1">走进迷宫！每一个房间都要用数学打开。</span></div>
      <div id="room-q" style="margin-top:12px"></div>
    </div>`;
  const hero = ctx.root.querySelector('.maze-hero');
  const say = ctx.root.querySelector('#mz-say');
  ctx.hero = { el: hero, size: 72 };
  const moveTo = (i) => {
    const roomEl = ctx.root.querySelector(`.room[data-i="${i}"]`);
    ctx.root.querySelectorAll('.room').forEach(r => r.classList.remove('current'));
    roomEl?.classList.add('current');
    setHero(hero, 'run', 72, { ms: 900, back: 'idle' });
    hero.style.left = `${(roomEl?.offsetLeft || 0) + 34 - ctx.root.querySelector('.maze-track').scrollLeft}px`;
    roomEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };
  moveTo(0);
  const slot = ctx.root.querySelector('#room-q');
  for (; pos < rooms.length && !ctx.destroyed; pos++) {
    const r = rooms[pos];
    ctx.root.querySelector('#rn').textContent = `${pos + 1} / ${rooms.length}`;
    moveTo(pos);
    if (r.room === 'fork' && r.q.qtype === 'mcq') {
      say.textContent = '岔路口！每扇门上写着一个答案，只有算对的那扇门才通往出口。';
      await forkRoom(ctx, r.q, slot, say);
      ctx.root.querySelector(`.room[data-i="${pos}"] .room-door`).innerHTML = door(true); // 选对路：岔路门打开
    } else {
      say.textContent = r.room === 'lock' ? (pos === rooms.length - 1 && keys === 0 ? '最后一道门需要钥匙和密码！' : '这扇门上了密码锁，答案就是密码！')
        : r.room === 'bridge' ? '桥断了！补上缺少的步骤，就能把桥修好。' : '钥匙房：选出正确的方法，就能拿到钥匙。';
      await askQuestion(ctx, r.q, slot, { label: ROOM_NAME[r.room], mustBeCorrect: true });
      play(r.room === 'key' ? 'chest' : 'door');
      const roomEl = ctx.root.querySelector(`.room[data-i="${pos}"]`);
      if (r.room === 'lock') roomEl.querySelector('.room-door').innerHTML = door(true);
      if (r.room === 'bridge') roomEl.querySelector('.plank.gap')?.classList.remove('gap');
      if (r.room === 'key') { keys++; ctx.root.querySelector('#kn').textContent = keys; roomEl.querySelector('.room-door').style.opacity = '.3'; }
    }
    ctx.root.querySelector(`.room[data-i="${pos}"]`).classList.add('done');
  }
  moveTo('exit');
  ctx.root.querySelector('.room[data-i="exit"]').innerHTML = `${chest(true, 80)}<span class="room-label">出口宝藏</span>`;
  play('chest');
  celebrate();
  setHero(hero, 'cheer', 72);
  slot.innerHTML = '<div class="feedback ok"><h3>你走出了数学迷宫！</h3><p>宝箱里是满满的经验值！</p></div>';
  await new Promise(r => setTimeout(r, 1200));
}

function forkRoom(ctx, q, slot, say) {
  return new Promise((resolve) => {
    let tries = 0;
    slot.innerHTML = `<section class="parchment qcard" data-qid="${esc(q.id)}">${questionTextHTML(q)}<div class="fork-doors">${q.choices.map((c, i) => `<button class="fork-door" data-v="${esc(c.value)}"><span class="fd-door">${door(false, String.fromCharCode(65 + i))}</span><span class="num">${esc(c.text)}</span></button>`).join('')}</div><div class="fb-slot"></div></section>`;
    slot.querySelectorAll('.fork-door').forEach(b => b.onclick = async () => {
      if (b.classList.contains('dead')) return;
      slot.querySelectorAll('.fork-door').forEach(x => { x.disabled = true; });
      let res;
      try { res = await sapi.post(`/api/student/runs/${ctx.run.runId}/attempt`, { question_id: q.id, response: { choice: b.dataset.v }, hints_used: 0 }); }
      catch (e) { toast(e.message, 'err'); slot.querySelectorAll('.fork-door:not(.dead)').forEach(x => { x.disabled = false; }); return; }
      tries = res.tryNo;
      const fb = slot.querySelector('.fb-slot');
      if (res.correct) {
        play('door');
        b.querySelector('.fd-door').innerHTML = door(true);
        celebrateBurst(slot.querySelector('.qcard'), { x: '50%', y: '40%' });
        react(ctx, 'jump', 'happy', 1600);
        fb.innerHTML = `<div class="feedback ok"><h3>选对路了！</h3>${solutionHTML(res.solution)}<div class="q-actions"><button class="btn orange big">继续前进</button></div></div>`;
        fb.querySelector('button').onclick = () => resolve();
        return;
      }
      play('wrong');
      react(ctx, 'think', 'hint');
      b.classList.add('dead');
      say.textContent = '这是一条死路！回到岔路口，再想一想。';
      fb.innerHTML = `<div class="feedback no"><h3>死路！</h3><p>${esc(res.feedback)}</p>${tries >= 2 ? solutionHTML(res.solution) : ''}</div>`;
      slot.querySelectorAll('.fork-door:not(.dead)').forEach(x => { x.disabled = false; });
    });
  });
}

// ------------------------------------------------------------ 第五关：Boss
async function bossFlow(ctx) {
  const qs = ctx.run.questions;
  const total = qs.length;
  let hp = total, shields = 3, useTimer = ctx.run.settings?.bossTimer || false;
  const secs = ctx.run.settings?.bossTimerSeconds || 90;
  ctx.root.innerHTML = `<section class="boss-arena">${scene('bg.boss')}
    <div class="boss-top"><div class="hp"><div class="hp-label">混乱魔王 生命值</div><div class="hp-bar"><div class="hp-fill" style="width:100%"></div></div></div>
      <div class="hearts" aria-label="护盾">${heart(true, 34)}${heart(true, 34)}${heart(true, 34)}</div>
      <label class="row" style="font-size:15px"><input type="checkbox" id="use-timer" ${useTimer ? 'checked' : ''}> 计时挑战（选用）</label>
      <span class="timer hidden" id="timer"></span></div>
    <div class="boss-stage"><div class="hero-wrap">${explorer(160)}</div><div class="bwrap">${bossArt('idle', 300)}</div><div class="bubble" style="color:var(--ink);align-self:center">答对所有题目，才能打败我！哈哈哈！</div></div>
  </section><div class="boss-q" id="bq"></div>`;
  preload(['enemy.boss.hurt', 'enemy.boss.attack', 'enemy.boss.defeated', 'char.boy.attack', 'char.boy.hurt', 'char.boy.win'], 4000); // 先载入其他状态，切换时不会闪
  const fill = ctx.root.querySelector('.hp-fill');
  const hearts = ctx.root.querySelector('.hearts');
  const bwrap = ctx.root.querySelector('.bwrap');
  const heroWrap = ctx.root.querySelector('.hero-wrap');
  const bubble = ctx.root.querySelector('.boss-stage .bubble');
  const timerEl = ctx.root.querySelector('#timer');
  ctx.root.querySelector('#use-timer').onchange = (e) => { useTimer = e.target.checked; if (!useTimer) stopTimer(); };
  let tHandle = null;
  const stopTimer = () => { clearInterval(tHandle); tHandle = null; timerEl.classList.add('hidden'); };
  ctx.cleanups.push(stopTimer);
  const startTimer = () => {
    stopTimer();
    if (!useTimer) return;
    let left = secs;
    timerEl.classList.remove('hidden', 'low');
    timerEl.textContent = `⏱ ${left} 秒`;
    tHandle = setInterval(() => {
      left--;
      timerEl.textContent = `⏱ ${left} 秒`;
      if (left <= 10) timerEl.classList.add('low');
      if (left <= 0) { stopTimer(); bubble.textContent = '时间到了！不过没关系，慢慢算，答对一样能攻击我！'; }
    }, 1000);
  };
  /**
   * 战斗动画：先把战斗场景卷到画面上，让学生看到出招，再卷回讲解与“继续”按钮。
   * hit：勇者发出魔法球 → 命中爆炸、魔王受伤摇晃、生命值下降、“命中！”
   * miss：魔王反击 → 勇者被击退、失去一面护盾（不扣分）
   */
  const arena = ctx.root.querySelector('.boss-arena');
  const reduce = () => document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const later = (ms, f) => { const t = setTimeout(() => { if (!ctx.destroyed) f(); }, ms); ctx.cleanups.push(() => clearTimeout(t)); };
  const backToFeedback = () => {
    const fb = ctx.root.querySelector('#bq .feedback');
    fb?.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'center' });
    fb?.querySelector('button')?.focus({ preventScroll: true });
  };
  function popText(text, cls) {
    const n = document.createElement('div');
    n.className = `battle-pop ${cls}`; n.textContent = text; n.setAttribute('aria-hidden', 'true');
    bwrap.appendChild(n); later(1300, () => n.remove());
  }
  function shoot() {
    const a = arena.getBoundingClientRect(), h = heroWrap.getBoundingClientRect(), b = bwrap.getBoundingClientRect();
    const orb = document.createElement('div');
    orb.className = 'magic-orb'; orb.setAttribute('aria-hidden', 'true');
    const x0 = h.right - a.left - 40, y0 = h.top - a.top + h.height * 0.42;
    const x1 = b.left - a.left + b.width * 0.5, y1 = b.top - a.top + b.height * 0.5;
    orb.style.left = `${x0}px`; orb.style.top = `${y0}px`;
    arena.appendChild(orb);
    orb.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0.6 }, { transform: `translate(calc(${x1 - x0}px - 50%), calc(${y1 - y0}px - 50%)) scale(1.3)`, opacity: 1 }],
      { duration: 420, easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'forwards' });
    later(440, () => orb.remove());
  }
  function battle(kind) {
    // 先让“继续”按钮出现后再卷动（askQuestion 会把焦点放在按钮上）
    setTimeout(() => arena.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' }), 30);
    if (kind === 'hit') {
      later(350, () => { setHero(heroWrap, 'attack', 160, { ms: 1100, back: 'idle' }); play('hit'); if (!reduce()) shoot(); });
      later(reduce() ? 400 : 780, () => {
        bwrap.innerHTML = bossArt('hurt', 300);
        playEffect('hit', bwrap, { x: '50%', y: '45%', size: 340, ms: 1000 });
        popText('命中！', 'hit');
        fill.style.width = `${hp / total * 100}%`;
        arena.classList.remove('shake'); void arena.offsetWidth; arena.classList.add('shake');
      });
      later(1700, () => { if (hp > 0) bwrap.innerHTML = bossArt('idle', 300); });
      later(2000, backToFeedback);
    } else {
      later(350, () => {
        play('bossHit');
        bwrap.innerHTML = bossArt('attack', 300);
        setHero(heroWrap, 'hurt', 160, { ms: 1100, back: 'idle' });
        hearts.innerHTML = [0, 1, 2].map(k => heart(k < shields, 34)).join('');
        hearts.classList.remove('anim-shake'); void hearts.offsetWidth; hearts.classList.add('anim-shake'); // 失去护盾时摇一下
        popText('护盾 −1', 'miss');
      });
      later(1300, () => { bwrap.innerHTML = bossArt('idle', 300); });
      later(1600, backToFeedback);
    }
  }

  for (let i = 0; i < qs.length && !ctx.destroyed; i++) {
    startTimer();
    bubble.textContent = i === 0 ? '先来一道简单的！' : i >= total - 3 ? '接下来是最难的题目，准备好了吗？' : '再来！';
    await askQuestion(ctx, qs[i], ctx.root.querySelector('#bq'), {
      label: `攻击 ${i + 1} / ${total}`, mustBeCorrect: true,
      onResult: (res) => {
        if (res.correct) {
          stopTimer();
          hp--;
          bubble.textContent = hp > 0 ? '哎哟！你答对了……下一题可没那么容易！' : '不——我被打败了！';
          battle('hit');
        } else {
          shields--;
          if (shields <= 0) { shields = 3; bubble.textContent = '阿算给你送来新的护盾！看清楚解题步骤再试一次。'; }
          else bubble.textContent = '哈哈！答错了！不过你还可以再试。';
          battle('miss');
        }
      },
    });
  }
  stopTimer();
  play('victory');
  celebrate(80);
  bwrap.innerHTML = bossArt('defeated', 300);
  setHero(heroWrap, 'win', 160);
  await new Promise(r => setTimeout(r, 1200));
}

// ------------------------------------------------------------ 结算
async function finish(ctx) {
  ctx.root.innerHTML = loading('正在计算成绩……');
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { res = await sapi.post(`/api/student/runs/${ctx.run.runId}/finish`, { active_seconds: ctx.timer.seconds() }); break; }
    catch (e) {
      if (attempt === 2) {
        ctx.root.innerHTML = `<div class="parchment"><p class="error-text">${esc(e.message)}</p><p>你的每一题作答都已经保存了。</p><button class="btn orange" id="retry-finish">再试一次</button></div>`;
        await new Promise(r => { ctx.root.querySelector('#retry-finish').onclick = r; });
        return finish(ctx);
      }
      await new Promise(r => setTimeout(r, 1200));
    }
  }
  const u = encodeURIComponent(ctx.unitId);
  const map = `#/student/map/${u}`;
  const isStage = ctx.kind === 'stage';
  const passed = res.passed;
  if (passed) { play('level'); celebrate(60); setPageScene('bg.victory'); }
  const nextStage = ctx.stage + 1;
  ctx.root.innerHTML = `<section class="parchment result-card">
    <div class="result-cast">${explorer(130, passed ? (ctx.stage === 5 && isStage ? 'win' : 'cheer') : 'think')}${passed && hasAsset('char.girl.cheer') ? partner(120, 'cheer') : ''}${passed ? mascot('wow', 110) : mascot('sad', 110)}</div>
    <h2>${ctx.kind === 'remedial' ? '补救小站完成！' : ctx.kind === 'bonus' ? '宝箱挑战完成！' : ctx.kind === 'quiz' ? '练习完成！' : passed ? '恭喜过关！' : '完成了！再加把劲！'}</h2>
    ${isStage ? stars(res.stars, 3, 40) : ''}
    <div class="result-stats"><div><b class="num">${res.firstTryCorrect} / ${res.total}</b>第一次就答对</div><div><b class="num">${res.accuracy}%</b>首次答对率</div><div><b class="num">+${res.xpGained}</b>经验值</div></div>
    ${res.needsRemedial ? `<p class="remedial-flag">这一关的首次答对率还没有达到 ${res.stagePass}%。先到“补救小站”再学一次，就能打开下一关！</p>` : ''}
    ${res.badgesEarned.length ? `<div><p><b>获得新徽章！</b></p><div class="badges" style="justify-content:center">${res.badgesEarned.map(b => badge(b.key, b.name)).join('')}</div></div>` : ''}
    ${res.bonusAvailable ? `<p>${chest(false, 50)} 你表现得非常好，宝箱出现了！</p>` : ''}
    <div class="row" style="justify-content:center">
      ${res.needsRemedial ? `<a class="btn purple big" href="#/student/play/${u}/${ctx.stage}/remedial">去补救小站</a>` : ''}
      ${res.bonusAvailable ? `<a class="btn orange" href="#/student/play/${u}/${ctx.stage}/bonus">打开宝箱</a>` : ''}
      ${isStage && passed && nextStage <= 6 ? `<a class="btn green big" href="${nextStage === 6 ? `#/student/exam/${u}` : `#/student/play/${u}/${nextStage}`}">前往第 ${nextStage} 关</a>` : ''}
      ${ctx.kind === 'remedial' ? `<a class="btn green big" href="#/student/play/${u}/${ctx.stage}">再挑战第 ${ctx.stage} 关</a>` : ''}
      <a class="btn ${ctx.kind === 'quiz' ? '' : 'wood'}" href="${ctx.kind === 'quiz' ? '#/student' : map}">${ctx.kind === 'quiz' ? '返回背包' : '返回地图'}</a>
    </div></section>`;
  // 通关（或完成宝箱挑战）时出现宝箱奖励
  if (passed && (isStage || ctx.kind === 'bonus')) chestReward(ctx, res);
}

/**
 * 宝箱奖励：宝箱出现并摇动 → 学生点宝箱（或按钮）→ 打开、星星飞出、显示得到的星星、经验值与徽章。
 * 奖励内容全部来自服务器的结算结果，图片里没有任何文字。
 */
function chestReward(ctx, res) {
  const back = el(`<div class="reward-back" role="dialog" aria-modal="true" aria-label="宝箱奖励">
    <div class="reward-panel ${hasAsset('ui.popup-panel') ? 'skinned' : 'parchment'}">
      <h2 class="reward-title">${ctx.kind === 'bonus' ? '宝箱挑战完成！' : `第 ${ctx.stage} 关通关！`}</h2>
      <div class="reward-scene">
        <div class="reward-hero">${explorer(130, 'cheer')}</div>
        ${hasAsset('char.girl.cheer') ? `<div class="reward-girl">${partner(120, 'cheer')}</div>` : ''}
        <button class="reward-chest" type="button" aria-label="打开宝箱"><span class="reward-rays" aria-hidden="true"></span>${chest(false, 160)}</button>
        <div class="reward-loot hidden" aria-live="polite">
          ${ctx.kind === 'stage' ? `<div>${stars(res.stars, 3, 36)}</div>` : ''}
          <p class="reward-xp"><span>${hasAsset('ui.coin') ? coin(32) : ''}+${res.xpGained}</span><small>经验值</small></p>
          ${res.badgesEarned.length ? `<div class="badges">${res.badgesEarned.map(b => badge(b.key, b.name)).join('')}</div>` : ''}
        </div>
      </div>
      <p class="reward-tip">点一下宝箱，看看里面有什么！</p>
      <div class="q-actions" style="justify-content:center"><button class="btn orange big" data-a="open">打开宝箱</button></div>
    </div></div>`);
  document.body.appendChild(back);
  const btn = back.querySelector('[data-a=open]');
  const chestBtn = back.querySelector('.reward-chest');
  let opened = false;
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const open = () => {
    if (opened) { close(); return; }
    opened = true;
    play('chest');
    chestBtn.classList.add('opened');
    chestBtn.innerHTML = `<span class="reward-rays" aria-hidden="true">${starBurst(300)}</span>${chest(true, 160)}`;
    back.querySelector('.reward-panel').classList.add('opened');
    celebrateBurst(back.querySelector('.reward-panel'), { x: '50%', y: '48%', count: 12, size: 46 });
    setHero(back.querySelector('.reward-hero'), 'jump', 130, { ms: 1600, back: 'cheer' });
    back.querySelector('.reward-tip').classList.add('hidden');
    back.querySelector('.reward-loot').classList.remove('hidden');
    btn.textContent = '收下奖励';
    btn.focus();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  chestBtn.onclick = open;
  btn.onclick = open;
  ctx.cleanups.push(close);
  btn.focus();
}
