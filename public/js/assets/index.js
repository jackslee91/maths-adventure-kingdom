// 画面使用的素材函数：优先使用 public/assets 中上传的图片，没有就用程序画的备用图案（art.js）。
// 函数名称与原本的 art.js 相同，所以各画面只要改成从这里引入即可。
import * as art from '../art.js';
import { ASSETS } from './manifest.js';
import { imgHTML, sceneHTML, assetUrl, hasAsset } from './loader.js';
import { esc } from '../ui.js';

export { initAssets, assetUrl, hasAsset, preload } from './loader.js';
export { ISLANDS, topicIcon, MASCOT_NAME } from '../art.js';

/** 沿着 fallback 链找第一个已上传的素材代号 */
function firstAvailable(key) {
  let k = key;
  const seen = new Set();
  while (k && ASSETS[k] && !seen.has(k)) {
    seen.add(k);
    if (hasAsset(k)) return k;
    k = ASSETS[k].fallback;
  }
  return null;
}

// 勇者动作：idle 站立、run 奔跑、jump 跳跃（答对）、cheer/happy 开心、think 思考、hurt 受伤、attack 攻击、win 胜利
const KID_POSE = { idle: 'stand', cheer: 'cheer', happy: 'cheer', think: 'stand', attack: 'cheer', stand: 'stand', point: 'point', run: 'stand', jump: 'cheer', hurt: 'stand', win: 'cheer' };
const KID_KEY = { stand: 'idle', idle: 'idle', cheer: 'cheer', happy: 'cheer', think: 'think', attack: 'attack', point: 'idle', run: 'run', jump: 'jump', hurt: 'hurt', win: 'win' };

function pick(key, opts, drawFallback) {
  const k = firstAvailable(key) || key;
  // 动画以“请求的姿势”为准，例如没有欢呼图时仍用站立图但做欢呼动画
  return imgHTML(k, { ...opts, anim: opts.anim ?? ASSETS[key]?.anim }, drawFallback());
}

// ---------------------------------------------------------------- 人物
export function mascot(mood = 'happy', size = 120, opts = {}) {
  const key = { happy: 'char.mascot.happy', wow: 'char.mascot.wow', sad: 'char.mascot.sad', idle: 'char.mascot.idle', hint: 'char.mascot.hint', point: 'char.mascot.point' }[mood] || 'char.mascot.idle';
  const svgMood = { hint: 'happy', point: 'happy', idle: 'happy' }[mood] || mood;
  return pick(key, { width: size, alt: '向导阿算', ...opts }, () => art.mascot(svgMood, size));
}
// 学生选择的主角：'boy' 男生勇者 / 'girl' 女生冒险家（每位学生各自记住，见 student/common.js）
let heroGender = 'boy';
export function setHeroGender(g) { heroGender = g === 'girl' ? 'girl' : 'boy'; }
export const getHeroGender = () => heroGender;
function kid(g, size, pose, opts) {
  const key = `char.${g}.${KID_KEY[pose] || 'idle'}`;
  const draw = g === 'girl' ? () => art.explorerGirl(size, KID_POSE[pose] || 'stand') : () => art.explorer(size, KID_POSE[pose] || 'stand');
  return pick(key, { width: Math.round(size * 0.8), alt: g === 'girl' ? '女生冒险家' : '勇者', ...opts, cls: `hero ${g} pose-${pose} ${opts.cls || ''}` }, draw);
}
/** 主角（按学生的选择） */
export function explorer(size = 90, pose = 'stand', opts = {}) { return kid(heroGender, size, pose, opts); }
/** 另一位冒险伙伴（和主角相反） */
export function partner(size = 90, pose = 'stand', opts = {}) { return kid(heroGender === 'girl' ? 'boy' : 'girl', size, pose, opts); }
export function explorerBoy(size = 90, pose = 'stand', opts = {}) { return kid('boy', size, pose, opts); }
/**
 * 把容器里的勇者换成另一个动作。ms 之后自动回到 back 动作（不填就停在新动作）。
 * 用法：setHero(el, 'jump', 120, { ms: 1200, back: 'idle' })
 */
