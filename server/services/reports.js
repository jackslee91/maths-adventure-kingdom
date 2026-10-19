// 报告数据：所有结论都来自数据库中的真实作答记录
import { one, all } from '../db.js';
import { HttpError } from '../http.js';
import { MISCONCEPTIONS } from '../../shared/misconceptions.js';
import { getTeacherSettings, masteryLabel, topicLabel } from './settings.js';
import { unitQuestions } from './questions.js';
import { STAGE_NAMES } from './learning.js';

const pct1 = (a, b) => (b ? Math.round(a / b * 1000) / 10 : 0);
export const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  // 以马来西亚时间（UTC+8）显示
  const m = new Date(x.getTime() + 8 * 3600 * 1000);
  return `${m.getUTCFullYear()}年${m.getUTCMonth() + 1}月${m.getUTCDate()}日`;
};
export const fmtDateTime = (d) => {
  if (!d) return '';
  const m = new Date(new Date(d).getTime() + 8 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${m.getUTCFullYear()}-${p(m.getUTCMonth() + 1)}-${p(m.getUTCDate())} ${p(m.getUTCHours())}:${p(m.getUTCMinutes())}`;
};
export const fmtDuration = (sec) => {
  sec = Math.round(Number(sec) || 0);
  if (sec < 60) return `${sec} 秒`;
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h} 小时 ${m} 分钟` : `${m} 分钟`;
};
const shortText = (t, n = 40) => { const s = String(t || '').replace(/\n.*/s, ''); return s.length > n ? s.slice(0, n) + '…' : s; };

async function subtopicTitles(unitId) {
  const rows = await all('SELECT id, code, title FROM subtopics WHERE unit_id = $1 ORDER BY sort', [unitId]);
  return Object.fromEntries(rows.map(r => [r.id, `${r.code} ${r.title}`]));
}

/** 个人报告数据 */
export async function individualReport(assessmentId, { teacher, student } = {}) {
  const a = await one(`SELECT a.*, s.name AS student_name, s.pupil_no, c.name AS class_name, c.teacher_id, c.school_name, u.title AS unit_title, u.code AS unit_code
    FROM assessments a JOIN students s ON s.id = a.student_id JOIN classes c ON c.id = a.class_id JOIN units u ON u.id = a.unit_id WHERE a.id = $1`, [assessmentId]);
  if (!a) throw new HttpError(404, '找不到这份评估记录。');
  if (student && a.student_id !== student.id) throw new HttpError(403, '只能查看自己的报告。');
  if (teacher && teacher.role !== 'admin' && a.teacher_id !== teacher.id) throw new HttpError(403, '你没有权限查看这份报告。');
  const settings = await getTeacherSettings(a.teacher_id);
  const subs = await subtopicTitles(a.unit_id);
  const results = a.result || [];
  const pct = Number(a.percentage);

  // 各知识点
  const bySub = {};
  for (const r of results) {
    const s = (bySub[r.subtopic_id] ||= { id: r.subtopic_id, title: subs[r.subtopic_id] || r.subtopic_id, count: 0, correct: 0, marks: 0, max: 0 });
    s.count++; if (r.correct) s.correct++; s.marks += Number(r.marks); s.max += Number(r.max);
  }
  const topics = Object.values(bySub).map(t => ({ ...t, accuracy: pct1(t.marks, t.max), label: topicLabel(pct1(t.marks, t.max), settings) }));

  // 技能标签：强项 = 涉及该技能的题全部答对（至少 2 题）；弱项 = 有答错
  const tagStats = {};
  for (const r of results) for (const t of r.tags || []) {
    const s = (tagStats[t] ||= { tag: t, n: 0, ok: 0 });
    s.n++; if (r.correct) s.ok++;
  }
  const strengths = [];
  for (const t of topics) if (t.accuracy >= settings.topic_good && t.count >= 2) strengths.push(`${t.title}：${t.count} 题中答对 ${t.correct} 题（得分率 ${t.accuracy}%）。`);
  for (const s of Object.values(tagStats)) if (s.n >= 2 && s.ok === s.n) strengths.push(`${s.tag}：涉及这项技能的 ${s.n} 题全部答对。`);

  const weaknesses = [];
  for (const t of topics) if (t.accuracy < settings.topic_weak) weaknesses.push(`${t.title}：得分率 ${t.accuracy}%，低于老师设定的 ${settings.topic_weak}%。`);
  for (const s of Object.values(tagStats)) if (s.n >= 2 && s.ok / s.n < 0.5) weaknesses.push(`${s.tag}：涉及这项技能的 ${s.n} 题中答错 ${s.n - s.ok} 题。`);

  // 错误分析（只列出真正答错的题）
  const wrong = results.filter(r => !r.correct);
  const groups = {};
  for (const r of wrong) {
    const code = !r.answered ? 'BLANK' : (r.misconception || 'CALC_SLIP');
    (groups[code] ||= []).push(r);
  }
  const errors = Object.entries(groups).map(([code, list]) => ({
    code,
    name: code === 'BLANK' ? '没有作答' : MISCONCEPTIONS[code]?.name || '计算出错',
    explain: code === 'BLANK' ? '这些题目没有填写答案，无法判断原因。' : MISCONCEPTIONS[code]?.teacher || '',
    count: list.length,
    examples: list.slice(0, 3).map(r => ({ text: shortText(r.text, 46), student: r.responseText, correct: r.correctText, marks: `${r.marks}/${r.max}` })),
  })).sort((x, y) => y.count - x.count);

  // 复习建议（根据错误类型与薄弱知识点）
  const recs = [];
  for (const e of errors) {
    if (e.code === 'BLANK') recs.push('有题目没有作答：评估时先做会做的题，再回来检查空着的题。');
    else if (MISCONCEPTIONS[e.code]) recs.push(`${MISCONCEPTIONS[e.code].name}：${MISCONCEPTIONS[e.code].remedy}`);
  }
  const bank = await unitQuestions(a.unit_id);
  const usedIds = new Set(results.map(r => r.id));
  const suggestIds = [];
  for (const t of topics.filter(t => t.accuracy < settings.topic_good)) {
    const pick = bank.filter(q => q.subtopic_id === t.id && !usedIds.has(q.id) && q.difficulty <= 2 && q.qtype !== 'order').slice(0, 3).map(q => q.id);
    if (pick.length) { recs.push(`针对“${t.title}”，建议再练习题库中的 ${pick.join('、')}。`); suggestIds.push(...pick); }
  }
  if (!wrong.length) {
    const challenge = bank.filter(q => q.enrichment).slice(0, 2).map(q => q.id);
    recs.push('本次评估全部答对，可以尝试挑战题' + (challenge.length ? `（${challenge.join('、')}）` : '') + '，并练习口头解说解题步骤。');
  }
  const practice = a.practice || {};
  if (practice.hintsUsed > 0) recs.push(`练习时共使用提示 ${practice.hintsUsed} 次（不影响评估分数），可以先尝试独立思考，再查看提示。`);

  return {
    id: a.id,
    title: '四年级数学个人学习表现报告',
    student: { name: a.student_name, pupilNo: a.pupil_no, className: a.class_name },
    school: settings.school_name || a.school_name || '',
    teacherName: settings.teacher_name || '',
    date: fmtDate(a.submitted_at), submittedAt: fmtDateTime(a.submitted_at),
    topic: `${a.unit_code} ${a.unit_title}${a.quiz_id ? ' · ' + a.title : ''}`,
    attemptNo: a.attempt_no,
    overall: {
      total: a.total_questions, correct: a.correct_count, maxScore: Number(a.max_score), score: Number(a.score), percentage: pct,
      stages: (practice.stagesCompleted || []).map(s => STAGE_NAMES[s]).concat(['数学王者认证']),
      stagesText: `${(practice.stagesCompleted || []).length + 1} / 6 关`,
      duration: fmtDuration(a.duration_sec), practiceTime: fmtDuration(practice.practiceSeconds || 0),
      mastery: masteryLabel(pct, settings),
      hintsUsed: practice.hintsUsed || 0, retries: practice.retries || 0,
    },
    topics,
    strengths: strengths.length ? strengths : ['本次评估中，还没有足够的证据显示某个知识点已经稳固掌握（每个知识点至少需要答对 2 题）。'],
    weaknesses: weaknesses.length ? weaknesses : ['本次评估没有发现明显的薄弱知识点。'],
    errors,
    recommendations: recs.length ? recs : ['继续保持，多做应用题练习。'],
    suggestIds,
    teacherComment: a.teacher_comment || '',
    questions: results.map((r, i) => ({ no: i + 1, text: r.text, student: r.responseText, correct: r.correctText, marks: r.marks, max: r.max, ok: r.correct })),
    isDemo: a.is_demo,
  };
}

/** 选择每位学生用于统计的评估记录 */
function choose(list, policy) {
  if (!list.length) return null;
  if (policy === 'best') return list.reduce((b, x) => (Number(x.percentage) > Number(b.percentage) ? x : b));
  if (policy === 'first') return list.reduce((b, x) => (new Date(x.submitted_at) < new Date(b.submitted_at) ? x : b));
  return list.reduce((b, x) => (new Date(x.submitted_at) > new Date(b.submitted_at) ? x : b));
}

/** 全班报告数据 */
export async function classReport({ teacher, classId, unitId, quizId = null, from, to, studentIds }) {
  const cls = await one('SELECT c.*, t.display_name AS teacher_display FROM classes c LEFT JOIN teachers t ON t.id = c.teacher_id WHERE c.id = $1', [classId]);
  if (!cls) throw new HttpError(404, '找不到这个班级。');
  if (teacher.role !== 'admin' && cls.teacher_id !== teacher.id) throw new HttpError(403, '你没有权限查看这个班级。');
  const unit = await one('SELECT * FROM units WHERE id = $1', [unitId]);
  if (!unit) throw new HttpError(404, '找不到这个单元。');
  const settings = await getTeacherSettings(cls.teacher_id);
  const subs = await subtopicTitles(unitId);

  let roster = await all('SELECT id, name, pupil_no, source FROM students WHERE class_id = $1 ORDER BY pupil_no NULLS LAST, name', [classId]);
  if (studentIds && studentIds.length) roster = roster.filter(s => studentIds.includes(s.id));
  const params = [classId, unitId, quizId];
  let where = 'a.class_id = $1 AND a.unit_id = $2 AND a.quiz_id IS NOT DISTINCT FROM $3';
  if (from) { params.push(from); where += ` AND a.submitted_at >= ($${params.length}::date - interval '8 hours')`; }
  if (to) { params.push(to); where += ` AND a.submitted_at < ($${params.length}::date + interval '1 day' - interval '8 hours')`; }
  const rows = await all(`SELECT a.* FROM assessments a WHERE ${where} ORDER BY a.submitted_at`, params);
  const openSessions = await all(`SELECT DISTINCT student_id FROM assessment_sessions WHERE status = 'open' AND unit_id = $1 AND quiz_id IS NOT DISTINCT FROM $2`, [unitId, quizId]);
  const inProgress = new Set(openSessions.map(r => r.student_id));

  const byStudent = {};
  for (const r of rows) (byStudent[r.student_id] ||= []).push(r);
  const students = roster.map((s, i) => {
    const chosen = choose(byStudent[s.id] || [], settings.attempt_policy);
    const p = chosen ? Number(chosen.percentage) : null;
    return {
      no: i + 1, id: s.id, name: s.name, pupilNo: s.pupil_no, source: s.source,
      assessmentId: chosen?.id || null, attempts: (byStudent[s.id] || []).length,
      score: chosen ? Number(chosen.score) : null, max: chosen ? Number(chosen.max_score) : null, percentage: p,
      mastery: chosen ? masteryLabel(p, settings) : '—',
      status: chosen ? '已完成' : inProgress.has(s.id) ? '进行中（未提交）' : '未提交',
      submittedAt: chosen ? fmtDateTime(chosen.submitted_at) : '',
      result: chosen?.result || null,
      passed: chosen ? p >= settings.passing : null,
    };
  });
  const done = students.filter(s => s.percentage !== null);
  const pcts = done.map(s => s.percentage);
  const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length * 10) / 10 : null;
  const avgScore = done.length ? Math.round(done.reduce((a, s) => a + s.score, 0) / done.length * 10) / 10 : null;
  const maxScoreVal = done.length ? Math.max(...done.map(s => s.max)) : null;
  const passed = done.filter(s => s.passed);

  // 知识点
  const topicAgg = {};
  const tagAgg = {};
  const errAgg = {};
  for (const s of done) {
    for (const r of s.result) {
      const t = (topicAgg[r.subtopic_id] ||= { id: r.subtopic_id, title: subs[r.subtopic_id] || r.subtopic_id, marks: 0, max: 0, items: 0, correct: 0 });
      t.marks += Number(r.marks); t.max += Number(r.max); t.items++; if (r.correct) t.correct++;
      for (const tag of r.tags || []) { const g = (tagAgg[tag] ||= { tag, n: 0, ok: 0 }); g.n++; if (r.correct) g.ok++; }
      if (!r.correct) {
        const code = !r.answered ? 'BLANK' : (r.misconception || 'CALC_SLIP');
        const e = (errAgg[code] ||= { code, name: code === 'BLANK' ? '没有作答' : MISCONCEPTIONS[code]?.name || '计算出错', count: 0, students: new Set() });
        e.count++; e.students.add(s.name);
      }
    }
    s.topicAcc = {};
    for (const r of s.result) {
      const x = (s.topicAcc[r.subtopic_id] ||= { m: 0, x: 0 });
      x.m += Number(r.marks); x.x += Number(r.max);
    }
  }
  const topics = Object.values(topicAgg).map(t => ({ ...t, accuracy: pct1(t.marks, t.max), label: topicLabel(pct1(t.marks, t.max), settings) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const skills = Object.values(tagAgg).map(g => ({ ...g, accuracy: pct1(g.ok, g.n) })).sort((a, b) => b.accuracy - a.accuracy);
  const errors = Object.values(errAgg).map(e => ({ code: e.code, name: e.name, count: e.count, students: e.students.size, teacher: MISCONCEPTIONS[e.code]?.teacher || '', remedy: MISCONCEPTIONS[e.code]?.remedy || '' }))
    .sort((a, b) => b.count - a.count);

  // 分组
  const nearLow = settings.passing - settings.near_pass_band;
  const weakestTopic = (s) => {
    const arr = Object.entries(s.topicAcc || {}).map(([id, v]) => ({ id, acc: pct1(v.m, v.x) })).sort((a, b) => a.acc - b.acc);
    return arr[0] ? `${subs[arr[0].id] || arr[0].id}（${arr[0].acc}%）` : '';
  };
  const groupOf = (s) => (s.percentage >= settings.passing ? 'consolidate' : s.percentage >= nearLow ? 'nearPass' : 'basic');
  const groups = { basic: [], nearPass: [], consolidate: [] };
  for (const s of done) groups[groupOf(s)].push({ name: s.name, percentage: s.percentage, weakest: weakestTopic(s) });

  // 学习困难学生
  const struggling = done.filter(s => s.percentage < settings.struggling_percent
    || Object.values(s.topicAcc).some(v => pct1(v.m, v.x) < settings.struggling_topic))
    .map(s => ({
      name: s.name, percentage: s.percentage,
      reasons: [
        ...(s.percentage < settings.struggling_percent ? [`总分 ${s.percentage}%，低于 ${settings.struggling_percent}%`] : []),
        ...Object.entries(s.topicAcc).filter(([, v]) => pct1(v.m, v.x) < settings.struggling_topic).map(([id, v]) => `${subs[id] || id} 只有 ${pct1(v.m, v.x)}%`),
      ],
    }));

  // 成绩分布
  const bins = [[0, 39], [40, 49], [50, 59], [60, 69], [70, 79], [80, 89], [90, 100]].map(([lo, hi]) => ({ label: `${lo}–${hi}`, lo, hi, count: 0 }));
  for (const p of pcts) { const b = bins.find(x => p >= x.lo && p <= x.hi + 0.99) || bins[bins.length - 1]; b.count++; }

  // 补救建议与推荐题目
  const bank = await unitQuestions(unitId);
  const remedial = [];
  for (const t of topics.filter(t => t.accuracy < settings.topic_good)) {
    const ids = bank.filter(q => q.subtopic_id === t.id && q.difficulty === 1 && q.qtype !== 'order').slice(0, 3).map(q => q.id);
    remedial.push(`${t.title}（全班得分率 ${t.accuracy}%）：用课本例题重新示范，再做引导练习${ids.length ? `，推荐题目 ${ids.join('、')}` : ''}。`);
  }
  for (const e of errors.slice(0, 3)) if (e.remedy) remedial.push(`${e.name}（${e.students} 人出现）：${e.remedy}`);
  const enrich = bank.filter(q => q.enrichment).map(q => q.id);

  const notes = await one('SELECT notes FROM class_report_notes WHERE class_id = $1 AND report_key = $2', [classId, reportKey({ unitId, quizId, from, to })]);
  return {
    title: '四年级数学全班学习表现分析报告',
    key: reportKey({ unitId, quizId, from, to }),
    info: {
      school: settings.school_name || cls.school_name || '', className: cls.name, subject: settings.subject,
      teacherName: settings.teacher_name || cls.teacher_display || '', topic: `${unit.code} ${unit.title}`,
      period: from || to ? `${from || '开始'} 至 ${to || '今天'}` : '全部日期',
      date: fmtDate(new Date()), rosterCount: roster.length, doneCount: done.length,
      policy: { latest: '每位学生最新一次', best: '每位学生最高一次', first: '每位学生第一次' }[settings.attempt_policy],
    },
    summary: {
      average: avg, averageScore: avgScore, maxScore: maxScoreVal,
      highest: pcts.length ? Math.max(...pcts) : null, lowest: pcts.length ? Math.min(...pcts) : null,
      completionRate: pct1(done.length, roster.length), passedCount: passed.length, passRate: pct1(passed.length, done.length),
      notPassedCount: done.length - passed.length, notSubmitted: roster.length - done.length, passing: settings.passing,
    },
    students: students.map(({ result, topicAcc, ...rest }) => rest),
    topics, skills, errors, bins, groups, struggling, remedial,
    enrichment: enrich,
    settings: { passing: settings.passing, nearLow, topic_good: settings.topic_good, topic_weak: settings.topic_weak, struggling_percent: settings.struggling_percent, struggling_topic: settings.struggling_topic },
    notes: notes?.notes || {},
  };
}

export function reportKey({ unitId, quizId, from, to }) {
  return [unitId, quizId || 'mastery', from || '', to || ''].join('|');
}
