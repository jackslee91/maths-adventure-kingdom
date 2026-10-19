// 教师管理中心：美术素材检查（哪些图片已上传、尺寸与透明背景是否正确）
import { esc, el } from '../ui.js';
import { ASSETS, FOLDERS } from '../assets/manifest.js';
import { initAssets, assetUrl, assetFile, failedAssets } from '../assets/loader.js';
import * as fb from '../assets/index.js';

/** 未上传时显示的备用图案（缩图） */
function fallbackPreview(key) {
  const map = {
    'char.boy.idle': () => fb.explorer(70), 'char.boy.cheer': () => fb.explorer(70, 'cheer'), 'char.boy.think': () => fb.explorer(70), 'char.boy.attack': () => fb.explorer(70, 'cheer'),
    'char.girl.idle': () => fb.explorerGirl(70), 'char.girl.cheer': () => fb.explorerGirl(70, 'cheer'),
    'char.mascot.idle': () => fb.mascot('happy', 64), 'char.mascot.happy': () => fb.mascot('happy', 64), 'char.mascot.wow': () => fb.mascot('wow', 64), 'char.mascot.sad': () => fb.mascot('sad', 64),
    'char.teacher': () => fb.teacherArt(60), 'char.avatar.boy': () => fb.avatar(48), 'char.avatar.girl': () => fb.avatar(48),
    'enemy.boss.idle': () => fb.boss('idle', 80), 'enemy.boss.hurt': () => fb.boss('hurt', 80), 'enemy.boss.attack': () => fb.boss('attack', 80), 'enemy.boss.defeated': () => fb.boss('defeated', 80),
    'ui.chest.closed': () => fb.chest(false, 70), 'ui.chest.open': () => fb.chest(true, 70), 'ui.door.closed': () => fb.door(false, 'A'), 'ui.door.open': () => fb.door(true),
    'ui.key-item': () => fb.keyItem(), 'ui.medal': () => fb.medal('数学王者', 70), 'ui.coin': () => fb.coin(40), 'ui.heart.full': () => fb.heart(true, 40), 'ui.heart.empty': () => fb.heart(false, 40),
    'ui.star.full': () => fb.stars(1, 1, 40), 'ui.star.empty': () => fb.stars(0, 1, 40),
  };
  if (key.startsWith('ui.badge.')) { const k = key.slice(9); return fb.badge(k, '', true); }
  if (key === 'map.background') return '<div class="thumb-scene">地图：程序画的海洋与六座岛</div>';
  if (key.startsWith('bg.')) return `<div class="thumb-scene">${['bg.home', 'bg.login', 'bg.maze', 'bg.boss', 'bg.victory'].includes(key) ? '程序画的场景' : '原本的颜色背景'}</div>`;
  if (key.startsWith('ui.')) return '<div class="thumb-scene">原本的程序样式</div>';
  if (key.startsWith('map.island')) return '<div class="thumb-scene">程序画的岛屿</div>';
  if (ASSETS[key].folder === 'audio') return '<div class="thumb-scene">程序合成的声音</div>';
  if (ASSETS[key].folder === 'effects') return '<div class="thumb-scene">程序特效</div>';
  return (map[key] || (() => '<div class="thumb-scene">—</div>'))();
}

