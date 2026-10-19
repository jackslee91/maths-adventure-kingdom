// 与服务器沟通。学生使用令牌（存在本机，只用来证明身份，学习记录保存在服务器）；教师使用 HttpOnly Cookie。
const TOKEN_KEY = 'ma_student_token';
const PROFILE_KEY = 'ma_student_profile';

export class ApiError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra || {}; }
}

function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* 私密模式 */ } }
function load(k) { try { return localStorage.getItem(k); } catch { return null; } }

export const session = {
  token: () => load(TOKEN_KEY),
  profile: () => { try { return JSON.parse(load(PROFILE_KEY) || 'null'); } catch { return null; } },
  set(token, profile) { store(TOKEN_KEY, token); store(PROFILE_KEY, JSON.stringify(profile)); },
  clear() { store(TOKEN_KEY, null); store(PROFILE_KEY, null); },
};

async function request(method, url, body, { student = false, raw = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (student && session.token()) headers.Authorization = `Bearer ${session.token()}`;
  let res;
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, '网络连接失败，请检查网络后再试一次。');
  }
  if (raw && res.ok) return res;
  let data = {};
  try { data = await res.json(); } catch { /* 非 JSON */ }
  if (!res.ok) {
    if (res.status === 401 && student) session.clear();
    throw new ApiError(res.status, data.error || `出错了（${res.status}）`, data);
  }
  return data;
}

export const api = {
  get: (u) => request('GET', u),
  post: (u, b = {}) => request('POST', u, b),
  put: (u, b = {}) => request('PUT', u, b),
  patch: (u, b = {}) => request('PATCH', u, b),
  del: (u, b = {}) => request('DELETE', u, b),
};
export const sapi = {
  get: (u) => request('GET', u, undefined, { student: true }),
  post: (u, b = {}) => request('POST', u, b, { student: true }),
  put: (u, b = {}) => request('PUT', u, b, { student: true }),
};

/** 下载文件（PDF、ZIP、Excel），文件名由服务器决定 */
export async function download(url, { student = false, fallbackName = '下载文件' } = {}) {
  const res = await request('GET', url, undefined, { student, raw: true });
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const m = cd.match(/filename\*=UTF-8''([^;]+)/);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return name;
}

/** 在新分页打开 PDF（教师用 Cookie，可直接用链接） */
export function openPdf(url) { window.open(url + (url.includes('?') ? '&' : '?') + 'inline=1', '_blank', 'noopener'); }
