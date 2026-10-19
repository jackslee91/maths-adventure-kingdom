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
    if (!a.slice) continue;
    const name = key.replace(/^ui\./, '');
    const url = assetUrl(key);
    root.classList.toggle(`skin-${name}`, !!url);
    if (url) {
      root.style.setProperty(`--skin-${name}`, `url("${url}")`);
      root.style.setProperty(`--skin-${name}-slice`, String(a.slice));
      // 图片坏掉时取消皮肤，回到原本的 CSS 样式
      const test = new Image();
      test.onerror = () => { failed.add(key); root.classList.remove(`skin-${name}`); console.warn(`素材加载失败，已改用备用样式：${key}`); };
      test.src = url;
    }
  }
}
