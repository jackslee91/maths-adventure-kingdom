// 极简 HTTP 框架：路由、JSON、Cookie、静态文件、安全标头（无第三方依赖）
import { createReadStream, statSync, existsSync } from 'node:fs';
import { join, normalize, extname, sep } from 'node:path';

export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
};

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export class Router {
  constructor() { this.routes = []; }
  add(method, path, ...handlers) {
    const keys = [];
    const re = new RegExp('^' + path.replace(/\/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
    this.routes.push({ method, re, keys, handlers });
  }
  get(p, ...h) { this.add('GET', p, ...h); }
  post(p, ...h) { this.add('POST', p, ...h); }
  put(p, ...h) { this.add('PUT', p, ...h); }
  patch(p, ...h) { this.add('PATCH', p, ...h); }
  delete(p, ...h) { this.add('DELETE', p, ...h); }
  match(method, path) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = path.match(r.re);
      if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  }
}

async function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, '提交的内容太大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
}

/** 给 res 加上便利方法 */
function decorate(req, res) {
  res.json = (status, obj) => {
    const body = Buffer.from(JSON.stringify(obj));
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
    res.end(body);
  };
  res.file = (buf, contentType, filename, inline = false) => {
    const enc = encodeURIComponent(filename);
    res.writeHead(200, {
      'Content-Type': contentType, 'Content-Length': buf.length, 'Cache-Control': 'no-store',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${enc}"; filename*=UTF-8''${enc}`,
    });
    res.end(buf);
  };
  res.cookie = (name, value, opts = {}) => {
    const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
    if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
    if (opts.secure) parts.push('Secure');
    const prev = res.getHeader('Set-Cookie');
    res.setHeader('Set-Cookie', [...(Array.isArray(prev) ? prev : prev ? [prev] : []), parts.join('; ')]);
  };
}

export function createApp({ router, staticDirs, spaIndex, trustProxy }) {
  return async function handler(req, res) {
    securityHeaders(res);
    decorate(req, res);
    const url = new URL(req.url, 'http://localhost');
    req.path = url.pathname;
    req.query = Object.fromEntries(url.searchParams);
    req.cookies = parseCookies(req.headers.cookie);
    req.ip = (trustProxy && req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress;
    req.secure = req.socket.encrypted || (trustProxy && req.headers['x-forwarded-proto'] === 'https');
    try {
      if (req.path.startsWith('/api/')) {
        const m = router.match(req.method, req.path);
        if (!m) throw new HttpError(404, '找不到这个功能');
        req.params = m.params;
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
          // 防 CSRF：只接受 JSON，且来源必须相同
          const origin = req.headers.origin;
          if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, '请求来源不被允许');
          const raw = await readBody(req);
          if (raw.length) {
            if (!(req.headers['content-type'] || '').includes('application/json')) throw new HttpError(415, '请求格式必须是 JSON');
            try { req.body = JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, '请求内容格式错误'); }
          } else req.body = {};
        }
        for (const h of m.route.handlers) {
          const r = await h(req, res);
          if (res.writableEnded || r === 'done') return;
          if (r !== undefined && r !== 'next') return res.json(200, r);
        }
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, '不支持的请求');
      // 静态文件
      for (const { prefix, dir, maxAge } of staticDirs) {
        if (!req.path.startsWith(prefix)) continue;
        const rel = decodeURIComponent(req.path.slice(prefix.length));
        const full = normalize(join(dir, rel));
        if (!full.startsWith(dir + sep) && full !== dir) throw new HttpError(403, '禁止访问');
        if (existsSync(full) && statSync(full).isFile()) {
          const st = statSync(full);
          res.writeHead(200, {
            'Content-Type': MIME[extname(full)] || 'application/octet-stream',
            'Content-Length': st.size,
            'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-cache',
            'Last-Modified': st.mtime.toUTCString(),
          });
          if (req.method === 'HEAD') return res.end();
          return createReadStream(full).pipe(res);
        }
      }
      // 单页应用回退
      if (spaIndex && !extname(req.path)) {
        const st = statSync(spaIndex);
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
        return createReadStream(spaIndex).pipe(res);
      }
      throw new HttpError(404, '找不到这个页面');
    } catch (e) {
      const status = e.status || (e.code === '23505' ? 409 : 500);
      if (status >= 500) console.error(new Date().toISOString(), req.method, req.path, e);
      if (!res.headersSent) {
        const message = status >= 500 ? '服务器出了点问题，请稍后再试。' : e.message;
        res.json(status, { error: message, ...(e.extra || {}) });
      } else res.end();
    }
  };
}

/** 简单的内存限流（登录、PIN 尝试） */
export function rateLimiter({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, windowMs).unref();
  return (key) => {
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset < now) { h = { count: 0, reset: now + windowMs }; hits.set(key, h); }
    h.count++;
    if (h.count > max) throw new HttpError(429, message || '尝试次数太多，请稍后再试。');
  };
}
