// 《魔法森林大冒险》（第 2 关，Phaser 版）的外壳：载入 Phaser、建立画面与触控按钮、
// 遇到怪兽或魔法门时暂停游戏并显示原有的答题界面（askQuestion），再把结果传回 Phaser。
// 出题、批改、记录全部沿用原有系统；金币与星星只在画面里计算，不会送到服务器，不影响成绩。
import { esc } from '../../ui.js';
import { mascot, getHeroGender } from '../../assets/index.js';
import { play } from '../../audio.js';
import { celebrate } from '../common.js';
import { forestTextures, loadTexturesInto } from './loader.js';
import { createForestScene } from './forest-scene.js';

const PHASER_SRC = '/vendor/phaser/phaser-arcade-physics.min.js';
let phaserPromise = null;

/** 只载入一次 Phaser（约 1 MB，服务器以 gzip 传送，之后由浏览器缓存） */
export function loadPhaser() {
  if (window.Phaser) return Promise.resolve(window.Phaser);
  if (!phaserPromise) {
    phaserPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PHASER_SRC; s.async = true;
      s.onload = () => (window.Phaser ? resolve(window.Phaser) : reject(new Error('Phaser 载入失败')));
      s.onerror = () => { phaserPromise = null; reject(new Error('Phaser 载入失败，请检查网络后重新整理页面')); };
      document.head.appendChild(s);
    });
  }
  return phaserPromise;
}

/** 浏览器是否能跑 Phaser（WebGL 或 Canvas 2D 都可以） */
export function canRunPhaser() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('2d')); } catch { return false; }
}

/**
 * 第 2 关的魔法森林。完成（走到宝箱）后 resolve，接着由 play.js 显示原有的结算画面。
 * @param ctx play.js 的关卡 ctx（需要 ctx.askQuestion）
 */
export async function forestFlow(ctx) {
  ctx.root.innerHTML = `<section class="act-wrap forest-wrap">
      <div class="forest-stage" id="forest-stage" data-state="loading">
        <div class="forest-game" id="forest-game" aria-label="魔法森林大冒险：用左右键移动，空格跳跃；碰到怪兽或魔法门就会出现数学挑战"></div>
        <div class="forest-loading" id="forest-loading">正在打开魔法森林……</div>
      </div>
      <div class="act-controls" role="group" aria-label="操作按钮">
        <button class="act-btn" data-k="left" aria-label="向左">◀</button>
        <button class="act-btn" data-k="right" aria-label="向右">▶</button>
        <span class="grow forest-tip">← → 移动　空格 跳跃　碰到怪兽或魔法门就会出题</span>
        <button class="act-btn jump" data-k="jump">跳</button>
      </div>
      <div class="act-panel hidden" id="act-panel" aria-live="polite"></div>
    </section>`;
  const stageEl = ctx.root.querySelector('#forest-stage');
  const panel = ctx.root.querySelector('#act-panel');
  const reduce = () => document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  ctx.hero = null;

  let Phaser;
  try { Phaser = await loadPhaser(); }
  catch (e) { stageEl.querySelector('#forest-loading').textContent = e.message; throw e; }
  if (ctx.destroyed) return;

  // 触控与按钮：由场景每一帧读取
  const controls = { left: false, right: false, jump: false };
  ctx.root.querySelectorAll('.act-btn').forEach((b) => {
    const k = b.dataset.k;
    if (k === 'jump') { b.addEventListener('pointerdown', (e) => { e.preventDefault(); controls.jump = true; }); return; }
    const on = (e) => { e.preventDefault(); controls[k] = true; b.classList.add('on'); };
    const off = () => { controls[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
  });

  // 玩游戏时，方向键和空格不要卷动网页（答题输入框里照常可用）
  let playing = false;
  const stopScroll = (e) => {
    if (!playing || e.target.closest?.('input, textarea, select, button')) return;
    if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  };
  // 注意：Phaser 会略过已被 preventDefault 的按键，所以这个监听要在 Phaser 启动之后才加上（见 ready）

  const textures = forestTextures(getHeroGender());

  return new Promise((resolveFlow) => {
    const hooks = {
      sound: (n) => play(n),
      celebrate: (n) => celebrate(n),
      reduce,
      setState: (s) => { stageEl.dataset.state = s; playing = s === 'play'; },
      ready: () => { stageEl.querySelector('#forest-loading')?.remove(); window.addEventListener('keydown', stopScroll); },
      /** 出题：暂停中由场景呼叫；回传 { correct, easier } */
      challenge: (enc) => new Promise((res) => {
        const title = enc.kind === 'door' ? '魔法门锁住了！算出答案，门就会打开！'
          : enc.extra ? '简单同类题：先把这一题练熟！'
          : '绿色史莱姆挡住了去路！答对就能打倒它！';
        panel.innerHTML = `<div class="act-panel-head">${mascot('point', 56)}<b>${esc(title)}</b></div><div class="act-q"></div>`;
        panel.classList.remove('hidden');
        setTimeout(() => panel.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' }), 60);
        ctx.askQuestion(ctx, enc.q, panel.querySelector('.act-q'), {
          label: enc.extra ? '简单同类题' : `第 ${enc.no} 题`,
          mustBeCorrect: enc.kind === 'door', // 魔法门一定要算对才开；史莱姆两次答错后看讲解，可以继续
        }).then((r) => {
          panel.classList.add('hidden'); panel.innerHTML = '';
          stageEl.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' });
          res({ correct: !!r.correct, easier: !r.correct ? r.support?.easier || null : null });
        });
      }),
      win: () => { if (!ctx.destroyed) { cleanup(); resolveFlow(); } },
    };

    const questions = ctx.run.questions;
    const Scene = createForestScene(Phaser, { textures, questions, hooks });
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: ctx.root.querySelector('#forest-game'),
      width: 1280, height: 720,
      backgroundColor: '#7ccfff',
      // 旧平板画面较慢时：关掉 smoothStep，物理系统会按实际经过的时间补算，勇者不会变成慢动作，也不会穿过平台
      fps: { target: 60, smoothStep: false },
      physics: { default: 'arcade', arcade: { gravity: { y: 1700 }, debug: false } },
      scale: { mode: Phaser.Scale.NONE },  // 画布以 CSS 填满 16:9 的框，Phaser 自动换算点击位置
      input: { keyboard: true, touch: true },
      render: { pixelArt: false, antialias: true },
      audio: { noAudio: true },        // 声音沿用原有的音效系统
      banner: false,
      scene: [Scene],
      callbacks: { preBoot: (g) => { g.registry.set('controls', controls); g.registry.set('loadInto', loadTexturesInto); } },
    });

    let cleaned = false;
    function cleanup() {
      if (cleaned) return; cleaned = true;
      playing = false;
      window.removeEventListener('keydown', stopScroll);
      try { game.destroy(true); } catch { /* 忽略 */ }
    }
    ctx.cleanups.push(cleanup);
  });
}
