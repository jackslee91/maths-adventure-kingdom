// 素材加载器：找出已上传的文件、产生 <img>、加载失败时换成备用图案、套用按钮与面板皮肤
import { ASSETS } from './manifest.js';

let files = {};            // 'characters/boy-idle.webp' → 修改时间
let ready = false;
const failed = new Set();  // 加载失败的素材代号
const fallbacks = new Map();
let seq = 0;

export async function initAssets() {
  try {
    const r = await fetch('/api/assets/index', { cache: 'no-store' });
    if (r.ok) files = (await r.json()).files || {};
  } catch { files = {}; }
  ready = true;
  applyUiSkin();
  return files;
}
export const assetsReady = () => ready;

/** 已上传文件的网址；没有就返回 null */
export function assetUrl(key) {
  const a = ASSETS[key];
  if (!a || failed.has(key)) return null;
  for (const ext of a.ext) {
    const f = `${a.folder}/${a.name}.${ext}`;
    if (files[f]) return `/assets/${f}?v=${files[f]}`;
  }
  return null;
}
export const hasAsset = (key) => !!assetUrl(key);
export const assetFile = (key) => { const a = ASSETS[key]; for (const ext of a.ext) { const f = `${a.folder}/${a.name}.${ext}`; if (files[f]) return f; } return null; };
export const failedAssets = () => new Set(failed);

/**
 * 产生图片 HTML。图片加载失败时会自动换成 fallbackHTML。
 * @param key 素材代号
 * @param opts.width 宽度（像素）  opts.cls 额外样式  opts.alt 无障碍说明  opts.anim 动画（false 关闭）
 * @param fallbackHTML 备用图案（字符串）
 */
export function imgHTML(key, { width, height, cls = '', alt, anim, eager = false } = {}, fallbackHTML = '') {
  const a = ASSETS[key];
  const url = assetUrl(key);
  const animCls = anim === false ? '' : (anim || a?.anim || '');
  const style = `${width ? `width:${width}px;` : ''}${height ? `height:${height}px;` : ''}`;
  if (!url) return fallbackHTML ? `<span class="asset-wrap is-fallback ${animCls} ${cls}" data-asset="${key}" style="${style}">${fallbackHTML}</span>` : '';
  const id = `af${++seq}`;
  if (fallbackHTML) fallbacks.set(id, { html: fallbackHTML, key, cls: `${animCls} ${cls}`, style });
  if (fallbacks.size > 3000) fallbacks.delete(fallbacks.keys().next().value);
  return `<span class="asset-wrap ${animCls} ${cls}" data-asset="${key}" style="${style}"><img class="asset" src="${url}" alt="${alt ?? a?.label ?? ''}" data-afb="${id}" draggable="false" decoding="async" ${eager ? '' : 'loading="lazy"'}></span>`;
}

/** 整页或区域背景：有图片用图片，否则用备用图案（SVG 场景）或保留原来的 CSS 背景 */
export function sceneHTML(key, fallbackHTML = '') {
  const url = assetUrl(key);
  if (url) return `<div class="scene-layer" data-asset="${key}"><img class="asset scene-img" src="${url}" alt="" data-afb="${registerFallback(fallbackHTML, key)}"></div>`;
  return fallbackHTML ? `<div class="scene-layer is-fallback" data-asset="${key}">${fallbackHTML}</div>` : '';
}
function registerFallback(html, key) { const id = `af${++seq}`; fallbacks.set(id, { html, key, scene: true }); return id; }

// 图片加载完成：淡入；加载失败：换成备用图案并记录
document.addEventListener('load', (e) => {
  const t = e.target;
  if (t.tagName === 'IMG' && t.classList.contains('asset')) t.classList.add('loaded');
}, true);
document.addEventListener('error', (e) => {
  const t = e.target;
  if (t.tagName !== 'IMG' || !t.dataset.afb) return;
  const fb = fallbacks.get(t.dataset.afb);
  const key = t.closest('[data-asset]')?.dataset.asset;
  if (key) { failed.add(key); console.warn(`素材加载失败，已改用备用图案：${key}`); }
  const wrap = t.parentElement;
  if (fb && fb.html) {
    t.remove();
    wrap.classList.add('is-fallback');
    wrap.insertAdjacentHTML('beforeend', fb.html);
  } else {
    t.remove();
    wrap.classList.add('is-missing');
  }
}, true);

/** 预先加载重要图片（首页），最多等 timeout 毫秒 */
export function preload(keys, timeout = 4000) {
  const urls = keys.map(assetUrl).filter(Boolean);
  if (!urls.length) return Promise.resolve();
  return Promise.race([
    Promise.all(urls.map(u => new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = u; }))),
    new Promise(res => setTimeout(res, timeout)),
  ]);
}

/**
 * 按钮、面板、彩带等 UI 皮肤：有图片就设定 CSS 变量与 <html> 上的样式名，
 * 由 public/css/assets.css 以九宫格（border-image）方式套用；没有图片就保留原本的 CSS 样式。
 */
