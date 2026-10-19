// 由素材清单产生《美术素材指南》中的素材一览表：node scripts/asset-guide.js
import { writeFileSync, readFileSync } from 'node:fs';
import { ASSETS, FOLDERS } from '../public/js/assets/manifest.js';

let md = '';
for (const [folder, title] of Object.entries(FOLDERS)) {
  md += `\n### ${folder}/ —— ${title}\n\n| 文件名 | 用途 | 建议尺寸 | 透明背景 | 动画 | 没有上传时 |\n|---|---|---|---|---|---|\n`;
  for (const [k, a] of Object.entries(ASSETS).filter(([, a]) => a.folder === folder)) {
    const fb = !a.fallback || a.fallback === 'none' ? '不显示' : a.fallback === 'css' ? '原本的程序样式' : a.fallback === 'synth' ? '程序合成声音' : ASSETS[a.fallback] ? `改用 ${ASSETS[a.fallback].folder}/${ASSETS[a.fallback].name}` : '程序画的图案';
    md += `| \`${a.name}.${a.ext[0]}\`${a.ext.length > 1 ? `（也可 ${a.ext.slice(1).filter(x => x !== 'jpeg').map(x => '.' + x).join(' ')}）` : ''} | **${a.label}**：${a.use} | ${a.size} | ${a.folder === 'audio' ? '—' : a.alpha ? '✅ 需要' : '不需要'} | ${a.anim || '—'} | ${fb} |\n`;
  }
}
const path = new URL('../docs/美术素材指南.md', import.meta.url);
const doc = readFileSync(path, 'utf8');
const start = '<!-- 素材一览表开始 -->', end = '<!-- 素材一览表结束 -->';
writeFileSync(path, doc.slice(0, doc.indexOf(start) + start.length) + '\n' + md + '\n' + doc.slice(doc.indexOf(end)));
console.log(`✅ 已更新素材一览表（${Object.keys(ASSETS).length} 项）`);
