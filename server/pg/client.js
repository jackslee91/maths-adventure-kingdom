// 轻量 PostgreSQL 客户端（无第三方依赖）
// 支持：TLS（sslmode=require / verify-full）、SCRAM-SHA-256 / MD5 / 明文认证、
// 参数化查询（扩展查询协议）、简单查询（迁移脚本用）、常用类型解析。
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';

export class PgError extends Error {
  constructor(fields) {
    super(fields.M || '数据库错误');
    this.code = fields.C;
    this.detail = fields.D;
    this.constraint = fields.n;
    this.table = fields.t;
    this.severity = fields.S;
  }
}

export function parseConnectionString(str) {
  const u = new URL(str);
  const sslmode = u.searchParams.get('sslmode') || (/(localhost|127\.0\.0\.1)/.test(u.hostname) ? 'disable' : 'require');
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, '')) || decodeURIComponent(u.username),
    sslmode,
    options: u.searchParams.get('options') || null,
  };
}

// ---------- 类型解析 ----------
function parseArray(s, conv) {
  // 解析 PostgreSQL 数组文字，例如 {1,2,3} 或 {"a b",NULL}
  if (s === '{}') return [];
  const out = [];
  let i = 1, cur = '', quoted = false, inQuote = false;
  for (; i < s.length; i++) {
    const ch = s[i];
    if (inQuote) {
      if (ch === '\\') { cur += s[++i]; continue; }
      if (ch === '"') { inQuote = false; continue; }
      cur += ch; continue;
    }
    if (ch === '"') { inQuote = true; quoted = true; continue; }
    if (ch === ',' || ch === '}') {
      out.push(!quoted && cur === 'NULL' ? null : conv(cur));
      cur = ''; quoted = false;
      if (ch === '}') break;
      continue;
    }
    cur += ch;
  }
  return out;
}

const PARSERS = {
  16: (v) => v === 't',
  20: Number, 21: Number, 23: Number, 26: Number,
  700: Number, 701: Number, 1700: Number,
  114: JSON.parse, 3802: JSON.parse,
  1114: (v) => new Date(v.replace(' ', 'T') + 'Z'),
  1184: (v) => new Date(v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')),
  1082: (v) => v,
  1000: (v) => parseArray(v, (x) => x === 't'),
  1005: (v) => parseArray(v, Number), 1007: (v) => parseArray(v, Number), 1016: (v) => parseArray(v, Number),
  1009: (v) => parseArray(v, String), 1015: (v) => parseArray(v, String),
};

function serialize(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return v;
  if (Array.isArray(v) && v.some(x => x !== null && typeof x === 'object')) return JSON.stringify(v); // 对象数组 → JSON
  if (Array.isArray(v)) {
    return '{' + v.map(x => x === null || x === undefined ? 'NULL'
      : '"' + String(typeof x === 'object' ? JSON.stringify(x) : x).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join(',') + '}';
  }
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

// ---------- 消息编码 ----------
function msg(type, body) {
  const len = Buffer.alloc(4); len.writeInt32BE(body.length + 4);
  return Buffer.concat([type ? Buffer.from(type) : Buffer.alloc(0), len, body]);
}
const cstr = (s) => Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]);
const i16 = (n) => { const b = Buffer.alloc(2); b.writeInt16BE(n); return b; };
const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32BE(n); return b; };

export class Client {
  constructor(config) {
    this.config = config;
    this.socket = null;
    this.buf = Buffer.alloc(0);
    this.queue = [];
    this.current = null;
    this.ready = false;
    this.closed = false;
    this.onClose = null;
  }

