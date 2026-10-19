// 教师端 API（全部需要登录，并在服务器端检查班级权限）
import { all, one, q, tx } from '../db.js';
import { HttpError, rateLimiter } from '../http.js';
import { requireTeacher, setTeacherCookie, clearTeacherCookie, hashSecret, verifySecret, assertClassAccess } from '../auth.js';
import { getTeacherSettings, saveTeacherSettings, DEFAULT_SETTINGS } from '../services/settings.js';
import { loadBank, invalidateBank, getQuestion, skillTags } from '../services/questions.js';
import { individualReport, classReport, reportKey, fmtDateTime } from '../services/reports.js';
import { individualPdf, classPdf } from '../pdf/reports-pdf.js';
import { makeZip, makeXlsx, makeCsv } from '../zip.js';
import { verifyQuestion, correctResponse } from '../verify.js';
import { markAnswer, correctAnswerText } from '../../shared/marking.js';
import { buildFromExpression, parseExpression } from '../../content/builders.js';
import { LESSONS } from '../../content/lessons.js';
import { STAGE_NAMES } from '../services/learning.js';

const loginLimit = rateLimiter({ windowMs: 15 * 60_000, max: 10, message: '登录尝试太多，请 15 分钟后再试。' });
const T = requireTeacher;

function safeName(s) { return String(s || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40); }

