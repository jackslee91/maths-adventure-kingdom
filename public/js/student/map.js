// 冒险地图：六座岛屿 = 六个关卡
import { esc, loading, toast } from '../ui.js';
import { sapi } from '../api.js';
import { stars, mascot, explorer, setHero, chest, mapBackground, islandImage, setPageScene, hasAsset } from '../assets/index.js';
import { MAP_LAYOUT } from '../assets/manifest.js';
import { requireLogin, topbar, bindTopbar } from './common.js';
import { play, music } from '../audio.js';

const DESC = {
  1: { goal: '看动画讲解课本例题，学会从左到右计算、竖式进位退位和长除法。', how: '跟着向导一步一步看，再回答 3 道小问题。' },
  2: { goal: '完成“做了一半”的题：填第二步、竖式填空、排列步骤。', how: '可以使用提示。答错两次会出现更简单的讲解和一道简单题。' },
  3: { goal: '独立完成计算题和生活应用题。', how: '提示是选用的。首次答对率达到老师设定的标准才算过关。' },
  4: { goal: '在迷宫里开门、选对的路、修好桥、拿到钥匙。', how: '每个房间的答案决定你走哪条路。走错了路会回到岔路口。' },
  5: { goal: '用正确的答案攻击混乱魔王，题目会越来越难。', how: '答错不会失败，只会失去护盾并看到讲解。计时可以选择开或关。' },
  6: { goal: '正式评估：没有提示，不能重答，按固定评分方式计分。', how: '完成后会生成你的个人学习报告，并送给老师。' },
};

