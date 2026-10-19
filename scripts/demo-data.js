// 示范数据：建立“四年级示范班”与 12 位示范学生，并通过真实的闯关与评估流程产生记录。
// 用法：npm run demo -- 教师用户名        删除：npm run demo -- --remove
// 示范数据全部标记为 is_demo，与真实学生记录分开。
import { migrate, one, all, q, closeDb } from '../server/db.js';
import { seedContent } from './seed-lib.js';
import { getQuestion } from '../server/services/questions.js';
import { startRun, practiceAttempt, finishRun, startAssessment, submitAssessment, saveDraft } from '../server/services/learning.js';
import { evaluate, seededRandom } from '../shared/math.js';
import { stepErrorVariants } from '../shared/marking.js';
import { hashSecret } from '../server/auth.js';

const DEMO_CLASS = '四年级示范班';
await migrate();

if (process.argv.includes('--remove')) {
  const r = await q('DELETE FROM classes WHERE is_demo = true');
  console.log(`✅ 已删除示范班级（${r.rowCount} 个）及其全部示范记录`);
  await closeDb();
  process.exit(0);
}

const username = (process.argv[2] || '').toLowerCase();
const teacher = username ? await one('SELECT * FROM teachers WHERE username = $1', [username]) : await one(`SELECT * FROM teachers ORDER BY role = 'admin' DESC, id LIMIT 1`);
if (!teacher) { console.log('请先建立教师账户（npm run create-teacher）'); process.exit(1); }
await seedContent();
await q('DELETE FROM classes WHERE name = $1 AND is_demo', [DEMO_CLASS]);
const cls = await one('INSERT INTO classes (name, teacher_id, school_name, is_demo) VALUES ($1, $2, $3, true) RETURNING *', [DEMO_CLASS, teacher.id, '示范华文小学']);

const NAMES = [['01', '张小明', 0.96], ['02', '李美玲', 0.9], ['03', '陈志强', 0.78], ['04', '黄嘉欣', 0.62], ['05', '林俊杰', 0.48],
  ['06', '王丽莎', 0.36], ['07', '吴家豪', 0.3], ['08', '郑雅婷', 0.84], ['09', '刘子轩', 0.66], ['10', '蔡欣怡', 0.5], ['11', '何伟明', 0.22], ['12', '杨思颖', 0.72]];
const rand = seededRandom(4242);
const pinHash = await hashSecret('1234');

function wrongResponse(qd) {
  const e = qd.expr;
  const a = qd.answer;
  if (qd.qtype === 'mcq') { const w = qd.choices.filter(c => c.value !== a.value); return { choice: w[Math.floor(rand() * w.length)].value }; }
  if (qd.qtype === 'order') return { order: [...a.order].reverse() };
  if (e) {
    const ev = evaluate(e);
    const cands = [];
    if (e.ops.length > 1) cands.push(ev.steps[0].result);
    ev.steps.forEach((st, i) => stepErrorVariants(st.a, st.op, st.b).forEach(v => {
      let acc = v.value; for (let k = i + 1; k < e.ops.length; k++) { const op = e.ops[k], n = e.nums[k + 1]; acc = op === '+' ? acc + n : op === '-' ? acc - n : op === '*' ? acc * n : Math.floor(acc / n); }
      cands.push(acc);
    }));
    const wrongFinal = cands.length ? cands[Math.floor(rand() * cands.length)] : ev.final + 10;
    if (qd.qtype === 'number') return { value: String(wrongFinal) };
    if (qd.qtype === 'remainder') return rand() < 0.4 ? { q: String(a.q), r: '' } : { q: String(wrongFinal), r: String(a.r) };
    if (qd.qtype === 'steps') {
      if (rand() < 0.5) return a.remainder ? { steps: [String(a.steps[0])], q: String(wrongFinal), r: String(a.remainder) } : { steps: [String(a.steps[0])], final: String(wrongFinal) };
      return a.remainder ? { steps: [String(wrongFinal)], q: String(a.final), r: '' } : { steps: [String(ev.steps[0].result + 10)], final: String(ev.final + 10) };
    }
  }
  if (qd.step) return { value: String(evaluate({ nums: [qd.step.a, qd.step.b], ops: [qd.step.op] }).final + 100) };
  if (qd.qtype === 'number') return { value: String(Number(a.value) + 1) };
  return {};
}
function rightResponse(qd) {
  const a = qd.answer;
  switch (qd.qtype) {
    case 'number': return { value: String(a.value) };
    case 'remainder': return { q: String(a.q), r: String(a.r) };
    case 'steps': return a.remainder ? { steps: [String(a.steps[0])], q: String(a.final), r: String(a.remainder) } : { steps: [String(a.steps[0])], final: String(a.final) };
    case 'mcq': return { choice: a.value };
    case 'order': return { order: a.order };
  }
}

