// 新增教师账户：npm run create-teacher -- 用户名 密码 "显示名称" [admin]
import { migrate, one, closeDb } from '../server/db.js';
import { hashSecret } from '../server/auth.js';
const [username, password, display, role] = process.argv.slice(2);
if (!username || !password) { console.log('用法：npm run create-teacher -- 用户名 密码 "显示名称" [admin]'); process.exit(1); }
if (password.length < 8) { console.log('密码至少要 8 个字符'); process.exit(1); }
await migrate();
const t = await one(`INSERT INTO teachers (username, display_name, password_hash, role) VALUES ($1, $2, $3, $4)
  ON CONFLICT (username) DO UPDATE SET password_hash = $3, display_name = $2, role = $4, token_version = teachers.token_version + 1 RETURNING id, username, role`,
  [username.toLowerCase(), display || username, await hashSecret(password), role === 'admin' ? 'admin' : 'teacher']);
console.log(`✅ 教师账户已就绪：${t.username}（${t.role === 'admin' ? '管理员' : '教师'}）`);
await closeDb();