export function setHero(el, pose, size, { ms = 0, back = 'idle' } = {}) {
  if (!el) return;
  clearTimeout(el._heroT);
  if (el.dataset.pose !== pose) { el.innerHTML = explorer(size, pose); el.dataset.pose = pose; }
  if (ms) el._heroT = setTimeout(() => { if (el.isConnected) { el.innerHTML = explorer(size, back); el.dataset.pose = back; } }, ms);
}
export function explorerGirl(size = 90, pose = 'stand', opts = {}) { return kid('girl', size, pose, opts); }
export function teacherArt(size = 140, opts = {}) {
  return pick('char.teacher', { width: size, alt: '老师', ...opts }, () => art.teacherArt(size));
}
export function avatar(size = 34) {
  // 没有专用头像时，截取勇者站立图的头部
  if (heroGender === 'girl' && hasAsset('char.girl.idle')) return imgHTML('char.girl.idle', { width: size, height: size, cls: 'avatar-img avatar-crop', anim: false, alt: '' }, art.explorerGirl(size, 'stand'));
  if (!hasAsset('char.avatar.boy') && hasAsset('char.boy.idle')) return imgHTML('char.boy.idle', { width: size, height: size, cls: 'avatar-img avatar-crop', anim: false, alt: '' }, art.explorer(size, 'stand'));
  return pick('char.avatar.boy', { width: size, height: size, cls: 'avatar-img', anim: false, alt: '' }, () => art.explorer(size, 'stand'));
}

// ---------------------------------------------------------------- 怪兽
export function boss(state = 'idle', size = 220, opts = {}) {
  // 只有一张魔王图时，用 boss-<状态> 样式（闪红、变暗）区分受伤、反击、被打败
  const own = hasAsset(`enemy.boss.${state}`) ? 'own' : 'shared';
  return pick(`enemy.boss.${state}`, { width: size, height: size, alt: '混乱魔王', eager: true, ...opts, cls: `boss-img boss-${state} boss-${own} ${opts.cls || ''}` }, () => art.boss(state === 'defeated' ? 'hurt' : state === 'attack' ? 'idle' : state, size));
}

// ---------------------------------------------------------------- 道具
export function chest(open = false, size = 90, opts = {}) {
  // 没有“打开的宝箱”图时，用宝箱图加上发光效果
  const glow = open && !hasAsset('ui.chest.open') && hasAsset('ui.chest.closed') ? 'chest-glow' : '';
  return pick(open ? 'ui.chest.open' : 'ui.chest.closed', { width: size, alt: open ? '打开的宝箱' : '宝箱', ...opts, cls: `${glow} ${opts.cls || ''}` }, () => art.chest(open, size));
}
/** 门：门上的字母或数字由程序叠加显示 */
export function door(open = false, label = '') {
  const k = open ? 'ui.door.open' : 'ui.door.closed';
  if (!firstAvailable(k)) return art.door(open, label);
  return `<span class="door-asset">${imgHTML(firstAvailable(k), { width: 84, alt: open ? '打开的门' : '锁着的门', anim: false }, art.door(open, label))}${!open && label ? `<span class="door-label">${esc(label)}</span>` : ''}</span>`;
}
export function keyItem() { return pick('ui.key-item', { width: hasAsset('ui.key-item') ? 110 : 70, alt: '钥匙' }, () => art.KEY); }

export function stars(n, max = 3, size = 22) {
  if (!hasAsset('ui.star.full')) return art.stars(n, max, size);
  let s = '';
  for (let i = 0; i < max; i++) {
    const k = i < n ? 'ui.star.full' : (hasAsset('ui.star.empty') ? 'ui.star.empty' : 'ui.star.full');
    s += imgHTML(k, { width: size, height: size, anim: false, alt: '', cls: i < n || hasAsset('ui.star.empty') ? '' : 'dim' }, '');
  }
  return `<span class="stars" aria-label="${n} 颗星">${s}</span>`;
}
export function heart(full = true, size = 26) {
  const k = full ? 'ui.heart.full' : 'ui.heart.empty';
  return hasAsset(k) ? imgHTML(k, { width: size, height: size, anim: false, alt: '' }) : art.heart(full, size);
}
export function coin(size = 24) { return hasAsset('ui.coin') ? imgHTML('ui.coin', { width: size, height: size, anim: false, alt: '' }) : art.coin(size); }

/** 奖牌：缎带上的文字由程序显示 */
export function medal(label = '数学王者', size = 150) {
  if (!hasAsset('ui.medal')) return art.medal(label, size);
  return `<span class="medal-asset" style="width:${size}px;--ms:${size}px">${imgHTML('ui.medal', { width: size, alt: `${label}奖牌` }, art.medal(label, size))}<span class="medal-label">${esc(label)}</span></span>`;
}

export function badge(key, name, earned = true) {
  const k = `ui.badge.${key}`;
  if (!hasAsset(k)) return art.badge(key, name, earned);
  return `<div class="badge ${earned ? '' : 'locked'}" title="${esc(name)}">${imgHTML(k, { width: 66, height: 66, anim: false, alt: '' }, '')}<span>${esc(name)}</span></div>`;
}