export async function renderMap(app, unitId) {
  if (!requireLogin()) return;
  document.body.classList.add('theme-game');
  setPageScene('bg.hub');
  music(true, 'map');
  app.innerHTML = `<div class="game-page">${topbar({ back: '#/student', backLabel: '背包' })}${loading('正在展开地图……')}</div>`;
  let prog, units;
  try {
    [prog, units] = await Promise.all([sapi.get(`/api/student/units/${encodeURIComponent(unitId)}/progress`), sapi.get('/api/student/units')]);
  } catch (e) { if (e.status === 401) { location.hash = '#/student/login'; return; } throw e; }
  const unit = units.units.find(u => u.id === unitId);
  const stages = prog.stages;
  const current = Math.max(1, ...stages.filter(s => s.unlocked).map(s => s.stage));
  let selected = stages.find(s => s.unlocked && !s.completed)?.stage || current;

  // 地图分层：底图（图片或程序画的海洋）→ 岛屿图片 → 程序生成的编号牌、名称、星星 → 玩家
  // 有整张地图图片时，用图片上的位置；没有就用程序画的地图位置
  const painted = hasAsset('map.background');
  const LAY = painted ? MAP_LAYOUT.image : MAP_LAYOUT;
  const L = LAY.islands;
  const pos = (n) => L[n - 1];
  const mapHTML = `<div class="map-stage ${painted ? 'painted' : ''}" role="group" aria-label="数学王国冒险地图" style="aspect-ratio:${LAY.ratio}">
    ${mapBackground()}
    ${stages.map((s, i) => {
      const img = painted ? '' : islandImage(i);
      return img ? `<button class="map-island ${s.unlocked ? '' : 'locked'}" data-stage="${s.stage}" style="left:${L[i].x}%;top:${L[i].y}%;width:${L[i].w}%" aria-label="第 ${s.stage} 关 ${esc(s.name)}" tabindex="-1">${img}</button>` : '';
    }).join('')}
    ${stages.map((s, i) => `<button class="map-marker ${s.completed ? 'done' : ''} ${s.unlocked ? '' : 'locked'}" data-stage="${s.stage}" style="left:${L[i].x}%;top:${L[i].y + LAY.labelOffsetY}%"
        aria-label="第 ${s.stage} 关 ${esc(s.name)}${s.unlocked ? '' : '（未解锁）'}${s.completed ? '（已完成）' : ''}">
        <span class="m-num">${s.unlocked ? s.stage : '🔒'}</span><span class="m-name">${esc(s.name)}</span>
        ${s.completed ? stars(s.stars, 3, 22) : ''}${s.needsRemedial ? '<span class="m-flag" title="补救小站开放">!</span>' : ''}</button>`).join('')}
    <div class="map-player" id="player" style="left:${pos(current).x}%;top:${pos(current).y - 2}%">${explorer(70)}</div>
    <div class="map-guide">${mascot('point', 96)}<div class="bubble" id="guide-say"></div></div>
    <span class="wood-title map-title">数学王国冒险地图</span>
  </div>`;

  app.innerHTML = `<div class="game-page">${topbar({ back: '#/student', backLabel: '背包', xp: prog.xp, title: unit ? `${unit.code} ${unit.title}` : '' })}
    <div class="map-wrap">${mapHTML}</div>
    <nav class="stage-strip" aria-label="关卡列表">${stages.map(s => `<button class="${s.completed ? 'done' : ''}" data-stage="${s.stage}" ${s.unlocked ? '' : 'aria-disabled="true"'}><b>${s.unlocked ? s.stage : '🔒'}</b>${esc(s.name)}</button>`).join('')}</nav>
    <section class="parchment stage-info" id="stage-info" style="margin-top:14px"></section>
  </div>`;
  bindTopbar(app);

  const info = app.querySelector('#stage-info');
  const say = app.querySelector('#guide-say');
  const lvl = prog.level;
  let tasks = 0;
  try { tasks = Number(sessionStorage.getItem('ma_tasks') || 0); sessionStorage.removeItem('ma_tasks'); } catch { /* 忽略 */ }
  say.textContent = prog.openAssessment ? '你有一份王者认证还没交，记得回到第六关继续作答！'
    : tasks ? `老师布置了 ${tasks} 个任务，放在“背包”里。也可以先选一座岛屿闯关！`
    : `勇敢的数学冒险家，你现在是 ${lvl} 级。选一座岛屿开始挑战吧！`;

  function showInfo(n) {
    selected = n;
    const s = stages[n - 1];
    const d = DESC[n];
    const playHref = n === 6 ? `#/student/exam/${encodeURIComponent(unitId)}` : `#/student/play/${encodeURIComponent(unitId)}/${n}`;
    const prevName = n > 1 ? stages[n - 2].name : '';
    info.innerHTML = `<h3>第 ${n} 关：${esc(s.name)} ${s.completed ? stars(s.stars) : ''}</h3>
      <p><b>任务：</b>${esc(d.goal)}</p><p><b>规则：</b>${esc(d.how)}</p>
      ${s.best !== null && n < 6 ? `<p>最好成绩：首次答对率 ${s.best}%</p>` : ''}${s.best !== null && n === 6 ? `<p>最好成绩：得分率 ${s.best}%</p>` : ''}
      ${s.needsRemedial ? `<div class="remedial-flag"><b>补救小站开放了！</b> 这一关的首次答对率还没达到标准。先到补救小站看例题、做 3 道简单题，就能打开下一关。
        <div class="row" style="margin-top:8px"><a class="btn purple" href="#/student/play/${encodeURIComponent(unitId)}/${n}/remedial">去补救小站</a></div></div>` : ''}
      ${s.completed && n >= 2 && n <= 5 && bonusOpen(n) ? `<div class="row">${chest(false, 54)}<span>你表现得太棒了，宝箱出现了！</span><a class="btn orange" href="#/student/play/${encodeURIComponent(unitId)}/${n}/bonus">打开宝箱挑战</a></div>` : ''}
      <div class="row">${s.unlocked ? `<a class="btn ${n === 6 ? 'purple' : 'green'} big" href="${playHref}">${n === 6 && prog.openAssessment ? '继续作答' : s.completed ? '再挑战一次' : '开始闯关'}</a>` : `<p>先完成“${esc(prevName)}”才能解锁这一关。</p>`}</div>`;
    const pl = app.querySelector('#player');
    if (s.unlocked) {
      const moving = pl.style.left !== `${pos(n).x}%`;
      if (moving) {
        // 勇者跑向选中的岛屿：奔跑动作，往左跑时翻转，到达后回到站立
        pl.classList.toggle('face-left', parseFloat(pl.style.left) > pos(n).x);
        setHero(pl, 'run', 70, { ms: 950, back: 'idle' });
      }
      pl.style.left = `${pos(n).x}%`; pl.style.top = `${pos(n).y - 2}%`;
    }
    app.querySelectorAll('.map-marker').forEach(m => m.classList.toggle('selected', Number(m.dataset.stage) === n));
  }
  function bonusOpen(n) { return !!prog.stages[n - 1].bonus; }

  app.querySelectorAll('.stage-strip button').forEach(btn => btn.addEventListener('click', () => {
    const n = Number(btn.dataset.stage);
    if (!stages[n - 1].unlocked) { play('wrong'); toast('这一关还没有解锁哦！', 'warn'); return; }
    play('click'); showInfo(n);
  }));
  app.querySelectorAll('.map-marker, .map-island').forEach(g => g.addEventListener('click', () => {
    const n = Number(g.dataset.stage);
    if (!stages[n - 1].unlocked) { play('wrong'); toast('这座岛还没有解锁哦！', 'warn'); return; }
    play('click'); showInfo(n);
    info.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }));
  showInfo(selected);
}
