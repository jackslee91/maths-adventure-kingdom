// 连接池：限制同时连接数，自动替换断开的连接（适合 Neon 自动休眠）
import { Client, parseConnectionString } from './client.js';

export class Pool {
  constructor({ connectionString, max = 5, idleMs = 30000 }) {
    this.config = parseConnectionString(connectionString);
    this.max = max;
    this.idleMs = idleMs;
    this.idle = [];      // {client, timer}
    this.total = 0;
    this.waiters = [];
  }

  async _create() {
    this.total++;
    const c = new Client(this.config);
    c.onClose = () => {
      this.idle = this.idle.filter(x => { if (x.client === c) { clearTimeout(x.timer); return false; } return true; });
      if (!c._counted) { c._counted = true; this.total--; this._drain(); }
    };
    try {
      await c.connect();
    } catch (e) {
      if (!c._counted) { c._counted = true; this.total--; }
      this._drain();
      throw e;
    }
    return c;
  }

  _drain() {
    while (this.waiters.length && (this.idle.length || this.total < this.max)) {
      const w = this.waiters.shift();
      this._acquire().then(w.resolve, w.reject);
    }
  }

  async _acquire() {
    while (this.idle.length) {
      const { client, timer } = this.idle.pop();
      clearTimeout(timer);
      if (!client.closed) return client;
    }
    if (this.total < this.max) return this._create();
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  _release(client, destroy) {
    if (destroy || client.closed) {
      client.close();
      if (!client._counted) { client._counted = true; this.total--; }
      this._drain();
      return;
    }
    if (this.waiters.length) { this.waiters.shift().resolve(client); return; }
    const timer = setTimeout(() => {
      this.idle = this.idle.filter(x => x.client !== client);
      client.close();
      if (!client._counted) { client._counted = true; this.total--; }
    }, this.idleMs);
    timer.unref?.();
    this.idle.push({ client, timer });
  }

  /** 单次查询；连接断开时自动重试一次 */
  async query(text, params) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const client = await this._acquire();
      try {
        const res = await client.query(text, params);
        this._release(client);
        return res;
      } catch (e) {
        const connErr = client.closed && !e.code;
        this._release(client, connErr);
        if (connErr && attempt === 0) continue;
        throw e;
      }
    }
    throw new Error('数据库连接失败');
  }

  /** 取得专用连接（事务用），用完必须 release() */
  async connect() {
    const client = await this._acquire();
    let released = false;
    return {
      query: (t, p) => client.query(t, p),
      release: (destroy) => { if (!released) { released = true; this._release(client, destroy); } },
    };
  }

  async end() {
    for (const { client, timer } of this.idle) { clearTimeout(timer); client.close(); }
    this.idle = [];
  }
}
