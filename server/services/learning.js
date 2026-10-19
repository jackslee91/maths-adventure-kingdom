// 学生学习流程：进度、关卡练习、作答批改、补救、正式评估提交
import crypto from 'node:crypto';
import { one, all, q, tx } from '../db.js';
import { HttpError } from '../http.js';
import { markAnswer, correctAnswerText, responseText, maxMarksFor } from '../../shared/marking.js';
import { MISCONCEPTIONS } from '../../shared/misconceptions.js';
import { getQuestion, sanitize, selectForStage, easierQuestion, skillTags } from './questions.js';
import { getTeacherSettings, masteryLabel } from './settings.js';
import { LESSONS } from '../../content/lessons.js';

export const STAGE_NAMES = { 1: '数学启航站', 2: '解题训练营', 3: '独立挑战区', 4: '数学迷宫', 5: '终极 Boss 挑战', 6: '数学王者认证' };
export const BADGES = {
  starter: { name: '启航新星', desc: '完成第一关' },
  trainee: { name: '解题小能手', desc: '完成第二关' },
  solo: { name: '独立挑战者', desc: '完成第三关' },
  maze: { name: '迷宫探险家', desc: '走出数学迷宫' },
  boss: { name: '屠龙勇士', desc: '打败终极 Boss' },
  king: { name: '数学王者', desc: '王者认证达到优秀' },
  persist: { name: '坚持不懈', desc: '完成补救小站' },
  treasure: { name: '宝箱猎人', desc: '答对宝箱挑战题' },
  perfect: { name: '全对之星', desc: '某一关首次全部答对' },
};
const STAGE_BADGE = { 1: 'starter', 2: 'trainee', 3: 'solo', 4: 'maze', 5: 'boss' };

function emptyState() { return { stages: {}, remedial: {}, badges: [] }; }

export async function getProgress(studentId, unitId) {
  const r = await one('SELECT state, xp FROM progress WHERE student_id = $1 AND unit_id = $2', [studentId, unitId]);
  const state = r ? { ...emptyState(), ...r.state } : emptyState();
  return { state, xp: r ? r.xp : 0 };
}

export function isUnlocked(state, stage) {
  if (stage <= 1) return true;
  const prev = state.stages[stage - 1];
  if (!prev || !prev.completed) return false;
  return prev.passed || state.remedial[stage - 1] === 'done';
}

export function progressView(state, xp) {
  const stages = [1, 2, 3, 4, 5, 6].map(s => ({
    stage: s, name: STAGE_NAMES[s], unlocked: isUnlocked(state, s),
    completed: !!state.stages[s]?.completed, passed: !!state.stages[s]?.passed, stars: state.stages[s]?.stars || 0,
    best: state.stages[s]?.best ?? null, needsRemedial: state.remedial[s] === 'needed', bonus: !!state.stages[s]?.bonusAvailable,
  }));
  return { stages, xp, badges: (state.badges || []).map(k => ({ key: k, ...BADGES[k] })), level: 1 + Math.floor(xp / 200) };
}

async function saveProgress(c, studentId, unitId, state, xpDelta) {
  await c.q(`INSERT INTO progress (student_id, unit_id, state, xp, updated_at) VALUES ($1, $2, $3, $4, now())
    ON CONFLICT (student_id, unit_id) DO UPDATE SET state = $3, xp = progress.xp + $4, updated_at = now()`, [studentId, unitId, state, xpDelta]);
}

async function seenQuestionIds(studentId, unitId) {
  const rows = await all('SELECT DISTINCT question_id FROM attempts WHERE student_id = $1 AND unit_id = $2', [studentId, unitId]);
  return new Set(rows.map(r => r.question_id));
}