/** 读取图片尺寸，并检查四个角是否透明 */
function inspectImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const r = { w: img.naturalWidth, h: img.naturalHeight, transparent: null };
      try {
        const c = document.createElement('canvas'); c.width = 8; c.height = 8;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, 8, 8);
        const px = (x, y) => g.getImageData(x, y, 1, 1).data[3];
        r.transparent = [px(0, 0), px(7, 0), px(0, 7), px(7, 7)].some(a => a < 250);
      } catch { /* 忽略 */ }
      resolve(r);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function renderAssetCheck(main) {
  await initAssets();
  const entries = Object.entries(ASSETS);
  const uploaded = entries.filter(([k]) => assetUrl(k)).length;
  main.innerHTML = `<h1>美术素材</h1>
    <p class="desc">把图片放进项目的 <code>public/assets/</code> 对应文件夹（文件名要和下面一样），重新部署后按“重新检查”。没有上传的素材会自动使用程序画的备用图案，游戏照常运作。图片里不要有文字。</p>
    <div class="kpis"><div class="kpi"><span>已上传</span><b>${uploaded}</b></div><div class="kpi"><span>使用备用图案</span><b>${entries.length - uploaded}</b></div><div class="kpi"><span>素材总数</span><b>${entries.length}</b></div></div>
    <div class="t-card row"><button class="btn small" id="recheck">重新检查</button><span class="desc" style="margin:0">详细的尺寸、文件名与画图提示请看项目中的 <code>docs/美术素材指南.md</code>。</span></div>
    ${Object.entries(FOLDERS).map(([folder, title]) => `<div class="t-card"><h2>${esc(folder)}/　${esc(title)}</h2><div class="tbl-wrap"><table class="tbl asset-tbl"><thead><tr><th>预览</th><th>素材</th><th>文件名</th><th>建议尺寸</th><th>透明背景</th><th>状态</th></tr></thead><tbody>
      ${entries.filter(([, a]) => a.folder === folder).map(([k, a]) => {
        const url = assetUrl(k), file = assetFile(k);
        const preview = !url ? fallbackPreview(k) : a.folder === 'audio' ? `<button class="btn small ghost" data-play="${esc(url)}">试听</button>` : `<img src="${esc(url)}" alt="" class="asset-thumb ${a.alpha ? 'checker' : ''}">`;
        return `<tr data-key="${esc(k)}"><td class="thumb">${preview}</td><td><b>${esc(a.label)}</b><br><small>${esc(a.use)}</small><br><small class="desc">代号：${esc(k)}${a.anim ? `　动画：${esc(a.anim)}` : ''}</small></td>
          <td class="num"><code>${esc(a.folder)}/${esc(a.name)}</code><br><small>${a.ext.map(x => '.' + x).join(' / ')}</small>${file ? `<br><small>目前：${esc(file)}</small>` : ''}</td>
          <td class="num">${esc(a.size)}<div class="dim-check"></div></td><td>${a.folder === 'audio' ? '—' : a.alpha ? '需要' : '不需要'}</td>
          <td class="st">${url ? '<span class="pill ok">已上传</span>' : '<span class="pill">未上传，使用备用图案</span>'}</td></tr>`;
      }).join('')}</tbody></table></div></div>`).join('')}`;
  main.querySelector('#recheck').onclick = () => renderAssetCheck(main);
  main.querySelectorAll('[data-play]').forEach(b => b.onclick = () => { new Audio(b.dataset.play).play().catch(() => {}); });
  // 逐一检查已上传图片的尺寸与透明度
  const failed = failedAssets();
  for (const [k, a] of entries) {
    const url = assetUrl(k);
    const row = main.querySelector(`tr[data-key="${CSS.escape(k)}"]`);
    if (!row) continue;
    if (failed.has(k)) { row.querySelector('.st').innerHTML = '<span class="pill bad">加载失败，已改用备用图案</span>'; continue; }
    if (!url || a.folder === 'audio') continue;
    const info = await inspectImage(url);
    if (!info) { row.querySelector('.st').innerHTML = '<span class="pill bad">文件无法打开</span>'; continue; }
    const notes = [];
    const [rw, rh] = a.size.split('×').map(Number);
    if (rw && rh) {
      const ratio = info.w / info.h, want = rw / rh;
      if (Math.abs(ratio - want) / want > 0.15) notes.push('长宽比例和建议不同，画面可能被裁切或变形');
      if (info.w < rw * 0.5) notes.push('图片太小，放大后会模糊');
    }
    if (a.alpha && info.transparent === false) notes.push('四个角不是透明的，可能有白底');
    row.querySelector('.dim-check').innerHTML = `<small>实际：${info.w}×${info.h}</small>`;
    if (notes.length) row.querySelector('.st').innerHTML = `<span class="pill warn">已上传，请检查</span><br><small>${notes.map(esc).join('；')}</small>`;
  }
}