async function playRun(student, run, ability) {
  const queue = run.questions.map(x => x.id);
  const done = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (done.has(id)) continue;
    const qd = await getQuestion(id);
    let ok = rand() < ability;
    let res = await practiceAttempt(student, run.runId, { question_id: id, response: ok ? rightResponse(qd) : wrongResponse(qd), hints_used: !ok && rand() < 0.4 ? 1 : 0 });
    if (!res.correct) {
      ok = rand() < 0.6;
      res = await practiceAttempt(student, run.runId, { question_id: id, response: ok ? rightResponse(qd) : wrongResponse(qd), hints_used: rand() < 0.5 ? 1 : 0 });
      if (!res.correct && res.support?.easier) queue.push(res.support.easier.id);
    }
    done.add(id);
  }
  return finishRun(student, run.runId, { active_seconds: 120 + Math.floor(rand() * 400) });
}

let n = 0;
for (const [no, name, ability] of NAMES) {
  const st = await one(`INSERT INTO students (class_id, name, pupil_no, pin_hash, source, is_demo) VALUES ($1, $2, $3, $4, 'roster', true) RETURNING *`, [cls.id, name, no, pinHash]);
  const student = { id: st.id, name, class_id: cls.id, teacher_id: teacher.id };
  const lastStage = no === '07' ? 2 : 5; // 吴家豪只完成到第二关；蔡欣怡已开始评估但还没提交
  for (let stage = 1; stage <= lastStage; stage++) {
    const run = await startRun(student, 'U1-7', stage);
    const res = await playRun(student, run, ability);
    if (res.needsRemedial) {
      const rr = await startRun(student, 'U1-7', stage, 'remedial');
      await playRun(student, rr, Math.min(0.95, ability + 0.2));
    }
  }
  if (lastStage === 5 && no !== '10') {
    const sess = await startAssessment(student, 'U1-7');
    const answers = {};
    for (const qs of sess.questions) {
      const qd = await getQuestion(qs.id);
      answers[qs.id] = rand() < ability ? rightResponse(qd) : wrongResponse(qd);
    }
    await submitAssessment(student, sess.sessionId, { answers, active_seconds: 600 + Math.floor(rand() * 900) });
    n++;
  } else if (no === '10') {
    const sess = await startAssessment(student, 'U1-7');
    await saveDraft(student, sess.sessionId, { answers: {}, active_seconds: 30 });
  }
}
// 示范用：补上合理的练习与评估时间（脚本瞬间完成，没有真实的作答时间）
await q(`UPDATE stage_runs r SET active_seconds = 180 + (abs(hashtext(r.id::text)) % 420) FROM students s WHERE s.id = r.student_id AND s.is_demo`);
await q(`UPDATE assessments a SET duration_sec = 540 + (a.id * 97 % 600),
  practice = jsonb_set(a.practice, '{practiceSeconds}', to_jsonb((SELECT coalesce(sum(active_seconds), 0) FROM stage_runs r WHERE r.student_id = a.student_id AND r.unit_id = a.unit_id)))
  WHERE a.is_demo`);
// 让提交时间分布在最近几天
await q(`UPDATE assessments SET submitted_at = submitted_at - (id % 5) * interval '1 day' - (id % 7) * interval '37 minutes' WHERE is_demo`);
await q(`UPDATE assessments SET teacher_comment = '计算细心，解题步骤清楚，继续保持！' WHERE is_demo AND percentage >= 85`);
console.log(`✅ 示范班“${DEMO_CLASS}”已建立：${NAMES.length} 位示范学生，${n} 份已提交的评估（示范学生的冒险密码都是 1234）。`);
await closeDb();
