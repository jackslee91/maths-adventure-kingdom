// 载入题库：npm run seed   （加 --force 会用题库文件覆盖系统题目，不影响老师新增的题目）
import { migrate, closeDb } from '../server/db.js';
import { seedContent } from './seed-lib.js';
await migrate();
const r = await seedContent({ force: process.argv.includes('--force') });
console.log(`✅ 新增 ${r.added} 道题，更新 ${r.updated} 道题`);
if (r.rejected.length) console.log('⚠️ 以下题目没有通过验证，未载入：\n' + r.rejected.join('\n'));
await closeDb();