export function applyUiSkin() {
  const root = document.documentElement;
  for (const [key, a] of Object.entries(ASSETS)) {
    if (a.cut) { deriveCutSkin(key, a); continue; }
    if (!a.slice && !a.skin) continue;
    const name = key.replace(/^ui\./, '');
    const url = assetUrl(key);
    root.classList.toggle(`skin-${name}`, !!url);
    if (url) {
      root.style.setProperty(`--skin-${name}`, `url("${url}")`);
      if (a.slice) root.style.setProperty(`--skin-${name}-slice`, String(a.slice));
      // 图片坏掉时取消皮肤，回到原本的 CSS 样式
      const test = new Image();
      test.onerror = () => { failed.add(key); root.classList.remove(`skin-${name}`); console.warn(`素材加载失败，已改用备用样式：${key}`); };
      test.src = url;
    }
  }
}

/**
 * 由一张面板图片“切”出可拉伸的部分（例如答题面板：外框 + 答案栏）。
 * 切法写在 manifest 的 cut 字段（以原图像素为单位，会按实际图片大小等比换算）。
 * 产生 CSS 变量 --skin-<名称>-frame、--skin-<名称>-bar，并在 <html> 加上 skin-<名称>。
 * 图片读取失败时什么都不做，画面继续使用原本的羊皮纸样式。
 */
function deriveCutSkin(key, a) {
  const url = assetUrl(key);
  const name = key.replace(/^ui\./, '');
  const root = document.documentElement;
  root.classList.remove(`skin-${name}`);
  if (!url) return;
  const img = new Image();
  img.onerror = () => { failed.add(key); console.warn(`素材加载失败，已改用备用样式：${key}`); };
  img.onload = async () => {
    try {
      const c = a.cut, k = img.naturalWidth / c.base[0];
      const S = (v) => Math.round(v * k);
      const toUrl = (cv) => new Promise(res => cv.toBlob(b => res(b ? URL.createObjectURL(b) : null), 'image/png'));
      // 外框：把需要的横条（keep）接起来，去掉中间的答案栏
      const keep = c.keep.map(([y0, y1]) => [S(y0), Math.min(S(y1), img.naturalHeight)]);
      const f = document.createElement('canvas');
      f.width = img.naturalWidth; f.height = keep.reduce((n, [y0, y1]) => n + y1 - y0, 0);
      const fx = f.getContext('2d');
      let y = 0;
      for (const [y0, y1] of keep) { fx.drawImage(img, 0, y0, f.width, y1 - y0, 0, y, f.width, y1 - y0); y += y1 - y0; }
      // 修补：用素面的木条或纸面盖掉会被拉伸变形的装饰（装饰另外以原比例叠加）
      for (const [dst, src] of c.patches || []) {
        const [dx, dy, dw, dh] = dst.map(S), [sx, sy, sw, sh] = src.map(S);
        const tmp = document.createElement('canvas'); tmp.width = sw; tmp.height = sh;
        tmp.getContext('2d').drawImage(f, sx, sy, sw, sh, 0, 0, sw, sh);
        fx.clearRect(dx, dy, dw, dh);
        fx.drawImage(tmp, 0, 0, sw, sh, dx, dy, dw, dh);
      }
      const crop = ([x0, y0, w, h]) => { const cv = document.createElement('canvas'); cv.width = S(w); cv.height = S(h); cv.getContext('2d').drawImage(img, S(x0), S(y0), S(w), S(h), 0, 0, S(w), S(h)); return cv; };
      const b = crop(c.bar);
      const parts = await Promise.all([toUrl(f), toUrl(b), ...(c.ornTop ? [toUrl(crop(c.ornTop))] : []), ...(c.ornBottom ? [toUrl(crop(c.ornBottom))] : [])]);
      if (parts.some(u => !u)) return;
      const [fu, bu, ot, ob] = parts;
      if (ot) { root.style.setProperty(`--skin-${name}-orn-top`, `url("${ot}")`); root.style.setProperty(`--skin-${name}-orn-top-ratio`, `${c.ornTop[2]} / ${c.ornTop[3]}`); }
      if (ob) { root.style.setProperty(`--skin-${name}-orn-bottom`, `url("${ob}")`); root.style.setProperty(`--skin-${name}-orn-bottom-ratio`, `${c.ornBottom[2]} / ${c.ornBottom[3]}`); }
      root.style.setProperty(`--skin-${name}-frame`, `url("${fu}")`);
      root.style.setProperty(`--skin-${name}-frame-slice`, c.frameSlice.map(S).join(' '));
      root.style.setProperty(`--skin-${name}-bar`, `url("${bu}")`);
      root.style.setProperty(`--skin-${name}-bar-slice`, c.barSlice.map(S).join(' '));
      root.classList.add(`skin-${name}`);
    } catch (e) { console.warn('答题面板切图失败，改用备用样式', e); }
  };
  img.src = url;
}
