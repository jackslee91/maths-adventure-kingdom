// 执行数据库迁移：npm run migrate
import { migrate, closeDb } from '../server/db.js';
const applied = await migrate();
console.log(applied.length ? `✅ 已执行：${applied.join(', ')}` : '✅ 数据库已是最新结构');
await closeDb();