  connect() {
    const cfg = this.config;
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (e) => { if (!settled) { settled = true; reject(e); } this.close(); };
      const raw = net.connect({ host: cfg.host, port: cfg.port });
      raw.setKeepAlive(true, 30000);
      raw.setNoDelay(true);
      raw.once('error', fail);
      const startup = (sock) => {
        this.socket = sock;
        sock.on('data', (d) => this._onData(d));
        sock.on('error', (e) => { if (!settled) fail(e); else this._fatal(e); });
        sock.on('close', () => this._fatal(new Error('数据库连接已关闭')));
        this._authDone = (err) => { if (settled) return; settled = true; err ? reject(err) : resolve(this); };
        const params = [cstr('user'), cstr(cfg.user), cstr('database'), cstr(cfg.database), cstr('client_encoding'), cstr('UTF8'), cstr('application_name'), cstr('math-adventure')];
        if (cfg.options) params.push(cstr('options'), cstr(cfg.options));
        sock.write(msg(null, Buffer.concat([i32(196608), ...params, Buffer.from([0])])));
      };
      raw.once('connect', () => {
        if (cfg.sslmode === 'disable') return startup(raw);
        raw.write(Buffer.concat([i32(8), i32(80877103)]));
        raw.once('data', (d) => {
          if (d[0] !== 0x53) {
            if (cfg.sslmode === 'prefer') return startup(raw);
            return fail(new Error('数据库服务器不支持 SSL 连接'));
          }
          const secure = tls.connect({
            socket: raw, servername: net.isIP(cfg.host) ? undefined : cfg.host,
            rejectUnauthorized: cfg.sslmode === 'verify-full' || cfg.sslmode === 'verify-ca',
          });
          secure.once('error', fail);
          secure.once('secureConnect', () => startup(secure));
        });
      });
    });
  }

  _fatal(err) {
    if (this.closed) return;
    this.closed = true;
    this.ready = false;
    if (this._authDone) this._authDone(err);
    const pending = [this.current, ...this.queue].filter(Boolean);
    this.current = null; this.queue = [];
    pending.forEach(p => p.reject(err));
    if (this.onClose) this.onClose(err);
  }

  close() {
    if (this.socket && !this.closed) {
      try { this.socket.write(msg('X', Buffer.alloc(0))); } catch { /* 忽略 */ }
      this.socket.end();
    }
    this.closed = true;
  }

  _onData(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (this.buf.length >= 5) {
      const type = String.fromCharCode(this.buf[0]);
      const len = this.buf.readInt32BE(1);
      if (this.buf.length < len + 1) break;
      const body = this.buf.subarray(5, len + 1);
      this.buf = this.buf.subarray(len + 1);
      try { this._handle(type, body); } catch (e) { this._fatal(e); }
    }
  }

  _handle(type, body) {
    switch (type) {
      case 'R': return this._auth(body);
      case 'S': case 'K': case 'N': case 'A': return;
      case 'Z':
        if (!this.ready) { this.ready = true; if (this._authDone) { const f = this._authDone; this._authDone = null; f(); } return; }
        return this._finish();
      case 'E': {
        const fields = {};
        let i = 0;
        while (i < body.length && body[i] !== 0) {
          const code = String.fromCharCode(body[i]);
          const end = body.indexOf(0, i + 1);
          fields[code] = body.subarray(i + 1, end).toString('utf8');
          i = end + 1;
        }
        const err = new PgError(fields);
        if (!this.ready) { if (this._authDone) { const f = this._authDone; this._authDone = null; f(err); } return; }
        if (this.current) this.current.error = err;
        return;
      }
      case 'T': {
        const n = body.readInt16BE(0);
        let i = 2;
        const fields = [];
        for (let k = 0; k < n; k++) {
          const end = body.indexOf(0, i);
          const name = body.subarray(i, end).toString('utf8');
          i = end + 1;
          const typeOid = body.readInt32BE(i + 6);
          i += 18;
          fields.push({ name, typeOid });
        }
        if (this.current) { this.current.fields = fields; }
        return;
      }
      case 'D': {
        if (!this.current) return;
        const n = body.readInt16BE(0);
        let i = 2;
        const row = {};
        const fields = this.current.fields;
        for (let k = 0; k < n; k++) {
          const len = body.readInt32BE(i); i += 4;
          const f = fields[k];
          if (len === -1) { row[f.name] = null; continue; }
          const s = body.subarray(i, i + len).toString('utf8'); i += len;
          const p = PARSERS[f.typeOid];
          row[f.name] = p ? p(s) : s;
        }
        this.current.rows.push(row);
        return;
      }
      case 'C': {
        if (!this.current) return;
        const tag = body.subarray(0, body.length - 1).toString('utf8');
        const m = tag.match(/(\d+)$/);
        this.current.rowCount = m ? Number(m[1]) : 0;
        this.current.command = tag.split(' ')[0];
        return;
      }
      default: return; // 1 2 3 n I s t 等
    }
  }

  _auth(body) {
    const code = body.readInt32BE(0);
    const cfg = this.config;
    if (code === 0) return;
    if (code === 3) return this.socket.write(msg('p', cstr(cfg.password)));
    if (code === 5) {
      const salt = body.subarray(4, 8);
      const inner = crypto.createHash('md5').update(cfg.password + cfg.user).digest('hex');
      const outer = crypto.createHash('md5').update(Buffer.concat([Buffer.from(inner), salt])).digest('hex');
      return this.socket.write(msg('p', cstr('md5' + outer)));
    }
    if (code === 10) {
      const mechs = body.subarray(4).toString('utf8').split('\0').filter(Boolean);
      if (!mechs.includes('SCRAM-SHA-256')) throw new Error('不支持的数据库认证方式：' + mechs.join(','));
      this._nonce = crypto.randomBytes(18).toString('base64');
      this._firstBare = `n=*,r=${this._nonce}`;
      const data = Buffer.from('n,,' + this._firstBare);
      return this.socket.write(msg('p', Buffer.concat([cstr('SCRAM-SHA-256'), i32(data.length), data])));
    }
    if (code === 11) {
      const serverFirst = body.subarray(4).toString('utf8');
      const attrs = Object.fromEntries(serverFirst.split(',').map(kv => [kv[0], kv.slice(2)]));
      if (!attrs.r.startsWith(this._nonce)) throw new Error('SCRAM 认证失败（nonce 不符）');
      const salted = crypto.pbkdf2Sync(cfg.password.normalize('NFKC'), Buffer.from(attrs.s, 'base64'), Number(attrs.i), 32, 'sha256');
      const clientKey = crypto.createHmac('sha256', salted).update('Client Key').digest();
      const storedKey = crypto.createHash('sha256').update(clientKey).digest();
      const finalNoProof = `c=biws,r=${attrs.r}`;
      const authMessage = `${this._firstBare},${serverFirst},${finalNoProof}`;
      const sig = crypto.createHmac('sha256', storedKey).update(authMessage).digest();
      const proof = Buffer.alloc(clientKey.length);
      for (let i = 0; i < proof.length; i++) proof[i] = clientKey[i] ^ sig[i];
      const serverKey = crypto.createHmac('sha256', salted).update('Server Key').digest();
      this._serverSig = crypto.createHmac('sha256', serverKey).update(authMessage).digest('base64');
      return this.socket.write(msg('p', Buffer.from(`${finalNoProof},p=${proof.toString('base64')}`)));
    }
    if (code === 12) {
      const v = body.subarray(4).toString('utf8').replace(/^v=/, '');
      if (v !== this._serverSig) throw new Error('SCRAM 认证失败（服务器签名不符）');
      return;
    }
    throw new Error('不支持的数据库认证代码 ' + code);
  }

  _finish() {
    const q = this.current;
    this.current = null;
    if (q) {
      if (q.error) q.reject(q.error);
      else q.resolve({ rows: q.rows, rowCount: q.rowCount ?? q.rows.length, command: q.command, fields: q.fields });
    }
    this._next();
  }

  _next() {
    if (this.current || !this.queue.length || this.closed) return;
    this.current = this.queue.shift();
    this.socket.write(this.current.payload);
  }

  query(text, params) {
    if (this.closed) return Promise.reject(new Error('数据库连接已关闭'));
    let payload;
    if (params === undefined) {
      payload = msg('Q', cstr(text));
    } else {
      const vals = params.map(serialize);
      const bindParts = [cstr(''), cstr(''), i16(0), i16(vals.length)];
      for (const v of vals) {
        if (v === null) bindParts.push(i32(-1));
        else { const b = Buffer.isBuffer(v) ? v : Buffer.from(v, 'utf8'); bindParts.push(i32(b.length), b); }
      }
      bindParts.push(i16(0));
      payload = Buffer.concat([
        msg('P', Buffer.concat([cstr(''), cstr(text), i16(0)])),
        msg('B', Buffer.concat(bindParts)),
        msg('D', Buffer.concat([Buffer.from('P'), cstr('')])),
        msg('E', Buffer.concat([cstr(''), i32(0)])),
        msg('S', Buffer.alloc(0)),
      ]);
    }
    const where = new Error().stack;
    return new Promise((resolve, reject) => {
      const rej = (e) => { if (e instanceof PgError) { e.query = text.slice(0, 200); e.stack = `${e.name}: ${e.message}\n    [SQL] ${e.query}\n${where.split('\n').slice(2).join('\n')}`; } reject(e); };
      this.queue.push({ payload, resolve, reject: rej, rows: [], fields: [], error: null });
      this._next();
    });
  }
}
