// 学生端 API
import { all, one, q } from '../db.js';
import { HttpError, rateLimiter } from '../http.js';
import { requireStudent, createStudentSession, hashSecret, verifySecret } from '../auth.js';
import { getProgress, progressView, startRun, practiceAttempt, finishRun, startAssessment, saveDraft, submitAssessment } from '../services/learning.js';
import { individualReport } from '../services/reports.js';
import { individualPdf } from '../pdf/reports-pdf.js';

const loginLimit = rateLimiter({ windowMs: 10 * 60_000, max: 12, message: '尝试次数太多了，请 10 分钟后再试，或请老师帮忙。' });

function cleanName(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 30);
}

export function studentRoutes(r) {
  r.get('/api/public/classes', async () => {
    const rows = await all('SELECT id, name FROM classes ORDER BY is_demo, name');
    return { classes: rows };
  });

  // 班级名单：学生在登记页从下拉选单选自己的名字（只回传姓名、学号与是否已设密码）
  r.get('/api/public/classes/:id/roster', async (req) => {
    const rows = await all(`SELECT id, name, pupil_no, (pin_hash IS NOT NULL) AS registered FROM students
      WHERE class_id = $1 ORDER BY (pupil_no IS NULL OR pupil_no = ''), NULLIF(regexp_replace(pupil_no, '\\D', '', 'g'), '')::numeric NULLS LAST, pupil_no, name`, [Number(req.params.id) || 0]);
    return { students: rows.map(s => ({ id: s.id, name: s.name, pupilNo: s.pupil_no || '', registered: !!s.registered })) };
  });

  r.post('/api/student/login', async (req) => {
    const classId = Number(req.body.class_id);
    const studentId = Number(req.body.student_id) || null;
    let name = cleanName(req.body.name);
    let pupilNo = String(req.body.pupil_no || '').trim().slice(0, 20) || null;
    const pin = String(req.body.pin || '').trim();
    if (!classId) throw new HttpError(400, '请选择班级。');
    if (studentId) {
      // 从名单选了自己的名字
      const picked = await one('SELECT id, name, pupil_no FROM students WHERE id = $1 AND class_id = $2', [studentId, classId]);
      if (!picked) throw new HttpError(404, '名单里找不到这位同学，请重新选择。');
      name = picked.name; pupilNo = picked.pupil_no || null;
    }
    if (!name || name.length < 2) throw new HttpError(400, '请输入完整的姓名。');
    if (!/^\d{4}$/.test(pin)) throw new HttpError(400, '冒险密码必须是 4 位数字。');
    loginLimit(`${req.ip}|${classId}|${studentId || name}`);
    const cls = await one('SELECT id, name FROM classes WHERE id = $1', [classId]);
    if (!cls) throw new HttpError(404, '找不到这个班级。');
    let candidates = studentId
      ? await all('SELECT id, name, pupil_no, pin_hash FROM students WHERE id = $1', [studentId])
      : await all('SELECT id, name, pupil_no, pin_hash FROM students WHERE class_id = $1 AND name = $2', [classId, name]);
    if (pupilNo && !studentId) candidates = candidates.filter(s => (s.pupil_no || '') === pupilNo || !s.pupil_no);
    if (candidates.length > 1) {
      if (!pupilNo) throw new HttpError(409, '班上有同名同学，请输入你的学号。', { needPupilNo: true });
      candidates = candidates.filter(s => s.pupil_no === pupilNo);
    }
    let student = candidates[0];
    let isNew = false;
    if (!student) {
      student = await one(`INSERT INTO students (class_id, name, pupil_no, pin_hash, source) VALUES ($1, $2, $3, $4, 'self') RETURNING id, name, pupil_no`,
        [classId, name, pupilNo, await hashSecret(pin)]);
      isNew = true;
    } else if (!student.pin_hash) {
      await q('UPDATE students SET pin_hash = $2, pupil_no = COALESCE(pupil_no, $3) WHERE id = $1', [student.id, await hashSecret(pin), pupilNo]);
      isNew = true;
    } else if (!(await verifySecret(pin, student.pin_hash))) {
      throw new HttpError(401, '冒险密码不对。忘记了吗？请老师帮你重设。');
    }
    const token = await createStudentSession(student.id);
    return { token, isNew, student: { id: student.id, name: student.name, className: cls.name } };
  });

  r.get('/api/student/me', requireStudent, async (req) => ({ student: { id: req.student.id, name: req.student.name, className: req.student.class_name, pupilNo: req.student.pupil_no } }));

  r.post('/api/student/logout', requireStudent, async (req) => {
    await q('DELETE FROM student_sessions WHERE token_hash = $1', [req.studentTokenHash]);
    return { ok: true };
  });

  r.get('/api/student/units', requireStudent, async (req) => {
    const units = await all(`SELECT u.id, u.code, u.title, u.description, u.objectives,
      (SELECT json_agg(json_build_object('id', s.id, 'code', s.code, 'title', s.title, 'objectives', s.objectives) ORDER BY s.sort) FROM subtopics s WHERE s.unit_id = u.id) AS subtopics,
      (SELECT count(*)::int FROM questions qq WHERE qq.unit_id = u.id AND qq.is_active AND qq.verified) AS question_count
      FROM units u WHERE u.is_active ORDER BY u.sort, u.code`);
    const prog = await all('SELECT unit_id, state, xp FROM progress WHERE student_id = $1', [req.student.id]);
    const map = Object.fromEntries(prog.map(p => [p.unit_id, p]));
    return {
      units: units.filter(u => u.question_count > 0).map(u => ({ ...u, progress: progressView(map[u.id]?.state || { stages: {}, remedial: {}, badges: [] }, map[u.id]?.xp || 0) })),
      xp: prog.reduce((s, p) => s + p.xp, 0),
    };
  });

  r.get('/api/student/units/:id/progress', requireStudent, async (req) => {
    const { state, xp } = await getProgress(req.student.id, req.params.id);
    const open = await one(`SELECT id FROM assessment_sessions WHERE student_id = $1 AND unit_id = $2 AND status = 'open' AND quiz_id IS NULL`, [req.student.id, req.params.id]);
    return { ...progressView(state, xp), openAssessment: open?.id || null };
  });

  r.post('/api/student/runs', requireStudent, async (req) => {
    const kind = ['stage', 'remedial', 'bonus', 'quiz'].includes(req.body.kind) ? req.body.kind : 'stage';
    return startRun(req.student, String(req.body.unit_id || ''), Number(req.body.stage), kind, req.body.quiz_id ? Number(req.body.quiz_id) : null);
  });
  r.post('/api/student/runs/:id/attempt', requireStudent, async (req) => practiceAttempt(req.student, req.params.id, req.body));
  r.post('/api/student/runs/:id/finish', requireStudent, async (req) => finishRun(req.student, req.params.id, req.body));

  r.post('/api/student/assessments/start', requireStudent, async (req) =>
    startAssessment(req.student, String(req.body.unit_id || ''), req.body.quiz_id ? Number(req.body.quiz_id) : null));
  r.put('/api/student/assessments/:id/draft', requireStudent, async (req) => saveDraft(req.student, req.params.id, req.body));
  r.post('/api/student/assessments/:id/submit', requireStudent, async (req) => submitAssessment(req.student, req.params.id, req.body));

  r.get('/api/student/reports', requireStudent, async (req) => ({
    reports: await all(`SELECT a.id, a.title, a.percentage, a.score, a.max_score, a.submitted_at, a.attempt_no, u.title AS unit_title
      FROM assessments a JOIN units u ON u.id = a.unit_id WHERE a.student_id = $1 ORDER BY a.submitted_at DESC`, [req.student.id]),
  }));
  r.get('/api/student/reports/:id', requireStudent, async (req) => individualReport(Number(req.params.id), { student: req.student }));
  r.get('/api/student/reports/:id/pdf', requireStudent, async (req, res) => {
    const rep = await individualReport(Number(req.params.id), { student: req.student });
    res.file(individualPdf([rep], rep.title), 'application/pdf', `四年级数学_${rep.student.name}_个人学习报告.pdf`);
  });

  r.get('/api/student/quizzes', requireStudent, async (req) => ({
    quizzes: await all(`SELECT qz.id, qz.title, qz.mode, qz.unit_id, qz.due_date, array_length(qz.question_ids, 1) AS count,
      EXISTS (SELECT 1 FROM assessments a WHERE a.quiz_id = qz.id AND a.student_id = $2) AS submitted
      FROM quizzes qz WHERE qz.class_id = $1 AND qz.is_active ORDER BY qz.created_at DESC`, [req.student.class_id, req.student.id]),
  }));
}