/** 开始一关（或补救、宝箱、练习小测） */
export async function startRun(student, unitId, stage, kind = 'stage', quizId = null) {
  const unit = await one('SELECT id, title FROM units WHERE id = $1 AND is_active', [unitId]);
  if (!unit) throw new HttpError(404, '找不到这个单元。');
  const { state } = await getProgress(student.id, unitId);
  const settings = await getTeacherSettings(student.teacher_id);
  let picks, rooms = null, lessons = null;
  const seen = await seenQuestionIds(student.id, unitId);

  if (kind === 'quiz') {
    const quiz = await one('SELECT * FROM quizzes WHERE id = $1 AND class_id = $2 AND is_active AND mode = $3', [quizId, student.class_id, 'practice']);
    if (!quiz) throw new HttpError(404, '找不到这个练习。');
    picks = (await Promise.all(quiz.question_ids.map(getQuestion))).filter(Boolean);
    stage = 0;
  } else if (kind === 'remedial') {
    if (state.remedial[stage] !== 'needed') throw new HttpError(400, '这一关不需要补救练习。');
    const weak = await weakestSubtopicInLastRun(student.id, unitId, stage);
    picks = await selectForStage(unitId, 'remedial', { seen, weakSubtopic: weak });
    const sub = weak || picks[0]?.subtopic_id;
    lessons = LESSONS.filter(l => l.unit_id === unitId && l.subtopic_id === sub && l.expr).slice(0, 1);
  } else if (kind === 'bonus') {
    if (!state.stages[stage]?.bonusAvailable) throw new HttpError(400, '宝箱还没有出现哦！');
    picks = await selectForStage(unitId, 'bonus', { seen });
  } else {
    if (stage < 1 || stage > 5) throw new HttpError(400, '关卡编号不正确。');
    if (!isUnlocked(state, stage)) throw new HttpError(403, '这一关还没有解锁，先完成前面的关卡吧！');
    if (stage === 4) {
      rooms = await selectForStage(unitId, 4, { seen });
      picks = rooms.map(r => r.q);
    } else {
      picks = await selectForStage(unitId, stage, { seen });
    }
    if (stage === 1) lessons = LESSONS.filter(l => l.unit_id === unitId).sort((a, b) => a.order - b.order);
  }
  if (!picks.length) throw new HttpError(409, '题库里还没有适合这一关的题目，请告诉老师。');
  const id = crypto.randomUUID();
  await q('INSERT INTO stage_runs (id, student_id, unit_id, stage, kind, question_ids, base_count, quiz_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [id, student.id, unitId, stage, kind, picks.map(p => p.id), picks.length, quizId]);
  return {
    runId: id, stage, kind, unit: unit.title, stageName: STAGE_NAMES[stage] || '老师的练习',
    questions: picks.map(p => sanitize(p)),
    rooms: rooms ? rooms.map(r => ({ room: r.room, questionId: r.q.id })) : null,
    lessons, settings: { bossTimer: settings.boss_timer_default, bossTimerSeconds: settings.boss_timer_seconds },
  };
}

async function weakestSubtopicInLastRun(studentId, unitId, stage) {
  const r = await one(`SELECT a.subtopic_id, sum(CASE WHEN a.correct AND a.try_no = 1 THEN 1 ELSE 0 END)::float / count(*) AS acc
    FROM attempts a JOIN stage_runs r ON r.id = a.run_id
    WHERE a.student_id = $1 AND a.unit_id = $2 AND r.stage = $3 AND r.kind = 'stage'
    GROUP BY a.subtopic_id ORDER BY acc ASC LIMIT 1`, [studentId, unitId, stage]);
  return r?.subtopic_id || null;
}

async function loadRun(student, runId) {
  if (!/^[0-9a-f-]{36}$/i.test(runId)) throw new HttpError(400, '关卡编号不正确。');
  const run = await one('SELECT * FROM stage_runs WHERE id = $1', [runId]);
  if (!run || run.student_id !== student.id) throw new HttpError(404, '找不到这次闯关记录。');
  return run;
}

/** 练习作答：服务器批改，记录尝试，必要时提供补救 */
export async function practiceAttempt(student, runId, body) {
  const run = await loadRun(student, runId);
  if (run.finished_at) throw new HttpError(409, '这一关已经结束了。');
  const qid = String(body.question_id || '');
  if (!run.question_ids.includes(qid)) throw new HttpError(400, '这道题不在这一关里。');
  const question = await getQuestion(qid);
  if (!question) throw new HttpError(404, '找不到题目。');
  const prev = await one('SELECT count(*)::int AS n, bool_or(correct) AS ok FROM attempts WHERE run_id = $1 AND question_id = $2', [runId, qid]);
  if (prev.ok) throw new HttpError(409, '这道题已经答对了。');
  const tryNo = prev.n + 1;
  const result = markAnswer(question, body.response || {});
  if (result.invalid) {
    return { correct: false, invalid: true, feedback: result.feedback, tryNo: prev.n };
  }
  const hints = Math.max(0, Math.min(5, Number(body.hints_used) || 0));
  await q(`INSERT INTO attempts (student_id, run_id, question_id, unit_id, subtopic_id, stage, mode, response, correct, marks_awarded, max_marks, try_no, hints_used, misconception_code)
    VALUES ($1, $2, $3, $4, $5, $6, 'practice', $7, $8, $9, $10, $11, $12, $13)`,
  [student.id, runId, qid, run.unit_id, question.subtopic_id, run.stage, body.response || {}, result.correct, result.marks, result.maxMarks, tryNo, hints, result.misconception]);

  const out = {
    correct: result.correct, marks: result.marks, maxMarks: result.maxMarks, tryNo,
    feedback: result.feedback, partial: result.marks > 0 && !result.correct,
    misconception: result.misconception ? { code: result.misconception, name: MISCONCEPTIONS[result.misconception]?.name } : null,
    detail: { wrongStep: result.detail?.wrongStep || null },
  };
  if (result.correct || tryNo >= 2) {
    out.solution = { steps: question.worked_solution, explanation: question.explanation, answer: correctAnswerText(question) };
  }
  if (!result.correct && tryNo >= 2) {
    const mc = MISCONCEPTIONS[result.misconception] || MISCONCEPTIONS.CALC_SLIP;
    const easier = await easierQuestion(question, new Set(run.question_ids));
    out.support = {
      simpler: mc.pupil,
      tip: mc.remedy,
      lesson: question.expr ? { expr: question.expr } : null,
      easier: easier ? sanitize(easier) : null,
    };
    if (easier) await q('UPDATE stage_runs SET question_ids = array_append(question_ids, $2) WHERE id = $1', [runId, easier.id]);
  }
  return out;
}

/** 结束一关：根据数据库中的作答记录计算星星与过关 */
export async function finishRun(student, runId, body = {}) {
  const run = await loadRun(student, runId);
  const settings = await getTeacherSettings(student.teacher_id);
  return tx(async (c) => {
    const locked = await c.one('SELECT * FROM stage_runs WHERE id = $1 FOR UPDATE', [runId]);
    if (locked.finished_at) return { already: true, passed: locked.passed, stars: locked.stars };
    const attempts = await c.all('SELECT question_id, correct, try_no FROM attempts WHERE run_id = $1 ORDER BY id', [runId]);
    const firstTry = new Map();
    const answered = new Set();
    for (const a of attempts) {
      if (a.try_no === 1) firstTry.set(a.question_id, a.correct);
      answered.add(a.question_id);
    }
    // 原本的题目（不含补救时插入的简单题）
    const baseIds = locked.question_ids.slice(0, locked.base_count || locked.question_ids.length);
    const total = baseIds.length;
    const ftc = baseIds.filter(id => firstTry.get(id)).length;
    const accuracy = total ? Math.round(ftc / total * 100) : 0;
    const completed = baseIds.every(id => answered.has(id));
    if (!completed && run.stage !== 1) throw new HttpError(400, '还有题目没有完成哦！');
    let passed;
    if (run.kind === 'remedial' || run.kind === 'bonus' || run.kind === 'quiz') passed = true;
    else if (run.stage === 1 || run.stage === 4 || run.stage === 5) passed = true;
    else passed = accuracy >= settings.stage_pass;
    const stars = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : 1;
    const activeSec = Math.max(0, Math.min(Number(body.active_seconds) || 0, Math.round((Date.now() - new Date(run.started_at).getTime()) / 1000)));
    await c.q('UPDATE stage_runs SET finished_at = now(), passed = $2, first_try_correct = $3, total = $4, stars = $5, active_seconds = $6 WHERE id = $1',
      [runId, passed, ftc, total, stars, activeSec]);

    const prog = await c.one('SELECT state FROM progress WHERE student_id = $1 AND unit_id = $2 FOR UPDATE', [student.id, run.unit_id]);
    const state = prog ? { ...emptyState(), ...prog.state } : emptyState();
    const earned = [];
    const award = (k) => { if (!state.badges.includes(k)) { state.badges.push(k); earned.push(k); } };
    let xp = ftc * 10 + (attempts.filter(a => a.correct && a.try_no > 1).length) * 4;
    let needsRemedial = false;
    if (run.kind === 'stage') {
      const s = state.stages[run.stage] || { runs: 0 };
      s.runs = (s.runs || 0) + 1;
      s.completed = true;
      s.passed = s.passed || passed;
      s.stars = Math.max(s.stars || 0, stars);
      s.best = Math.max(s.best ?? 0, accuracy);
      s.bonusAvailable = run.stage >= 2 && run.stage <= 5 && accuracy >= 90 && !state.badges.includes('treasure');
      state.stages[run.stage] = s;
      if (passed) { xp += 20; if (run.stage === 5) xp += 50; award(STAGE_BADGE[run.stage]); if (accuracy === 100 && total >= 3) award('perfect'); }
      if (!s.passed) { state.remedial[run.stage] = 'needed'; needsRemedial = true; }
      else if (state.remedial[run.stage] === 'needed') delete state.remedial[run.stage];
    } else if (run.kind === 'remedial') {
      state.remedial[run.stage] = 'done';
      award('persist');
      xp += 15;
    } else if (run.kind === 'bonus') {
      if (ftc > 0 || attempts.some(a => a.correct)) { award('treasure'); xp += 30; }
      if (state.stages[run.stage]) state.stages[run.stage].bonusAvailable = false;
    }
    await saveProgress(c, student.id, run.unit_id, state, xp);
    const after = await c.one('SELECT state, xp FROM progress WHERE student_id = $1 AND unit_id = $2', [student.id, run.unit_id]);
    return {
      passed, stars, accuracy, firstTryCorrect: ftc, total, needsRemedial, xpGained: xp,
      badgesEarned: earned.map(k => ({ key: k, ...BADGES[k] })),
      bonusAvailable: !!state.stages[run.stage]?.bonusAvailable,
      progress: progressView(after.state, after.xp), stagePass: settings.stage_pass,
    };
  });
}

// ---------------------------------------------------------------- 正式评估
export async function startAssessment(student, unitId, quizId = null) {
  const unit = await one('SELECT id, title FROM units WHERE id = $1 AND is_active', [unitId]);
  if (!unit) throw new HttpError(404, '找不到这个单元。');
  const settings = await getTeacherSettings(student.teacher_id);
  let title = `${unit.title} · 数学王者认证`;
  if (quizId) {
    const quiz = await one('SELECT * FROM quizzes WHERE id = $1 AND class_id = $2 AND is_active AND mode = $3', [quizId, student.class_id, 'formal']);
    if (!quiz) throw new HttpError(404, '找不到这个评估。');
    title = quiz.title;
  } else {
    const { state } = await getProgress(student.id, unitId);
    if (!isUnlocked(state, 6)) throw new HttpError(403, '先打败终极 Boss，才能参加王者认证哦！');
  }
  const open = await one(`SELECT * FROM assessment_sessions WHERE student_id = $1 AND unit_id = $2 AND status = 'open' AND quiz_id IS NOT DISTINCT FROM $3 ORDER BY started_at DESC LIMIT 1`, [student.id, unitId, quizId]);
  let session = open;
  if (!session) {
    let ids;
    if (quizId) ids = (await one('SELECT question_ids FROM quizzes WHERE id = $1', [quizId])).question_ids;
    else {
      const seen = await seenQuestionIds(student.id, unitId);
      ids = (await selectForStage(unitId, 6, { seen, count: settings.assessment_questions })).map(x => x.id);
    }
    if (!ids.length) throw new HttpError(409, '题库里没有足够的评估题目，请告诉老师。');
    session = await one('INSERT INTO assessment_sessions (id, student_id, unit_id, quiz_id, question_ids) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [crypto.randomUUID(), student.id, unitId, quizId, ids]);
  }
  const qs = (await Promise.all(session.question_ids.map(getQuestion))).filter(Boolean);
  return {
    sessionId: session.id, title, resumed: !!open, startedAt: session.started_at, draft: session.draft || {},
    questions: qs.map(x => sanitize(x, { formal: true })),
    rubric: '评分方式：一步答案题 1 分；两步算式题第一步 1 分、最后答案 1 分（第一步错但第二步按错的结果算对，得 1 分方法分）；有余数的题商 1 分、余数 1 分；选择题与排序题 1 分。',
  };
}

export async function saveDraft(student, sessionId, body) {
  const s = await one('SELECT id, student_id, status FROM assessment_sessions WHERE id = $1', [sessionId]);
  if (!s || s.student_id !== student.id) throw new HttpError(404, '找不到这次评估。');
  if (s.status !== 'open') return { saved: false, status: s.status };
  const draft = { answers: body.answers || {}, active_seconds: Number(body.active_seconds) || 0, current: Number(body.current) || 0 };
  if (JSON.stringify(draft).length > 200_000) throw new HttpError(413, '答案内容太多');
  await q('UPDATE assessment_sessions SET draft = $2, updated_at = now() WHERE id = $1', [sessionId, draft]);
  return { saved: true };
}

/** 提交正式评估：服务器批改；同一场次重复提交只返回第一次的结果 */
export async function submitAssessment(student, sessionId, body) {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new HttpError(400, '评估编号不正确。');
  return tx(async (c) => {
    const s = await c.one('SELECT * FROM assessment_sessions WHERE id = $1 FOR UPDATE', [sessionId]);
    if (!s || s.student_id !== student.id) throw new HttpError(404, '找不到这次评估。');
    if (s.status === 'submitted') {
      return { duplicate: true, assessmentId: s.assessment_id, ...(await summaryOf(c, s.assessment_id)) };
    }
    const answers = body.answers || {};
    const results = [];
    let score = 0, max = 0, correct = 0;
    for (const qid of s.question_ids) {
      const question = await getQuestion(qid);
      if (!question) continue;
      const resp = answers[qid] || {};
      const m = markAnswer(question, resp);
      const mm = maxMarksFor(question);
      score += m.marks; max += mm; if (m.correct) correct++;
      results.push({
        id: qid, subtopic_id: question.subtopic_id, qtype: question.qtype, text: question.text, difficulty: question.difficulty,
        marks: m.marks, max: mm, correct: m.correct, misconception: m.misconception || null,
        answered: !!Object.values(resp).some(v => (Array.isArray(v) ? v.some(Boolean) : v !== '' && v != null)),
        response: resp, responseText: responseText(question, resp), correctText: correctAnswerText(question),
        tags: skillTags(question), detail: m.detail || {},
      });
    }
    const pct = max ? Math.round(score / max * 1000) / 10 : 0;
    const settings = await getTeacherSettings(student.teacher_id);
    const unit = await c.one('SELECT title FROM units WHERE id = $1', [s.unit_id]);
    const quiz = s.quiz_id ? await c.one('SELECT title FROM quizzes WHERE id = $1', [s.quiz_id]) : null;
    const prevCount = await c.one('SELECT count(*)::int AS n FROM assessments WHERE student_id = $1 AND unit_id = $2 AND quiz_id IS NOT DISTINCT FROM $3', [student.id, s.unit_id, s.quiz_id]);
    const elapsed = Math.round((Date.now() - new Date(s.started_at).getTime()) / 1000);
    const duration = Math.max(0, Math.min(Number(body.active_seconds) || elapsed, elapsed));
    const practice = await practiceSummary(c, student.id, s.unit_id);
    const isDemo = (await c.one('SELECT is_demo FROM students WHERE id = $1', [student.id])).is_demo;
    const a = await c.one(`INSERT INTO assessments (session_id, student_id, class_id, unit_id, quiz_id, title, attempt_no, started_at, duration_sec, total_questions, correct_count, score, max_score, percentage, result, practice, is_demo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id`,
    [s.id, student.id, student.class_id, s.unit_id, s.quiz_id, quiz ? quiz.title : `${unit.title}`, prevCount.n + 1, s.started_at, duration,
      results.length, correct, score, max, pct, JSON.stringify(results), practice, isDemo]);
    for (const r of results) {
      await c.q(`INSERT INTO attempts (student_id, assessment_id, question_id, unit_id, subtopic_id, stage, mode, response, correct, marks_awarded, max_marks, try_no, hints_used, misconception_code)
        VALUES ($1, $2, $3, $4, $5, 6, 'formal', $6, $7, $8, $9, 1, 0, $10)`, [student.id, a.id, r.id, s.unit_id, r.subtopic_id, r.response, r.correct, r.marks, r.max, r.misconception]);
    }
    await c.q(`UPDATE assessment_sessions SET status = 'submitted', assessment_id = $2, draft = '{}'::jsonb, updated_at = now() WHERE id = $1`, [s.id, a.id]);
    if (!s.quiz_id) {
      const prog = await c.one('SELECT state FROM progress WHERE student_id = $1 AND unit_id = $2 FOR UPDATE', [student.id, s.unit_id]);
      const state = prog ? { ...emptyState(), ...prog.state } : emptyState();
      const st = state.stages[6] || {};
      st.completed = true; st.passed = true; st.best = Math.max(st.best ?? 0, pct);
      st.stars = pct >= 85 ? 3 : pct >= 60 ? 2 : 1;
      state.stages[6] = st;
      let xp = 40 + correct * 5;
      if (pct >= (settings.mastery_levels[0]?.min ?? 85) && !state.badges.includes('king')) state.badges.push('king');
      await saveProgress(c, student.id, s.unit_id, state, xp);
    }
    return { duplicate: false, assessmentId: a.id, ...(await summaryOf(c, a.id)) };
  });
}

async function summaryOf(c, id) {
  const a = await c.one(`SELECT a.id, a.score, a.max_score, a.percentage, a.correct_count, a.total_questions, a.submitted_at, cl.teacher_id
    FROM assessments a JOIN classes cl ON cl.id = a.class_id WHERE a.id = $1`, [id]);
  const settings = await getTeacherSettings(a.teacher_id);
  const pct = Number(a.percentage);
  const mastery = masteryLabel(pct, settings);
  return { score: Number(a.score), maxScore: Number(a.max_score), percentage: pct, correct: a.correct_count, total: a.total_questions, submittedAt: a.submitted_at,
    mastery, topLevel: mastery === settings.mastery_levels[0]?.label };
}

export async function practiceSummary(c, studentId, unitId) {
  const runs = await c.all(`SELECT stage, kind, passed, active_seconds, finished_at FROM stage_runs WHERE student_id = $1 AND unit_id = $2`, [studentId, unitId]);
  const att = await c.one(`SELECT count(*)::int AS n, coalesce(sum(hints_used),0)::int AS hints, sum(CASE WHEN try_no > 1 THEN 1 ELSE 0 END)::int AS retries,
    sum(CASE WHEN correct AND try_no = 1 THEN 1 ELSE 0 END)::int AS first_ok, count(DISTINCT question_id)::int AS distinct_q
    FROM attempts WHERE student_id = $1 AND unit_id = $2 AND mode = 'practice'`, [studentId, unitId]);
  const prog = await c.one('SELECT state FROM progress WHERE student_id = $1 AND unit_id = $2', [studentId, unitId]);
  const stagesCompleted = prog ? Object.entries(prog.state.stages || {}).filter(([, v]) => v.completed).map(([k]) => Number(k)).filter(s => s <= 5).sort() : [];
  return {
    stagesCompleted,
    practiceAttempts: att.n, hintsUsed: att.hints, retries: att.retries || 0, firstTryCorrect: att.first_ok || 0,
    practiceSeconds: runs.reduce((s, r) => s + (r.active_seconds || 0), 0),
    remedialRuns: runs.filter(r => r.kind === 'remedial' && r.finished_at).length,
  };
}
