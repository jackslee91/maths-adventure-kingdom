// 认证：教师（签名 Cookie）与学生（随机令牌，数据库存哈希）
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.js';
import { one, q } from './db.js';
import { HttpError } from './http.js';

const scrypt = promisify(crypto.scrypt);
const TEACHER_COOKIE = 'ma_teacher';
const TEACHER_TTL = 12 * 3600; // 12 小时
const STUDENT_TTL_DAYS = 180;

export async function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(secret).normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifySecret(secret, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, N, r, p, saltB64, keyB64] = stored.split('$');
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(String(secret).normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return crypto.timingSafeEqual(key, expected);
}

const b64u = (b) => Buffer.from(b).toString('base64url');
function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', config.sessionSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function unsign(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', config.sessionSecret).update(body).digest('base64url');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (p.exp < Date.now() / 1000) return null;
    return p;
  } catch { return null; }
}

export function setTeacherCookie(req, res, teacher) {
  const token = sign({ tid: teacher.id, v: teacher.token_version, exp: Math.floor(Date.now() / 1000) + TEACHER_TTL });
  res.cookie(TEACHER_COOKIE, token, { maxAge: TEACHER_TTL, secure: req.secure || config.isProduction });
}
export function clearTeacherCookie(req, res) {
  res.cookie(TEACHER_COOKIE, '', { maxAge: 0, secure: req.secure || config.isProduction });
}

/** 中间件：要求教师登录 */
export async function requireTeacher(req) {
  const p = unsign(req.cookies[TEACHER_COOKIE]);
  if (!p) throw new HttpError(401, '请先以教师身份登录。');
  const t = await one('SELECT id, username, display_name, role, token_version FROM teachers WHERE id = $1', [p.tid]);
  if (!t || t.token_version !== p.v) throw new HttpError(401, '登录已失效，请重新登录。');
  req.teacher = t;
  return 'next';
}

export function newStudentToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: crypto.createHash('sha256').update(token).digest('hex') };
}

export async function createStudentSession(studentId) {
  const { token, hash } = newStudentToken();
  await q(`INSERT INTO student_sessions (student_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '${STUDENT_TTL_DAYS} days')`, [studentId, hash]);
  return token;
}

/** 中间件：要求学生令牌 */
export async function requireStudent(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) throw new HttpError(401, '请先登录冒险者身份。');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const s = await one(`SELECT st.id, st.name, st.class_id, st.pupil_no, c.name AS class_name, c.teacher_id
    FROM student_sessions ss JOIN students st ON st.id = ss.student_id JOIN classes c ON c.id = st.class_id
    WHERE ss.token_hash = $1 AND ss.expires_at > now()`, [hash]);
  if (!s) throw new HttpError(401, '登录已失效，请重新输入姓名和班级。');
  req.student = s;
  req.studentTokenHash = hash;
  q('UPDATE students SET last_seen_at = now() WHERE id = $1', [s.id]).catch(() => {});
  return 'next';
}

/** 教师是否可以管理该班级（管理员可管理全部） */
export async function assertClassAccess(teacher, classId) {
  const c = await one('SELECT id, name, teacher_id, school_name, is_demo FROM classes WHERE id = $1', [classId]);
  if (!c) throw new HttpError(404, '找不到这个班级。');
  if (teacher.role !== 'admin' && c.teacher_id !== teacher.id) throw new HttpError(403, '你没有权限查看这个班级。');
  return c;
}

export function teacherClassFilter(teacher, alias = 'c') {
  return teacher.role === 'admin' ? { sql: 'TRUE', params: [] } : { sql: `${alias}.teacher_id = $X`, params: [teacher.id] };
}
