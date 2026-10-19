// 动作闯关（第 2–5 关）：左右移动、跳跃、遇到怪兽按“出招”答题，答对就打倒怪兽，走到终点开宝箱。
// 只负责画面与操作；出题、批改、记录全部沿用原本的 askQuestion / forkRoom（由 play.js 透过 ctx 传入），
// 所以老师的学习记录与报告完全不受影响。画面用 <canvas> 绘制，不需要额外的游戏引擎。
import { esc, el } from '../ui.js';
import { ASSETS } from '../assets/manifest.js';
import { assetUrl, getHeroGender, mascot } from '../assets/index.js';
import { play } from '../audio.js';
import { celebrate } from './common.js';

const VH = 420;                 // 虚拟画面高度（实际画面按比例缩放）
const GROUND = 360;             // 地面高度（虚拟座标）
const GAP = 600;                // 每只怪兽之间的距离
const SPEED = 280, GRAVITY = 2300, JUMP = 900;

const MONSTER = {
  slime: { key: 'enemy.slime', name: '史莱姆', size: 118, color: '#7bd23b' },
  bat: { key: 'enemy.bat', name: '水晶蝙蝠', size: 120, color: '#5fb8ff', fly: true },
  golem: { key: 'enemy.golem', name: '石头魔像', size: 150, color: '#7b5bd6' },
  fire: { key: 'enemy.fire', name: '火焰精灵', size: 118, color: '#ff7a1e', fly: true },
  door: { key: 'ui.door.closed', open: 'ui.door.open', name: '密码门', size: 170, color: '#8a6a4a' },
  boss: { key: 'enemy.boss.idle', hurt: 'enemy.boss.hurt', defeated: 'enemy.boss.defeated', name: '混乱魔王', size: 300, color: '#c0392b' },
};
const THEME = {
  2: { bg: 'bg.play', ground: '#6dbb3c', soil: '#8a5a32', monster: 'slime' },
  3: { bg: 'bg.hub', ground: '#7fd3ff', soil: '#3c5fa8', monster: 'bat' },
  4: { bg: 'bg.maze', ground: '#a07be0', soil: '#3b2a5e', monster: 'golem' },
  5: { bg: 'bg.boss', ground: '#5a3a32', soil: '#2a1512', monster: 'fire', lava: true },
};

/** 沿着素材的 fallback 找到第一个已上传的图片网址 */
function urlFor(key) {
  let k = key; const seen = new Set();
  while (k && ASSETS[k] && !seen.has(k)) { seen.add(k); const u = assetUrl(k); if (u) return u; k = ASSETS[k].fallback; }
  return null;
}
const imgCache = new Map();
function img(key) {
  if (!key) return null;
  if (imgCache.has(key)) return imgCache.get(key);
  const u = urlFor(key);
  let im = null;
  if (u) { im = new Image(); im.decoding = 'async'; im.src = u; }
  imgCache.set(key, im);
  return im;
}
const ready = (im) => im && im.complete && im.naturalWidth > 0;

/**
 * @param ctx  play.js 的关卡 ctx（需要 ctx.askQuestion、ctx.forkRoom）
 * @param mode 'practice'（第 2、3 关）| 'maze'（第 4 关）| 'boss'（第 5 关）
 */
