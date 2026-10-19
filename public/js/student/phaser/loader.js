// 从现有的美术素材清单取得图片网址（沿用 fallback 规则），交给 Phaser 载入。
// 网址带有 ?v=修改时间，浏览器会缓存，再次进入关卡不必重新下载。
import { ASSETS } from '../../assets/manifest.js';
import { assetUrl } from '../../assets/index.js';

function urlFor(key) {
  let k = key; const seen = new Set();
  while (k && ASSETS[k] && !seen.has(k)) { seen.add(k); const u = assetUrl(k); if (u) return u; k = ASSETS[k].fallback; }
  return null;
}

/** 魔法森林需要的图片：{ Phaser 材质名称: 网址 }（缺图的不列出，场景会改用程序画的图案） */
export function forestTextures(gender) {
  const map = {
    bg: 'bg.play', platform: 'ui.platform', slime: 'enemy.slime',
    doorClosed: 'ui.door.closed', doorOpen: 'ui.door.open',
    coin: 'ui.coin', star: 'ui.star.full', chest: 'ui.chest.closed', chestOpen: 'ui.chest.open',
    hit: 'fx.hit', burst: 'fx.star-burst', cat: 'char.mascot.point',
  };
  for (const pose of ['idle', 'run', 'jump', 'attack', 'hurt', 'win', 'think']) map[`hero_${pose}`] = `char.${gender}.${pose}`;
  const out = {};
  for (const [name, key] of Object.entries(map)) { const u = urlFor(key); if (u) out[name] = u; }
  return out;
}

/** 在场景的 preload() 里呼叫 */
export function loadTexturesInto(scene, textures) {
  for (const [name, url] of Object.entries(textures)) if (!scene.textures.exists(name)) scene.load.image(name, url);
}
