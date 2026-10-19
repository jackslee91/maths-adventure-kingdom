// 数据库连接与迁移
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Pool } from './pg/pool.js';
import { config } from './config.js';

const here = dirname(fileURLToPath(import.meta.url));
let pool = null;

export function db() {
  if (!pool) {
    if (!config.databaseUrl) throw new Error('没有设置 DATABASE_URL 环境变量');
    pool = new Pool({ connectionString: config.databaseUrl, max: config.dbPoolMax });
  }
  return pool;
}

export const q = (text, params = []) => db().query(text, params);
export const one = async (text, params = []) => (await q(text, params)).rows[0] || null;
export const all = async (text, params = []) => (await q(text, params)).rows;

/** 事务：fn(client) 中抛出错误会自动回滚 */
export async function tx(fn) {
  const c = await db().connect();
  try {
    await c.query('BEGIN', []);
    const out = await fn({ q: (t, p = []) => c.query(t, p), one: async (t, p = []) => (await c.query(t, p)).rows[0] || null, all: async (t, p = []) => (await c.query(t, p)).rows });
    await c.query('COMMIT', []);
    c.release();
    return out;
  } catch (e) {
    try { await c.query('ROLLBACK', []); c.release(); } catch { c.release(true); }
    throw e;
  }
}

export async function migrate() {
  await db().query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const done = new Set((await all('SELECT version FROM schema_migrations')).map(r => r.version));
  const dir = join(here, '..', 'db', 'migrations');
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const applied = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(join(dir, f), 'utf8');
    const c = await db().connect();
    try {
      await c.query('BEGIN');
      await c.query(sql);
      await c.query('INSERT INTO schema_migrations(version) VALUES ($1)', [f]);
      await c.query('COMMIT');
      c.release();
      applied.push(f);
    } catch (e) {
      try { await c.query('ROLLBACK'); } catch { /* 忽略 */ }
      c.release(true);
      throw new Error(`迁移 ${f} 失败：${e.message}`);
    }
  }
  return applied;
}

export async function closeDb() { if (pool) await pool.end(); pool = null; }
