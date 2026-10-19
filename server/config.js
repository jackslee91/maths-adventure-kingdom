// 读取环境变量（支持项目根目录的 .env 文件）
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

const env = process.env;
export const config = {
  root,
  port: Number(env.PORT || 3000),
  databaseUrl: env.DATABASE_URL || '',
  dbPoolMax: Number(env.DB_POOL_MAX || 5),
  sessionSecret: env.SESSION_SECRET || '',
  isProduction: env.NODE_ENV === 'production',
  adminUsername: env.ADMIN_USERNAME || '',
  adminPassword: env.ADMIN_PASSWORD || '',
  adminDisplayName: env.ADMIN_DISPLAY_NAME || '管理员',
  schoolName: env.SCHOOL_NAME || '',
  trustProxy: env.TRUST_PROXY !== 'false',
};

export function assertConfig() {
  const problems = [];
  if (!config.databaseUrl) problems.push('DATABASE_URL 未设置');
  if (!config.sessionSecret || config.sessionSecret.length < 32) problems.push('SESSION_SECRET 未设置或少于 32 个字符');
  if (problems.length) {
    console.error('❌ 环境变量配置不完整：\n - ' + problems.join('\n - ') + '\n请参考 .env.example。');
    process.exit(1);
  }
}