/** 顶栏图标（有上传才显示，没有就只显示文字） */
export function icon(name, size = 22) {
  const k = `ui.icon.${name}`;
  return hasAsset(k) ? imgHTML(k, { width: size, height: size, anim: false, alt: '', cls: 'icon-img' }) : '';
}

// ---------------------------------------------------------------- 场景与特效
const SCENE_FALLBACK = {
  'scene.home': () => art.homeScene(),
  'scene.maze': () => art.mazeScene(),
  'scene.boss': () => art.bossScene(),
  'scene.victory': () => art.forestScene(),
};
/** 区域背景层（放在 position:relative 的容器内） */
export function scene(key) {
  const k = firstAvailable(key);
  let fb = ASSETS[key]?.fallback;
  while (fb && ASSETS[fb]) fb = ASSETS[fb].fallback;
  const draw = SCENE_FALLBACK[fb];
  return sceneHTML(k || key, draw ? draw() : '');
}

/** 整页背景：放在 #page-scene，页面切换时更换 */
export function setPageScene(key) {
  const el = document.getElementById('page-scene');
  if (!el) return;
  if (!key) { el.innerHTML = ''; document.body.classList.remove('has-scene'); return; }
  const html = scene(key);
  el.innerHTML = html;
  document.body.classList.toggle('has-scene', !!html);
}

/**
 * 答对庆祝：星星从中心飞散（有星星图就用图片，没有就用 ★ 字符），再加上闪光。
 */
export function celebrateBurst(container, { x = '50%', y = '35%', count = 10, size = 44 } = {}) {
  if (!container || document.body.classList.contains('reduce-motion')) return;
  playEffect('sparkle', container, { x, y });
  const layer = document.createElement('div');
  layer.className = 'star-burst';
  layer.style.left = x; layer.style.top = y;
  layer.setAttribute('aria-hidden', 'true');
  const starImg = hasAsset('ui.star.full') ? imgHTML('ui.star.full', { width: size, height: size, anim: false, alt: '', eager: true }, '★') : '<span class="fx-star">★</span>';
  let html = '';
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 90 + Math.random() * 70;
    html += `<span class="sb" style="--dx:${Math.round(Math.cos(ang) * dist)}px;--dy:${Math.round(Math.sin(ang) * dist)}px;--r:${Math.round(Math.random() * 360)}deg;--d:${(Math.random() * 0.15).toFixed(2)}s">${starImg}</span>`;
  }
  layer.innerHTML = html;
  container.appendChild(layer);
  setTimeout(() => layer.remove(), 1300);
}

/** 旋转的星星光环（放在宝箱后面）；没有图片就返回空字符串 */
export function starBurst(size = 300) {
  return hasAsset('fx.star-burst') ? imgHTML('fx.star-burst', { width: size, height: size, cls: 'star-burst-img', alt: '', eager: true }, '') : '';
}

/** 短暂的特效（答对闪光、攻击命中），没有图片时用备用效果 */
export function playEffect(name, container, { x = '50%', y = '40%', size = 220, ms = 900 } = {}) {
  if (!container) return;
  const key = `fx.${name}`;
  let html;
  if (hasAsset(key)) html = imgHTML(key, { width: size, alt: '', anim: name === 'hit' ? 'anim-hit' : 'anim-burst', eager: true }, '');
  else if (name === 'hit') html = '<span class="fx-emoji">💥</span>';
  else if (name === 'sparkle') html = '<span class="fx-sparkle"></span>';
  else return;
  const n = document.createElement('div');
  n.className = 'fx-layer';
  n.style.left = x; n.style.top = y;
  n.setAttribute('aria-hidden', 'true');
  n.innerHTML = html;
  container.appendChild(n);
  setTimeout(() => n.remove(), ms);
}

/**
 * 冒险地图的底图。
 * - 有上传 maps/map-background：用图片（图片本身可以已经画好岛屿）。
 * - 没有：用程序画的海洋与木桥；已上传图片的岛屿不再画 SVG，避免重叠。
 */
export function mapBackground() {
  const skip = [0, 1, 2, 3, 4, 5].filter(i => hasAsset(`map.island.${i + 1}`));
  const svg = `<svg viewBox="0 0 1240 760" class="map-bg-svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${art.mapScene(skip)}</svg>`;
  if (hasAsset('map.background')) return imgHTML('map.background', { cls: 'map-bg-img', anim: false, alt: '', eager: true }, svg);
  return svg;
}
/** 单独上传的岛屿图片（没有就返回空字符串） */
export function islandImage(i) {
  const k = `map.island.${i + 1}`;
  return hasAsset(k) ? imgHTML(k, { cls: 'map-island-img', alt: '' }, '') : '';
}
