// 数学冒险王 —— 服务器入口
import http from 'node:http';
import { join } from 'node:path';
import { config, assertConfig } from './config.js';
import { Router, createApp } from './http.js';
import { migrate, one, q } from './db.js';
import { hashSecret } from './auth.js';
import { studentRoutes } from './routes/student.js';
import { teacherRoutes } from './routes/teacher.js';
import { assetRoutes } from './routes/assets.js';
import { seedContent } from '../scripts/seed-lib.js';

assertConfig();

const router = new Router();
router.get('/api/health', async () => {
  await one('SELECT 1 AS ok');
  return { ok: true, time: new Date().toISOString() };
});
studentRoutes(router);
teacherRoutes(router);
assetRoutes(router);

const app = createApp({
  router,
  trustProxy: config.trustProxy,
  staticDirs: [
    { prefix: '/shared/', dir: join(config.root, 'shared'), maxAge: 0 },
    // 素材网址带有 ?v=修改时间，换图后网址会改变，所以可以长时间缓存
    { prefix: '/assets/', dir: join(config.root, 'public', 'assets'), maxAge: 604800 },
    { prefix: '/', dir: join(config.root, 'public'), maxAge: 0 },
  ],
  spaIndex: join(config.root, 'public', 'index.html'),
});

async function bootstrap() {
  const applied = await migrate();
  if (applied.length) console.log('✅ 已执行数据库迁移：', applied.join(', '));
  const n = await one('SELECT count(*)::int AS n FROM units');
  if (n.n === 0) { await seedContent(); console.log('✅ 已载入课本单元与题库'); }
  const t = await one('SELECT count(*)::int AS n FROM teachers');
  if (t.n === 0) {
    if (config.adminUsername && config.adminPassword) {
      if (config.adminPassword.length < 8) throw new Error('ADMIN_PASSWORD 至少要 8 个字符');
      await q('INSERT INTO teachers (username, display_name, password_hash, role) VALUES ($1, $2, $3, $4)',
        [config.adminUsername.toLowerCase(), config.adminDisplayName, await hashSecret(config.adminPassword), 'admin']);
      console.log(`✅ 已建立管理员账户：${config.adminUsername}`);
    } else {
      console.warn('⚠️ 还没有教师账户。请设置 ADMIN_USERNAME 与 ADMIN_PASSWORD 环境变量后重启，或执行 npm run create-teacher。');
    }
  }
}

bootstrap().then(() => {
  const server = http.createServer(app);
  server.keepAliveTimeout = 65_000;
  server.listen(config.port, () => console.log(`🚀 数学冒险王已启动：http://localhost:${config.port}`));
}).catch((e) => {
  console.error('❌ 启动失败：', e.message);
  process.exit(1);
});