function reportParams(req) {
  const p = req.query;
  const classId = Number(p.class_id);
  if (!classId) throw new HttpError(400, '请选择班级。');
  const unitId = String(p.unit_id || '');
  if (!unitId) throw new HttpError(400, '请选择单元。');
  const date = (d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const ids = p.ids ? String(p.ids).split(',').map(Number).filter(Boolean) : null;
  return { classId, unitId, quizId: p.quiz_id ? Number(p.quiz_id) : null, from: date(p.from), to: date(p.to), studentIds: ids };
}

export function teacherRoutes(r) {
  // ---------------- 登录
  r.post('/api/teacher/login', async (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    loginLimit(`${req.ip}|${username}`);
    const t = await one('SELECT * FROM teachers WHERE username = $1', [username]);
    if (!t || !(await verifySecret(String(req.body.password || ''), t.password_hash))) throw new HttpError(401, '用户名或密码不正确。');
    setTeacherCookie(req, res, t);
    return { teacher: { id: t.id, username: t.username, displayName: t.display_name, role: t.role } };
  });
  r.post('/api/teacher/logout', async (req, res) => { clearTeacherCookie(req, res); return { ok: true }; });
  r.get('/api/teacher/me', T, async (req) => ({ teacher: { id: req.teacher.id, username: req.teacher.username, displayName: req.teacher.display_name, role: req.teacher.role } }));
  r.post('/api/teacher/password', T, async (req, res) => {
    const t = await one('SELECT * FROM teachers WHERE id = $1', [req.teacher.id]);
    if (!(await verifySecret(String(req.body.current || ''), t.password_hash))) throw new HttpError(400, '现在的密码不正确。');
    const next = String(req.body.next || '');
    if (next.length < 8) throw new HttpError(400, '新密码至少要 8 个字符。');
    const u = await one('UPDATE teachers SET password_hash = $2, token_version = token_version + 1 WHERE id = $1 RETURNING *', [t.id, await hashSecret(next)]);
    setTeacherCookie(req, res, u);
    return { ok: true };
  });

  // 管理员：教师账户
  r.get('/api/teacher/teachers', T, async (req) => {
    if (req.teacher.role !== 'admin') throw new HttpError(403, '只有管理员可以管理教师账户。');
    return { teachers: await all('SELECT id, username, display_name, role, created_at FROM teachers ORDER BY id') };
  });
  r.post('/api/teacher/teachers', T, async (req) => {
    if (req.teacher.role !== 'admin') throw new HttpError(403, '只有管理员可以管理教师账户。');
    const username = String(req.body.username || '').trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,30}$/.test(username)) throw new HttpError(400, '用户名只能用 3–30 个英文字母、数字或 _ . -');
    if (String(req.body.password || '').length < 8) throw new HttpError(400, '密码至少要 8 个字符。');
    const t = await one('INSERT INTO teachers (username, display_name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, display_name, role',
      [username, String(req.body.display_name || username).slice(0, 40), await hashSecret(req.body.password), req.body.role === 'admin' ? 'admin' : 'teacher']);
    return { teacher: t };
  });

  // ---------------- 设置
  r.get('/api/teacher/settings', T, async (req) => ({ settings: await getTeacherSettings(req.teacher.id), defaults: DEFAULT_SETTINGS }));
  r.put('/api/teacher/settings', T, async (req) => ({ settings: await saveTeacherSettings(req.teacher.id, req.body.settings || {}) }));

  // ---------------- 班级与名单
  r.get('/api/teacher/classes', T, async (req) => ({
    classes: await all(`SELECT c.id, c.name, c.school_name, c.is_demo, c.teacher_id, t.display_name AS teacher_name,
      (SELECT count(*)::int FROM students s WHERE s.class_id = c.id) AS student_count
      FROM classes c LEFT JOIN teachers t ON t.id = c.teacher_id WHERE ($1 OR c.teacher_id = $2) ORDER BY c.is_demo, c.name`, [req.teacher.role === 'admin', req.teacher.id]),
  }));
  r.post('/api/teacher/classes', T, async (req) => {
    const name = String(req.body.name || '').trim().slice(0, 30);
    if (!name) throw new HttpError(400, '请输入班级名称。');
    try {
      return { class: await one('INSERT INTO classes (name, teacher_id, school_name) VALUES ($1, $2, $3) RETURNING *', [name, req.teacher.id, String(req.body.school_name || '').slice(0, 80) || null]) };
    } catch (e) { if (e.code === '23505') throw new HttpError(409, '这个班级名称已经存在。'); throw e; }
  });
  r.patch('/api/teacher/classes/:id', T, async (req) => {
    await assertClassAccess(req.teacher, Number(req.params.id));
    const name = String(req.body.name || '').trim().slice(0, 30);
    if (!name) throw new HttpError(400, '请输入班级名称。');
    return { class: await one('UPDATE classes SET name = $2, school_name = $3 WHERE id = $1 RETURNING *', [Number(req.params.id), name, String(req.body.school_name || '').slice(0, 80) || null]) };
  });
  r.delete('/api/teacher/classes/:id', T, async (req) => {
    const c = await assertClassAccess(req.teacher, Number(req.params.id));
    if (req.body?.confirm !== c.name) throw new HttpError(400, '请输入班级名称以确认删除（班级的所有学生记录都会被删除）。');
    await q('DELETE FROM classes WHERE id = $1', [c.id]);
    return { ok: true };
  });

  r.get('/api/teacher/classes/:id/students', T, async (req) => {
    await assertClassAccess(req.teacher, Number(req.params.id));
    return { students: await all(`SELECT s.id, s.name, s.pupil_no, s.source, s.is_demo, (s.pin_hash IS NOT NULL) AS has_pin, s.last_seen_at, s.created_at,
      (SELECT count(*)::int FROM assessments a WHERE a.student_id = s.id) AS assessments
      FROM students s WHERE s.class_id = $1 ORDER BY s.pupil_no NULLS LAST, s.name`, [Number(req.params.id)]) };
  });
  r.post('/api/teacher/classes/:id/students', T, async (req) => {
    const c = await assertClassAccess(req.teacher, Number(req.params.id));
    // 支持每行一个名字，或 “学号 姓名” / “姓名,学号”
    const lines = String(req.body.text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 80);
    const added = [], skipped = [];
    for (const line of lines) {
      let name = line, pupilNo = null;
      let m = line.match(/^(\d{1,6})[\s,，、.]+(.+)$/) || null;
      if (m) { pupilNo = m[1]; name = m[2]; } else if ((m = line.match(/^(.+?)[,，\t]\s*(\S+)$/))) { name = m[1]; pupilNo = m[2]; }
      name = name.replace(/\s+/g, ' ').trim().slice(0, 30);
      if (name.length < 2) { skipped.push(line); continue; }
      const row = await one(`INSERT INTO students (class_id, name, pupil_no, source, is_demo) VALUES ($1, $2, $3, 'roster', $4)
        ON CONFLICT DO NOTHING RETURNING id, name, pupil_no`, [c.id, name, pupilNo, c.is_demo]);
      if (row) added.push(row); else skipped.push(line);
    }
    return { added, skipped };
  });
  r.patch('/api/teacher/students/:id', T, async (req) => {
    const s = await one('SELECT * FROM students WHERE id = $1', [Number(req.params.id)]);
    if (!s) throw new HttpError(404, '找不到这位学生。');
    await assertClassAccess(req.teacher, s.class_id);
    if (req.body.resetPin) {
      await q('UPDATE students SET pin_hash = NULL WHERE id = $1', [s.id]);
      await q('DELETE FROM student_sessions WHERE student_id = $1', [s.id]);
      return { ok: true, message: `${s.name} 的冒险密码已重设，下次登录时可以设定新密码。` };
    }
    const name = String(req.body.name ?? s.name).replace(/\s+/g, ' ').trim().slice(0, 30);
    if (name.length < 2) throw new HttpError(400, '姓名太短。');
    const row = await one(`UPDATE students SET name = $2, pupil_no = $3, source = 'roster' WHERE id = $1 RETURNING id, name, pupil_no`, [s.id, name, String(req.body.pupil_no ?? s.pupil_no ?? '').trim() || null]);
    return { student: row };
  });
  r.delete('/api/teacher/students/:id', T, async (req) => {
    const s = await one('SELECT * FROM students WHERE id = $1', [Number(req.params.id)]);
    if (!s) throw new HttpError(404, '找不到这位学生。');
    await assertClassAccess(req.teacher, s.class_id);
    await q('DELETE FROM students WHERE id = $1', [s.id]);
    return { ok: true };
  });

  // ---------------- 单元与题库
  r.get('/api/teacher/units', T, async () => ({
    units: await all(`SELECT u.*, (SELECT json_agg(json_build_object('id', s.id, 'code', s.code, 'title', s.title,
        'count', (SELECT count(*)::int FROM questions qq WHERE qq.subtopic_id = s.id AND qq.is_active)) ORDER BY s.sort) FROM subtopics s WHERE s.unit_id = u.id) AS subtopics
      FROM units u ORDER BY u.sort, u.code`),
  }));
  r.post('/api/teacher/units', T, async (req) => {
    const code = String(req.body.code || '').trim().slice(0, 10), title = String(req.body.title || '').trim().slice(0, 40);
    if (!code || !title) throw new HttpError(400, '请输入单元编号和名称。');
    const id = 'U' + code.replace(/[^0-9a-zA-Z]+/g, '-');
    const subs = (req.body.subtopics || []).map(s => ({ code: String(s.code || '').trim(), title: String(s.title || '').trim() })).filter(s => s.code && s.title);
    if (!subs.length) throw new HttpError(400, '至少要有一个知识点。');
    return tx(async (c) => {
      const u = await c.one('INSERT INTO units (id, code, title, description, sort) VALUES ($1, $2, $3, $4, (SELECT coalesce(max(sort),0)+1 FROM units)) RETURNING *', [id, code, title, String(req.body.description || '')]);
      let i = 0;
      for (const s of subs) await c.q('INSERT INTO subtopics (id, unit_id, code, title, sort) VALUES ($1, $2, $3, $4, $5)', [`${id}-${++i}`, id, s.code, s.title, i]);
      return { unit: u };
    });
  });
  r.post('/api/teacher/units/:id/subtopics', T, async (req) => {
    const u = await one('SELECT id FROM units WHERE id = $1', [req.params.id]);
    if (!u) throw new HttpError(404, '找不到这个单元。');
    const code = String(req.body.code || '').trim(), title = String(req.body.title || '').trim();
    if (!code || !title) throw new HttpError(400, '请输入知识点编号和名称。');
    const n = await one('SELECT count(*)::int AS n FROM subtopics WHERE unit_id = $1', [u.id]);
    return { subtopic: await one('INSERT INTO subtopics (id, unit_id, code, title, sort) VALUES ($1, $2, $3, $4, $5) RETURNING *', [`${u.id}-${n.n + 1}`, u.id, code, title, n.n + 1]) };
  });

  r.get('/api/teacher/questions', T, async (req) => {
    const bank = await loadBank();
    const f = req.query;
    let list = [...bank.values()];
    if (f.unit_id) list = list.filter(x => x.unit_id === f.unit_id);
    if (f.subtopic_id) list = list.filter(x => x.subtopic_id === f.subtopic_id);
    if (f.difficulty) list = list.filter(x => x.difficulty === Number(f.difficulty));
    if (f.qtype) list = list.filter(x => x.qtype === f.qtype);
    if (f.stage) list = list.filter(x => x.stages.includes(Number(f.stage)));
    if (f.q) list = list.filter(x => (x.text + x.id + (x.source || '')).includes(f.q));
    if (f.active !== 'all') list = list.filter(x => x.is_active);
    list.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
    return { questions: list.map(x => ({ ...x, answerText: correctAnswerText(x), tags: skillTags(x) })) };
  });
  r.get('/api/teacher/questions/:id', T, async (req) => {
    const x = await getQuestion(req.params.id);
    if (!x) throw new HttpError(404, '找不到题目。');
    return { question: { ...x, answerText: correctAnswerText(x), tags: skillTags(x) } };
  });

  /** 由算式自动生成题目内容（老师只需输入算式与情境） */
  r.post('/api/teacher/questions/build', T, async (req) => {
    const expr = parseExpression(req.body.expression);
    if (!expr) throw new HttpError(400, '算式格式看不懂。请输入例如：3801 + 8632 − 1472 或 3245 × 19 ÷ 30');
    try {
      const built = buildFromExpression({ expr, text: String(req.body.text || '').trim() || null, unit_label: req.body.unit_label || null, qtype: req.body.qtype || null,
        difficulty: Number(req.body.difficulty) || 2, stages: Array.isArray(req.body.stages) && req.body.stages.length ? req.body.stages.map(Number) : [3, 5, 6] });
      return { question: built };
    } catch (e) { throw new HttpError(400, e.message); }
  });

  async function saveQuestion(req, id) {
    const body = req.body.question || {};
    const unit = await one('SELECT id FROM units WHERE id = $1', [body.unit_id]);
    const sub = await one('SELECT id, unit_id FROM subtopics WHERE id = $1', [body.subtopic_id]);
    if (!unit || !sub || sub.unit_id !== unit.id) throw new HttpError(400, '请选择正确的单元和知识点。');
    const qd = { ...body, id };
    qd.difficulty = Number(qd.difficulty);
    qd.stages = (qd.stages || []).map(Number).filter(s => s >= 1 && s <= 6);
    if (!qd.stages.length) throw new HttpError(400, '请至少选择一个关卡。');
    if (typeof qd.worked_solution === 'string') qd.worked_solution = qd.worked_solution.split('\n').map(s => s.trim()).filter(Boolean);
    if (typeof qd.alternatives === 'string') qd.alternatives = qd.alternatives.split(/[\n;；]/).map(s => s.trim()).filter(Boolean);
    qd.marks = Number(qd.marks) || (qd.qtype === 'steps' || qd.qtype === 'remainder' ? 2 : 1);
    const errors = verifyQuestion(qd);
    if (errors.length) throw new HttpError(422, '题目没有通过验证：' + errors.join('；'), { errors });
    const { id: _i, unit_id, subtopic_id, difficulty, qtype, stages, marks, source, is_textbook, verified, is_active, answerText, tags, ...data } = qd;
    const row = await one(`INSERT INTO questions (id, unit_id, subtopic_id, difficulty, qtype, stages, data, marks, source, is_textbook, verified, is_active, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $12)
      ON CONFLICT (id) DO UPDATE SET unit_id = $2, subtopic_id = $3, difficulty = $4, qtype = $5, stages = $6, data = $7, marks = $8, source = $9, verified = true, is_active = $11, updated_at = now()
      RETURNING id`, [id, unit_id, subtopic_id, difficulty, qtype, stages, data, marks, source || '老师新增', !!is_textbook, is_active !== false, req.teacher.id]);
    invalidateBank();
    return { id: row.id, verified: true };
  }

  r.post('/api/teacher/questions', T, async (req) => {
    const sub = await one('SELECT id, unit_id FROM subtopics WHERE id = $1', [req.body.question?.subtopic_id]);
    if (!sub) throw new HttpError(400, '请选择知识点。');
    const prefix = 'T' + sub.id.replace(/^U/, '').replace(/-/g, '');
    const n = await one(`SELECT count(*)::int AS n FROM questions WHERE id LIKE $1`, [prefix + '-%']);
    let id;
    for (let k = n.n + 1; ; k++) { id = `${prefix}-${String(k).padStart(3, '0')}`; if (!(await one('SELECT 1 FROM questions WHERE id = $1', [id]))) break; }
    return saveQuestion(req, id);
  });
  r.put('/api/teacher/questions/:id', T, async (req) => {
    if (!(await one('SELECT 1 FROM questions WHERE id = $1', [req.params.id]))) throw new HttpError(404, '找不到题目。');
    return saveQuestion(req, req.params.id);
  });
  r.delete('/api/teacher/questions/:id', T, async (req) => {
    const used = await one('SELECT 1 FROM attempts WHERE question_id = $1 LIMIT 1', [req.params.id]);
    if (used) { await q('UPDATE questions SET is_active = false, updated_at = now() WHERE id = $1', [req.params.id]); invalidateBank(); return { ok: true, archived: true, message: '这道题已有学生作答记录，所以改为“停用”（报告仍可显示）。' }; }
    await q('DELETE FROM questions WHERE id = $1', [req.params.id]);
    invalidateBank();
    return { ok: true, archived: false };
  });
  r.post('/api/teacher/questions/check', T, async (req) => {
    const x = req.body.question || await getQuestion(req.body.id);
    if (!x) throw new HttpError(404, '找不到题目。');
    return { result: markAnswer(x, req.body.response || correctResponse(x)) };
  });

  // ---------------- 小测 / 复习活动
  r.get('/api/teacher/quizzes', T, async (req) => ({
    quizzes: await all(`SELECT qz.*, c.name AS class_name, (SELECT count(*)::int FROM assessments a WHERE a.quiz_id = qz.id) AS submissions
      FROM quizzes qz JOIN classes c ON c.id = qz.class_id WHERE ($1 OR c.teacher_id = $2) ORDER BY qz.created_at DESC`, [req.teacher.role === 'admin', req.teacher.id]),
  }));
  r.post('/api/teacher/quizzes', T, async (req) => {
    const c = await assertClassAccess(req.teacher, Number(req.body.class_id));
    const ids = (req.body.question_ids || []).map(String);
    const bank = await loadBank();
    if (!ids.length || ids.some(id => !bank.get(id))) throw new HttpError(400, '请选择有效的题目。');
    const unitIds = new Set(ids.map(id => bank.get(id).unit_id));
    if (unitIds.size !== 1) throw new HttpError(400, '一个小测只能包含同一个单元的题目。');
    const title = String(req.body.title || '').trim().slice(0, 40);
    if (!title) throw new HttpError(400, '请输入小测名称。');
    return { quiz: await one('INSERT INTO quizzes (teacher_id, class_id, unit_id, title, question_ids, mode, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.teacher.id, c.id, [...unitIds][0], title, ids, req.body.mode === 'formal' ? 'formal' : 'practice', req.body.due_date || null]) };
  });
  r.patch('/api/teacher/quizzes/:id', T, async (req) => {
    const qz = await one('SELECT * FROM quizzes WHERE id = $1', [Number(req.params.id)]);
    if (!qz) throw new HttpError(404, '找不到小测。');
    await assertClassAccess(req.teacher, qz.class_id);
    return { quiz: await one('UPDATE quizzes SET is_active = $2 WHERE id = $1 RETURNING *', [qz.id, !!req.body.is_active]) };
  });
  r.delete('/api/teacher/quizzes/:id', T, async (req) => {
    const qz = await one('SELECT * FROM quizzes WHERE id = $1', [Number(req.params.id)]);
    if (!qz) throw new HttpError(404, '找不到小测。');
    await assertClassAccess(req.teacher, qz.class_id);
    await q('DELETE FROM quizzes WHERE id = $1', [qz.id]);
    return { ok: true };
  });

  // ---------------- 教学模式内容
  r.get('/api/teacher/lessons', T, async (req) => {
    const unitId = String(req.query.unit_id || 'U1-7');
    const lessons = LESSONS.filter(l => l.unit_id === unitId).sort((a, b) => a.order - b.order);
    const bank = await loadBank();
    const extra = [...bank.values()].filter(x => x.unit_id === unitId && x.is_active && x.expr && x.source === '老师新增');
    return {
      lessons: lessons.map(l => ({ ...l, question: bank.get(l.question_id) || null })),
      teacherQuestions: extra,
      quizPool: [...bank.values()].filter(x => x.unit_id === unitId && x.is_active && x.qtype === 'mcq').map(x => ({ ...x, answerText: correctAnswerText(x) })),
    };
  });
  r.get('/api/teacher/teach/similar', T, async (req) => {
    const bank = await loadBank();
    const exclude = new Set(String(req.query.exclude || '').split(','));
    const pool = [...bank.values()].filter(x => x.is_active && x.subtopic_id === req.query.subtopic_id && x.expr && x.expr.ops.length === 2
      && (x.qtype === 'number' || x.qtype === 'remainder' || x.qtype === 'steps') && !exclude.has(x.id));
    if (!pool.length) throw new HttpError(404, '没有更多同类题目了。');
    const x = pool[Math.floor(Math.random() * pool.length)];
    return { question: { ...x, answerText: correctAnswerText(x) } };
  });

  // ---------------- 学生记录、报告
  r.get('/api/teacher/records', T, async (req) => {
    const p = reportParams(req);
    await assertClassAccess(req.teacher, p.classId);
    const params = [p.classId, p.unitId, p.quizId];
    let where = 'a.class_id = $1 AND a.unit_id = $2 AND a.quiz_id IS NOT DISTINCT FROM $3';
    if (p.from) { params.push(p.from); where += ` AND a.submitted_at >= ($${params.length}::date - interval '8 hours')`; }
    if (p.to) { params.push(p.to); where += ` AND a.submitted_at < ($${params.length}::date + interval '1 day' - interval '8 hours')`; }
    if (req.query.q) { params.push('%' + req.query.q + '%'); where += ` AND s.name ILIKE $${params.length}`; }
    const rows = await all(`SELECT a.id, a.student_id, s.name, s.pupil_no, a.title, a.attempt_no, a.score, a.max_score, a.percentage, a.correct_count, a.total_questions,
      a.duration_sec, a.submitted_at, a.is_demo, a.teacher_comment IS NOT NULL AND a.teacher_comment <> '' AS has_comment, (a.practice->>'hintsUsed')::int AS hints
      FROM assessments a JOIN students s ON s.id = a.student_id WHERE ${where} ORDER BY a.submitted_at DESC`, params);
    const cls = await classReport({ teacher: req.teacher, ...p });
    const prog = await all('SELECT p.student_id, p.state, p.xp FROM progress p JOIN students s ON s.id = p.student_id WHERE s.class_id = $1 AND p.unit_id = $2', [p.classId, p.unitId]);
    const progMap = Object.fromEntries(prog.map(x => [x.student_id, x]));
    return {
      records: rows.map(x => ({ ...x, submitted: fmtDateTime(x.submitted_at) })),
      roster: cls.students.map(s => ({ ...s, stages: [1, 2, 3, 4, 5, 6].map(n => !!progMap[s.id]?.state?.stages?.[n]?.completed), xp: progMap[s.id]?.xp || 0 })),
      summary: cls.summary, stageNames: STAGE_NAMES,
    };
  });

  r.get('/api/teacher/assessments/:id/report', T, async (req) => individualReport(Number(req.params.id), { teacher: req.teacher }));
  r.patch('/api/teacher/assessments/:id', T, async (req) => {
    await individualReport(Number(req.params.id), { teacher: req.teacher });
    await q('UPDATE assessments SET teacher_comment = $2 WHERE id = $1', [Number(req.params.id), String(req.body.teacher_comment || '').slice(0, 1000)]);
    return { ok: true };
  });
  r.delete('/api/teacher/assessments/:id', T, async (req) => {
    const rep = await individualReport(Number(req.params.id), { teacher: req.teacher });
    await tx(async (c) => {
      await c.q('DELETE FROM attempts WHERE assessment_id = $1', [rep.id]);
      await c.q('DELETE FROM assessment_sessions WHERE assessment_id = $1', [rep.id]);
    });
    return { ok: true };
  });
  r.get('/api/teacher/assessments/:id/pdf', T, async (req, res) => {
    const rep = await individualReport(Number(req.params.id), { teacher: req.teacher });
    res.file(individualPdf([rep], rep.title), 'application/pdf', `四年级数学_${safeName(rep.student.name)}_个人学习报告.pdf`, req.query.inline === '1');
  });

  r.get('/api/teacher/class-report', T, async (req) => classReport({ teacher: req.teacher, ...reportParams(req) }));
  r.put('/api/teacher/class-report/notes', T, async (req) => {
    const classId = Number(req.body.class_id);
    await assertClassAccess(req.teacher, classId);
    const allowed = ['measures', 'method', 'owner', 'when', 'goal', 'followup', 'summary', 'reporter', 'reviewer', 'confirmDate'];
    const notes = Object.fromEntries(allowed.map(k => [k, String(req.body.notes?.[k] || '').slice(0, 2000)]));
    const key = String(req.body.key || '');
    if (!key) throw new HttpError(400, '缺少报告编号');
    await q(`INSERT INTO class_report_notes (class_id, report_key, notes) VALUES ($1, $2, $3)
      ON CONFLICT (class_id, report_key) DO UPDATE SET notes = $3, updated_at = now()`, [classId, key, notes]);
    return { ok: true };
  });
  r.get('/api/teacher/class-report/pdf', T, async (req, res) => {
    const rep = await classReport({ teacher: req.teacher, ...reportParams(req) });
    res.file(classPdf(rep), 'application/pdf', `四年级数学_${safeName(rep.info.className)}_全班学习分析报告.pdf`, req.query.inline === '1');
  });

  async function collectIndividuals(req) {
    const p = reportParams(req);
    const cls = await classReport({ teacher: req.teacher, ...p });
    const ids = cls.students.filter(s => s.assessmentId).map(s => s.assessmentId);
    if (!ids.length) throw new HttpError(404, '所选范围内还没有学生提交评估。');
    const reps = [];
    for (const id of ids) reps.push(await individualReport(id, { teacher: req.teacher }));
    return { cls, reps };
  }
  r.get('/api/teacher/bulk/individual-pdf', T, async (req, res) => {
    const { cls, reps } = await collectIndividuals(req);
    res.file(individualPdf(reps, '全班个人报告汇总'), 'application/pdf', `四年级数学_${safeName(cls.info.className)}_全班个人报告汇总.pdf`, req.query.inline === '1');
  });
  r.get('/api/teacher/bulk/zip', T, async (req, res) => {
    const { cls, reps } = await collectIndividuals(req);
    const files = [{ name: '四年级数学_全班学习分析报告.pdf', data: classPdf(cls) }];
    for (const rep of reps) files.push({ name: `个人报告/四年级数学_${safeName(rep.student.pupilNo ? rep.student.pupilNo + '_' + rep.student.name : rep.student.name)}_学生个人学习报告.pdf`, data: individualPdf([rep], rep.title) });
    files.push({ name: '四年级数学_全班个人报告汇总.pdf', data: individualPdf(reps, '全班个人报告汇总') });
    res.file(makeZip(files), 'application/zip', `四年级数学_${safeName(cls.info.className)}_学习报告.zip`);
  });

  r.get('/api/teacher/export', T, async (req, res) => {
    const cls = await classReport({ teacher: req.teacher, ...reportParams(req) });
    const subs = cls.topics.map(t => t.title);
    const columns = [{ title: '序号', width: 6 }, { title: '学生姓名', width: 14 }, { title: '学号', width: 8 }, { title: '得分', width: 8 }, { title: '总分', width: 8 },
      { title: '百分比(%)', width: 10 }, { title: '掌握程度', width: 10 }, { title: '完成情况', width: 16 }, { title: '提交时间', width: 18 }, { title: '评估次数', width: 9 }];
    const rows = [];
    for (const s of cls.students) {
      rows.push([s.no, s.name, s.pupilNo || '', s.score ?? '', s.max ?? '', s.percentage ?? '', s.mastery, s.status, s.submittedAt, s.attempts]);
    }
    if (req.query.format === 'xlsx') {
      const topicRows = cls.topics.map(t => [t.title, t.items, t.correct, t.accuracy, t.label]);
      const errRows = cls.errors.map(e => [e.name, e.count, e.students, e.teacher]);
      const buf = makeXlsx([
        { name: '学生成绩', columns, rows },
        { name: '知识点分析', columns: [{ title: '知识点', width: 24 }, { title: '作答题次', width: 10 }, { title: '答对', width: 8 }, { title: '掌握百分比(%)', width: 14 }, { title: '结论', width: 12 }], rows: topicRows },
        { name: '常见错误', columns: [{ title: '错误类型', width: 22 }, { title: '出现次数', width: 10 }, { title: '涉及人数', width: 10 }, { title: '说明', width: 60 }], rows: errRows },
      ]);
      void subs;
      return res.file(buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `四年级数学_${safeName(cls.info.className)}_成绩.xlsx`);
    }
    res.file(makeCsv(columns, rows), 'text/csv; charset=utf-8', `四年级数学_${safeName(cls.info.className)}_成绩.csv`);
  });

  r.get('/api/teacher/report-key', T, async (req) => ({ key: reportKey(reportParams(req)) }));
}
