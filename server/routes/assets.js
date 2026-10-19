// 素材索引：列出 public/assets 里已上传的图片与声音，前端据此决定用图片还是备用图案
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { config } from '../config.js';

const ALLOWED = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.mp3', '.ogg', '.m4a', '.wav']);
const ROOT = join(config.root, 'public', 'assets');
let cache = null, cachedAt = 0;

function scan() {
  const files = {};
  if (!existsSync(ROOT)) return files;
  for (const folder of readdirSync(ROOT, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    for (const f of readdirSync(join(ROOT, folder.name), { withFileTypes: true })) {
      if (!f.isFile() || !ALLOWED.has(extname(f.name).toLowerCase())) continue;
      const st = statSync(join(ROOT, folder.name, f.name));
      if (st.size === 0) continue;
      files[`${folder.name}/${f.name}`] = Math.round(st.mtimeMs);
    }
  }
  // 压缩版 .webp 与原图（.png/.jpg）同名并存时：如果原图明显比较新（老师换了新图），
  // 就不用旧的 .webp，避免显示过期的图片。
  for (const k of Object.keys(files)) {
    if (!k.endsWith('.webp')) continue;
    const base = k.slice(0, -5);
    const src = ['.png', '.jpg', '.jpeg'].map(e => files[base + e]).find(Boolean);
    if (src && src > files[k] + 10_000) delete files[k];
  }
  return files;
}

export function assetRoutes(r) {
  r.get('/api/assets/index', async () => {
    // 生产环境缓存 30 秒；开发时每次重新扫描，方便马上看到新图片
    if (!cache || !config.isProduction || Date.now() - cachedAt > 30_000) { cache = scan(); cachedAt = Date.now(); }
    return { files: cache };
  });
}