export function actionFlow(ctx, mode) {
  return new Promise((resolveFlow) => {
    const stage = ctx.stage;
    const theme = THEME[stage] || THEME[2];
    const gender = getHeroGender();
    const reduce = () => document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---------------------------------------------------------- 关卡内容：每道题是一只怪兽（或一扇门、或魔王的一次出招）
    const enc = [];
    const qs = ctx.run.questions;
    if (mode === 'maze') {
      ctx.run.rooms.forEach((r) => {
        const q = qs.find(x => x.id === r.questionId);
        const isDoor = r.room === 'lock' || r.room === 'fork';
        enc.push({ q, kind: isDoor ? 'door' : 'golem', room: r.room, fork: r.room === 'fork' && q.qtype === 'mcq' });
      });
    } else if (mode === 'boss') {
      const nBoss = Math.min(4, qs.length);
      qs.slice(0, qs.length - nBoss).forEach(q => enc.push({ q, kind: 'fire' }));
      const bossQs = qs.slice(qs.length - nBoss);
      enc.push({ q: bossQs[0], kind: 'boss', bossQs, hp: bossQs.length, maxHp: bossQs.length });
    } else {
      qs.forEach(q => enc.push({ q, kind: theme.monster }));
    }
    enc.forEach((e, i) => { e.x = 620 + i * GAP + (e.kind === 'boss' ? 160 : 0); e.alive = true; e.t0 = Math.random() * 6; });
    const lastX = enc.length ? enc[enc.length - 1].x : 600;
    const goalX = lastX + (enc.at(-1)?.kind === 'boss' ? 520 : 420);
    const worldW = goalX + 360;
    // 平台与金币（跳上去拿金币，只是好玩，不影响成绩）
    const plats = [], coins = [];
    enc.forEach((e, i) => {
      const gx = (i === 0 ? 200 : enc[i - 1].x) ;
      const mid = gx + (e.x - gx) / 2;
      if (i % 2 === 0) {
        plats.push({ x: mid - 90, y: GROUND - 130, w: 180 });
        for (let k = 0; k < 3; k++) coins.push({ x: mid - 50 + k * 50, y: GROUND - 175, got: false });
      } else {
        for (let k = 0; k < 3; k++) coins.push({ x: mid - 60 + k * 60, y: GROUND - 40 - (k === 1 ? 50 : 0), got: false });
      }
    });

    // ---------------------------------------------------------- 画面
    ctx.root.innerHTML = `<section class="act-wrap">
      <div class="act-stage" id="act-stage">
        <canvas class="act-canvas" aria-label="动作闯关画面：用左右键移动，空格跳跃，靠近怪兽按出招答题"></canvas>
        <div class="act-hud">
          <span class="chip" id="act-prog"></span>
          <span class="chip"><span class="act-coin"></span><span class="num" id="act-coins">0</span></span>
          <div class="act-bosshp hidden" id="act-bosshp"><span>混乱魔王</span><div class="hp-bar"><div class="hp-fill" style="width:100%"></div></div></div>
        </div>
        <div class="act-prompt hidden" id="act-prompt"></div>
        <div class="act-help" id="act-help">← → 移动　空格 跳跃　靠近怪兽按 <b>⚔ 出招</b>（或 J 键）</div>
      </div>
      <div class="act-controls" role="group" aria-label="操作按钮">
        <button class="act-btn" data-k="left" aria-label="向左">◀</button>
        <button class="act-btn" data-k="right" aria-label="向右">▶</button>
        <span class="grow"></span>
        <button class="act-btn jump" data-k="jump">跳</button>
        <button class="act-btn attack" data-k="attack" disabled>⚔ 出招</button>
      </div>
      <div class="act-panel hidden" id="act-panel" aria-live="polite"></div>
    </section>`;
    const stageEl = ctx.root.querySelector('#act-stage');
    const canvas = ctx.root.querySelector('canvas');
    const g = canvas.getContext('2d');
    const panel = ctx.root.querySelector('#act-panel');
    const prompt = ctx.root.querySelector('#act-prompt');
    const progEl = ctx.root.querySelector('#act-prog');
    const coinEl = ctx.root.querySelector('#act-coins');
    const bossHpEl = ctx.root.querySelector('#act-bosshp');
    const attackBtn = ctx.root.querySelector('[data-k=attack]');
    ctx.hero = null; // 动作关卡由画布画勇者，不用 askQuestion 的勇者动作

    let W = 0, H = 0, S = 1, dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = stageEl.clientWidth;
      H = Math.round(Math.min(440, Math.max(260, W * 0.52)));
      canvas.style.height = `${H}px`;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      S = H / VH;
    };
    resize();
    window.addEventListener('resize', resize);

    // 预先载入图片
    const heroImg = (pose) => img(`char.${gender}.${pose}`);
    ['idle', 'run', 'jump', 'attack', 'hurt', 'win', 'think'].forEach(heroImg);
    const bg = img(theme.bg);
    Object.values(MONSTER).forEach(m => { img(m.key); img(m.open); img(m.hurt); img(m.defeated); });
    const platImg = img('ui.platform');
    const fxHit = img('fx.hit'), coinImg = img('ui.coin'), chestImg = img('ui.chest.closed'), chestOpen = img('ui.chest.open');

    // ---------------------------------------------------------- 状态
    const hero = { x: 140, y: GROUND, vx: 0, vy: 0, onGround: true, face: 1, pose: 'idle', poseUntil: 0, w: 70, h: 150 };
    let state = 'walk'; // walk | quiz | anim | goal | done
    let coinsGot = 0, near = null, fx = [], orb = null, shake = 0, last = performance.now(), raf = 0, goalOpened = false;
    const keys = { left: false, right: false };
    let defeated = 0;
    const totalBase = enc.length - (mode === 'boss' ? 1 : 0) + (mode === 'boss' ? enc.at(-1).maxHp : 0);
    const updHud = () => {
      progEl.textContent = mode === 'boss' ? `出招 ${Math.min(defeated + 1, totalBase)} / ${totalBase}` : `${mode === 'maze' ? '关卡' : '怪兽'} ${defeated} / ${enc.filter(e => !e.extra).length}`;
      coinEl.textContent = coinsGot;
    };
    updHud();
    const setPose = (p, ms = 0) => { hero.pose = p; hero.poseUntil = ms ? performance.now() + ms : 0; };
    const nextEnc = () => enc.find(e => e.alive);

    // ---------------------------------------------------------- 操作
    const onKey = (down) => (ev) => {
      if (state === 'quiz' || ev.target.closest?.('input, textarea, select')) return;
      const k = ev.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = down; ev.preventDefault(); }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = down; ev.preventDefault(); }
      else if (down && (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W')) { jump(); ev.preventDefault(); }
      else if (down && (k === 'j' || k === 'J' || k === 'Enter')) { if (near) { attack(); ev.preventDefault(); } }
    };
    const kd = onKey(true), ku = onKey(false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    ctx.root.querySelectorAll('.act-btn').forEach((b) => {
      const k = b.dataset.k;
      if (k === 'left' || k === 'right') {
        const on = (e) => { e.preventDefault(); keys[k] = true; b.classList.add('on'); };
        const off = () => { keys[k] = false; b.classList.remove('on'); };
        b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
      } else if (k === 'jump') b.addEventListener('click', () => jump());
      else b.addEventListener('click', () => { if (near) attack(); });
    });
    function jump() {
      if (state !== 'walk' || !hero.onGround) return;
      hero.vy = -JUMP; hero.onGround = false; play('click');
    }

    // ---------------------------------------------------------- 出招：打开题目
    function attack() {
      if (state !== 'walk' || !near) return;
      const e = near;
      state = 'quiz'; keys.left = keys.right = false; hero.vx = 0;
      prompt.classList.add('hidden'); attackBtn.disabled = true;
      setPose('think');
      const m = MONSTER[e.kind];
      const q = e.kind === 'boss' ? e.bossQs[e.maxHp - e.hp] : e.q;
      const title = e.kind === 'boss' ? `向混乱魔王出招！（还要打 ${e.hp} 下）`
        : e.kind === 'door' ? (e.fork ? '岔路口：走进写着正确答案的门！' : '密码门：算出答案，门就会打开！')
        : e.extra ? '简单同类题：先把这一题练熟！'
        : `${m.name}挡住了去路！答对就能打倒它！`;
      panel.innerHTML = `<div class="act-panel-head">${mascot('point', 56)}<b>${esc(title)}</b></div><div class="act-q"></div><p class="hidden" id="act-say"></p>`;
      panel.classList.remove('hidden');
      const slot = panel.querySelector('.act-q');
      const label = mode === 'boss' ? `出招 ${defeated + 1} / ${totalBase}` : e.extra ? '简单同类题' : `第 ${enc.filter(x => !x.extra).indexOf(e) + 1} 题`;
      const onResult = (res) => {
        if (!res.correct) { e.taunt = performance.now(); setPose('hurt', 700); hero.x = Math.max(60, hero.x - 40); }
      };
      const done = e.fork
        ? ctx.forkRoom(ctx, q, slot, panel.querySelector('#act-say')).then(() => ({ correct: true }))
        : ctx.askQuestion(ctx, q, slot, { label, mustBeCorrect: mode !== 'practice', onResult });
      setTimeout(() => panel.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' }), 60);
      done.then((r) => {
        if (ctx.destroyed) return;
        panel.classList.add('hidden'); panel.innerHTML = '';
        stageEl.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' });
        if (r.correct) strike(e);
        else {
          // 练习关：两次答错后看完讲解继续；怪兽跑掉，再来一道简单同类题
          e.alive = false; e.fled = performance.now(); defeated++;
          if (r.support?.easier) {
            const extra = { q: r.support.easier, kind: e.kind, x: e.x + 280, alive: true, extra: true, t0: 0 };
            enc.splice(enc.indexOf(e) + 1, 0, extra);
          }
          state = 'walk'; setPose('idle'); updHud();
        }
      });
    }

    // ---------------------------------------------------------- 出招动画：魔法球 → 命中 → 怪兽倒下 → 金币
    function strike(e) {
      state = 'anim';
      const t = performance.now();
      setPose('attack', 900);
      play('hit');
      const sx = hero.x + 40, sy = hero.y - 90;
      const ex = e.x, ey = monsterY(e) - MONSTER[e.kind].size * 0.5;
      orb = reduce() ? null : { sx, sy, ex, ey, t0: t + 150, dur: 380 };
      setTimeout(() => {
        if (ctx.destroyed) return;
        fx.push({ type: 'hit', x: ex, y: ey, t0: performance.now(), dur: 650, size: e.kind === 'boss' ? 320 : 230 });
        fx.push({ type: 'text', x: ex, y: ey - 90, t0: performance.now(), dur: 1000, text: e.kind === 'door' ? '开门！' : '命中！' });
        if (!reduce()) shake = 12;
        e.hitAt = performance.now();
        if (e.kind === 'boss') {
          e.hp--; defeated++;
          bossHpEl.querySelector('.hp-fill').style.width = `${e.hp / e.maxHp * 100}%`;
          if (e.hp <= 0) { e.alive = false; e.deadAt = performance.now(); play('victory'); celebrate(60); }
        } else if (e.kind === 'door') {
          e.alive = false; e.opened = true; defeated++; play('door');
        } else {
          e.alive = false; e.deadAt = performance.now(); if (!e.extra) defeated++;
          for (let k = 0; k < 5; k++) fx.push({ type: 'coin', x: ex, y: ey, vx: (Math.random() - 0.5) * 420, vy: -500 - Math.random() * 300, t0: performance.now(), dur: 900 });
          coinsGot += 5;
        }
        updHud();
      }, reduce() ? 100 : 560);
      setTimeout(() => { if (!ctx.destroyed) { state = 'walk'; setPose('idle'); } }, reduce() ? 500 : 1350);
    }

    const monsterY = (e) => {
      const m = MONSTER[e.kind];
      return GROUND - (m.fly ? 70 + Math.sin((performance.now() / 1000 + e.t0) * 2.4) * 14 : 0);
    };

    // ---------------------------------------------------------- 游戏循环
    function update(dt, now) {
      if (hero.poseUntil && now > hero.poseUntil) { hero.poseUntil = 0; hero.pose = 'idle'; }
      if (state === 'walk') {
        hero.vx = (keys.right ? SPEED : 0) - (keys.left ? SPEED : 0);
        if (hero.vx) hero.face = hero.vx > 0 ? 1 : -1;
      } else if (state === 'goal') hero.vx = 0;
      else hero.vx = 0;
      hero.vy += GRAVITY * dt;
      let nx = hero.x + hero.vx * dt, ny = hero.y + hero.vy * dt;
      // 不能穿过下一只怪兽（或关着的门）
      const e = nextEnc();
      const stopX = e ? e.x - (e.kind === 'boss' ? 190 : e.kind === 'door' ? 110 : 95) : goalX;
      nx = Math.max(60, Math.min(nx, stopX, worldW - 80));
      // 落在平台或地面上
      hero.onGround = false;
      if (hero.vy >= 0) {
        for (const p of plats) {
          if (nx > p.x - 20 && nx < p.x + p.w + 20 && hero.y <= p.y + 2 && ny >= p.y) { ny = p.y; hero.vy = 0; hero.onGround = true; }
        }
      }
      if (ny >= GROUND) { ny = GROUND; hero.vy = 0; hero.onGround = true; }
      hero.x = nx; hero.y = ny;
      // 金币
      for (const c of coins) if (!c.got && Math.abs(c.x - hero.x) < 40 && Math.abs(c.y - (hero.y - 70)) < 80) { c.got = true; coinsGot++; play('step'); coinEl.textContent = coinsGot; }
      // 靠近怪兽：显示“出招”
      const wasNear = near;
      near = state === 'walk' && e && hero.x >= stopX - 60 && hero.onGround ? e : null;
      if (near !== wasNear) {
        attackBtn.disabled = !near;
        attackBtn.classList.toggle('ready', !!near);
        if (near) {
          prompt.innerHTML = `${near.kind === 'door' ? '门锁住了' : near.kind === 'boss' ? '混乱魔王' : esc(MONSTER[near.kind].name)}！按 <b>⚔ 出招</b> 开始答题`;
          prompt.classList.remove('hidden');
        } else prompt.classList.add('hidden');
      }
      if (e && e.kind === 'boss') bossHpEl.classList.toggle('hidden', hero.x < e.x - 900);
      // 终点
      if (!e && state === 'walk' && hero.x >= goalX - 5 && !goalOpened) {
        goalOpened = true; state = 'goal'; setPose('win'); play('chest'); celebrate(50);
        fx.push({ type: 'text', x: goalX + 70, y: GROUND - 200, t0: now, dur: 1600, text: '过关！' });
        setTimeout(() => { if (!ctx.destroyed) { state = 'done'; cleanup(); resolveFlow(); } }, 1700);
      }
      if (shake > 0) shake = Math.max(0, shake - 60 * dt);
    }

    function drawImg(im, cx, by, h, { flip = false, alpha = 1, fallbackColor = '#888', fit = 'h' } = {}) {
      // cx：水平中心，by：底部
      g.save(); g.globalAlpha = alpha;
      if (ready(im)) {
        const r = im.naturalWidth / im.naturalHeight;
        const hh = fit === 'h' ? h : h / r, ww = hh * r;
        g.translate(cx, by);
        if (flip) g.scale(-1, 1);
        g.drawImage(im, -ww / 2, -hh, ww, hh);
      } else {
        g.fillStyle = fallbackColor; g.beginPath(); g.ellipse(cx, by - h / 2, h * 0.42, h / 2, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - h * 0.14, by - h * 0.6, h * 0.08, 0, 7); g.arc(cx + h * 0.06, by - h * 0.6, h * 0.08, 0, 7); g.fill();
      }
      g.restore();
    }

    function draw(now) {
      const vw = W / S;
      let cam = Math.max(0, Math.min(hero.x - vw * 0.35, worldW - vw));
      g.setTransform(dpr * S, 0, 0, dpr * S, 0, 0);
      g.clearRect(0, 0, vw, VH);
      if (shake) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      // 背景（视差，左右镜像拼接，避免接缝）
      if (ready(bg)) {
        const bh = VH, bw = bh * bg.naturalWidth / bg.naturalHeight;
        const off = -(cam * 0.35) % (bw * 2);
        for (let x = off; x < vw; x += bw) {
          const idx = Math.round((x - off) / bw);
          g.save();
          if (idx % 2) { g.translate(x + bw, 0); g.scale(-1, 1); g.drawImage(bg, 0, 0, bw, bh); }
          else g.drawImage(bg, x, 0, bw, bh);
          g.restore();
        }
      } else { g.fillStyle = '#7ccfff'; g.fillRect(0, 0, vw, VH); }
      g.save(); g.translate(-cam, 0);
      // 地面
      g.fillStyle = theme.soil; g.fillRect(cam - 10, GROUND, vw + 20, VH - GROUND);
      g.fillStyle = theme.ground; g.fillRect(cam - 10, GROUND, vw + 20, 12);
      if (theme.lava) { g.fillStyle = '#ff7a1e'; for (let x = Math.floor(cam / 90) * 90; x < cam + vw; x += 90) g.fillRect(x + 20, GROUND + 26, 40, 4); }
      // 平台
      for (const p of plats) {
        if (ready(platImg)) {
          // 平台图片：草地顶端约在图片高度的 22% 处，让勇者站在草上
          const pw = p.w + 40, ph = pw * platImg.naturalHeight / platImg.naturalWidth;
          g.drawImage(platImg, p.x - 20, p.y - ph * 0.22, pw, ph);
        } else {
          g.fillStyle = theme.soil; g.beginPath(); g.roundRect(p.x, p.y, p.w, 30, 12); g.fill();
          g.fillStyle = theme.ground; g.beginPath(); g.roundRect(p.x, p.y, p.w, 10, [12, 12, 0, 0]); g.fill();
        }
      }
      // 金币
      for (const c of coins) if (!c.got) {
        const bob = Math.sin(now / 300 + c.x) * 4;
        if (ready(coinImg)) g.drawImage(coinImg, c.x - 18, c.y - 18 + bob, 36, 36);
        else { g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(c.x, c.y + bob, 15, 0, 7); g.fill(); }
      }
      // 终点宝箱
      drawImg(goalOpened ? (ready(chestOpen) ? chestOpen : chestImg) : chestImg, goalX + 70, GROUND + 4, 120, { fallbackColor: '#c98a2b' });
      // 怪兽、门、魔王
      for (const e of enc) {
        if (e.x < cam - 300 || e.x > cam + vw + 300) continue;
        const m = MONSTER[e.kind];
        let y = monsterY(e), alpha = 1, h = m.size, im = img(m.key);
        if (e.kind === 'door') { im = e.opened ? img(m.open) || im : im; }
        else if (!e.alive) {
          const t = (now - (e.deadAt || e.fled || now)) / 600;
          if (t > 1 && e.kind !== 'boss') continue;
          alpha = Math.max(0, 1 - t); y += t * 30;
          if (e.kind === 'boss') { im = img(m.defeated) || im; alpha = 1; y = GROUND; }
        }
        if (e.kind === 'boss' && e.alive && e.hitAt && now - e.hitAt < 700) im = img(m.hurt) || im;
        let dx = 0;
        if (e.taunt && now - e.taunt < 500) dx = Math.sin((now - e.taunt) / 30) * 10;
        if (e.alive && e.kind !== 'door' && e.kind !== 'boss') h *= 1 + Math.sin(now / 260 + e.t0) * 0.03;
        if (e.hitAt && now - e.hitAt < 220 && e.kind !== 'door') { g.save(); g.filter = 'brightness(2.2)'; }
        drawImg(im, e.x + dx, y, h, { alpha, fallbackColor: m.color });
        if (e.hitAt && now - e.hitAt < 220 && e.kind !== 'door') g.restore();
        if (e.kind === 'door' && !e.opened) {
          g.fillStyle = '#ffd23f'; g.strokeStyle = '#5a3a20'; g.lineWidth = 3;
          g.beginPath(); g.arc(e.x, y - h * 0.68, 15, 0, 7); g.fill(); g.stroke();
          g.fillStyle = '#3a2418'; g.font = '900 18px "Noto Sans SC", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', e.x, y - h * 0.68 + 1);
        }
      }
      // 勇者
      const moving = state === 'walk' && hero.vx !== 0 && hero.onGround;
      const pose = hero.poseUntil || state !== 'walk' ? hero.pose : !hero.onGround ? 'jump' : moving ? 'run' : 'idle';
      const bob = moving ? Math.abs(Math.sin(now / 90)) * -6 : 0;
      const tilt = moving ? Math.sin(now / 90) * 0.04 : 0;
      g.save(); g.translate(hero.x, hero.y + bob); g.rotate(tilt);
      drawImg(heroImg(pose), 0, 0, hero.h, { flip: hero.face < 0, fallbackColor: '#e2362b' });
      g.restore();
      // 魔法球
      if (orb) {
        const t = (now - orb.t0) / orb.dur;
        if (t >= 0 && t <= 1) {
          const x = orb.sx + (orb.ex - orb.sx) * t, y = orb.sy + (orb.ey - orb.sy) * t - Math.sin(t * Math.PI) * 40;
          const grd = g.createRadialGradient(x, y, 2, x, y, 34);
          grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.35, '#fff3a0'); grd.addColorStop(0.7, 'rgba(255,200,60,.8)'); grd.addColorStop(1, 'rgba(255,170,40,0)');
          g.fillStyle = grd; g.beginPath(); g.arc(x, y, 34, 0, 7); g.fill();
        } else if (t > 1) orb = null;
      }
      // 特效
      fx = fx.filter(f => now - f.t0 < f.dur);
      for (const f of fx) {
        const t = (now - f.t0) / f.dur;
        if (f.type === 'hit') {
          const s = f.size * (0.5 + t * 0.7);
          g.save(); g.globalAlpha = 1 - t;
          if (ready(fxHit)) g.drawImage(fxHit, f.x - s / 2, f.y - s / 2, s, s);
          else { g.fillStyle = '#fff3a0'; g.beginPath(); g.arc(f.x, f.y, s / 3, 0, 7); g.fill(); }
          g.restore();
        } else if (f.type === 'text') {
          g.save(); g.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
          g.font = '900 40px "Noto Sans SC", sans-serif'; g.textAlign = 'center';
          g.lineWidth = 7; g.strokeStyle = '#2a0e00'; g.fillStyle = '#ffe066';
          const yy = f.y - t * 40;
          g.strokeText(f.text, f.x, yy); g.fillText(f.text, f.x, yy);
          g.restore();
        } else if (f.type === 'coin') {
          const tt = (now - f.t0) / 1000;
          const x = f.x + f.vx * tt, y = f.y + f.vy * tt + 0.5 * 1600 * tt * tt;
          g.save(); g.globalAlpha = 1 - t;
          if (ready(coinImg)) g.drawImage(coinImg, x - 15, y - 15, 30, 30);
          else { g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x, y, 12, 0, 7); g.fill(); }
          g.restore();
        }
      }
      g.restore();
    }

    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!ctx.destroyed) { update(dt, now); draw(now); raf = requestAnimationFrame(loop); }
    }
    raf = requestAnimationFrame(loop);

    function cleanup() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('resize', resize);
    }
    ctx.cleanups.push(cleanup);
    // 测试用：读取目前状态（不影响游戏）
    stageEl.dataset.state = 'walk';
    const st = setInterval(() => { if (ctx.destroyed || state === 'done') clearInterval(st); else { stageEl.dataset.state = state; stageEl.dataset.near = near ? '1' : '0'; } }, 100);
    ctx.cleanups.push(() => clearInterval(st));
  });
}

/** 学生是否选了“简单模式”（不玩动作关，直接答题） */
export function simpleMode() {
  try { return localStorage.getItem('ma_simple') === '1'; } catch { return false; }
}
export { el };
