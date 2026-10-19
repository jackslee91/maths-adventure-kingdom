// API 集成测试：需要正在运行的服务器与数据库。
// 用法：TEST_BASE_URL=http://localhost:3000 TEST_TEACHER=用户名 TEST_PASSWORD=密码 node --test tests/
// 没有设置 TEST_BASE_URL 时会跳过。
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_BASE_URL;
const T_USER = process.env.TEST_TEACHER, T_PASS = process.env.TEST_PASSWORD;
const skip = !BASE || !T_USER ? '没有设置 TEST_BASE_URL / TEST_TEACHER，跳过 API 测试' : false;

async function call(method, path, body, { token, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, data: ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
}

test('安全与完整流程', { skip }, async (t) => {
  // 未登录不能访问教师与学生资料
  assert.equal((await call('GET', '/api/teacher/records?class_id=1&unit_id=U1-7')).status, 401);
  assert.equal((await call('GET', '/api/teacher/assessments/1/pdf')).status, 401);
  assert.equal((await call('GET', '/api/student/reports/1')).status, 401);
  assert.equal((await call('GET', '/api/student/units', null, { token: 'fake' })).status, 401);
  // 跨来源的修改请求被拒绝
  const xs = await fetch(BASE + '/api/teacher/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' });
  assert.equal(xs.status, 403);

  const login = await call('POST', '/api/teacher/login', { username: T_USER, password: T_PASS });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.ok(/HttpOnly/i.test(login.headers.get('set-cookie')));

  // 建立测试班级
  const cname = '测试班' + Date.now();
  const cls = (await call('POST', '/api/teacher/classes', { name: cname }, { cookie })).data.class;
  await call('POST', `/api/teacher/classes/${cls.id}/students`, { text: '01 测试甲\n02 测试乙\n03 测试丙' }, { cookie });

  // 两位学生登录
  const a = (await call('POST', '/api/student/login', { class_id: cls.id, name: '测试甲', pin: '1111' })).data;
  const b = (await call('POST', '/api/student/login', { class_id: cls.id, name: '测试乙', pin: '2222' })).data;
  assert.ok(a.token && b.token);
  // 密码错误
  assert.equal((await call('POST', '/api/student/login', { class_id: cls.id, name: '测试甲', pin: '9999' })).status, 401);

  // 还没解锁不能直接参加第六关
  assert.equal((await call('POST', '/api/student/assessments/start', { unit_id: 'U1-7' }, { token: a.token })).status, 403);
  assert.equal((await call('POST', '/api/student/runs', { unit_id: 'U1-7', stage: 3 }, { token: a.token })).status, 403);

  // 练习题：学生拿到的题目不包含答案
  const run = (await call('POST', '/api/student/runs', { unit_id: 'U1-7', stage: 1 }, { token: a.token })).data;
  const qx = run.questions[0];
  assert.equal(qx.answer, undefined); assert.equal(qx.worked_solution, undefined);
  // 不在这一关的题目不能作答
  assert.equal((await call('POST', `/api/student/runs/${run.runId}/attempt`, { question_id: 'MD-001', response: {} }, { token: a.token })).status, 400);
  // 别人的关卡不能作答
  assert.equal((await call('POST', `/api/student/runs/${run.runId}/attempt`, { question_id: qx.id, response: {} }, { token: b.token })).status, 404);

  // 由教师资料取得正确答案（教师可以看到答案），让学生甲过关
  const full = async (id) => (await call('GET', `/api/teacher/questions/${id}`, null, { cookie })).data.question;
  const right = (q) => {
    const a = q.answer;
    switch (q.qtype) {
      case 'number': return { value: String(a.value) };
      case 'remainder': return { q: String(a.q), r: String(a.r) };
      case 'steps': return a.remainder ? { steps: [String(a.steps[0])], q: String(a.final), r: String(a.remainder) } : { steps: [String(a.steps[0])], final: String(a.final) };
      case 'mcq': return { choice: a.value };
      default: return { order: a.order };
    }
  };
  for (let stage = 1; stage <= 5; stage++) {
    const r = stage === 1 ? run : (await call('POST', '/api/student/runs', { unit_id: 'U1-7', stage }, { token: a.token })).data;
    for (const q of r.questions) {
      const res = await call('POST', `/api/student/runs/${r.runId}/attempt`, { question_id: q.id, response: right(await full(q.id)) }, { token: a.token });
      assert.equal(res.data.correct, true, `${q.id} 正确答案应判为正确`);
    }
    const fin = (await call('POST', `/api/student/runs/${r.runId}/finish`, { active_seconds: 60 }, { token: a.token })).data;
    assert.equal(fin.passed, true);
    // 重复结束不会重复加分
    assert.equal((await call('POST', `/api/student/runs/${r.runId}/finish`, {}, { token: a.token })).data.already, true);
  }

  // 正式评估：答案不外泄、草稿保存、重复提交只算一次
  const s = (await call('POST', '/api/student/assessments/start', { unit_id: 'U1-7' }, { token: a.token })).data;
  assert.ok(s.questions.length >= 4);
  assert.equal(s.questions[0].hint, undefined, '正式评估不提供提示');
  const answers = {};
  for (const q of s.questions) answers[q.id] = right(await full(q.id));
  answers[s.questions[0].id] = {}; // 留一题空白
  assert.equal((await call('PUT', `/api/student/assessments/${s.sessionId}/draft`, { answers, active_seconds: 30 }, { token: a.token })).data.saved, true);
  // 重新开始会回到同一场次
  assert.equal((await call('POST', '/api/student/assessments/start', { unit_id: 'U1-7' }, { token: a.token })).data.sessionId, s.sessionId);
  // 别人不能提交
  assert.equal((await call('POST', `/api/student/assessments/${s.sessionId}/submit`, { answers }, { token: b.token })).status, 404);
  const [sub1, sub2] = await Promise.all([
    call('POST', `/api/student/assessments/${s.sessionId}/submit`, { answers, active_seconds: 100 }, { token: a.token }),
    call('POST', `/api/student/assessments/${s.sessionId}/submit`, { answers, active_seconds: 100 }, { token: a.token }),
  ]);
  assert.equal(sub1.status, 200); assert.equal(sub2.status, 200);
  assert.equal(sub1.data.assessmentId, sub2.data.assessmentId, '同时提交两次只能产生一份记录');
  assert.ok(sub1.data.duplicate !== sub2.data.duplicate);
  const total = s.questions.length;
  assert.equal(sub1.data.correct, total - 1);
  assert.ok(sub1.data.percentage < 100 && sub1.data.percentage > 0);

  // 学生只能看自己的报告
  assert.equal((await call('GET', `/api/student/reports/${sub1.data.assessmentId}`, null, { token: b.token })).status, 403);
  const rep = (await call('GET', `/api/student/reports/${sub1.data.assessmentId}`, null, { token: a.token })).data;
  assert.equal(rep.overall.score, sub1.data.score);
  assert.ok(rep.errors.some(e => e.code === 'BLANK'), '空白题应列为“没有作答”');

  // 全班统计：未提交的学生不算 0 分
  const cr = (await call('GET', `/api/teacher/class-report?class_id=${cls.id}&unit_id=U1-7`, null, { cookie })).data;
  assert.equal(cr.info.rosterCount, 3);
  assert.equal(cr.info.doneCount, 1);
  assert.equal(cr.summary.average, sub1.data.percentage);
  assert.equal(cr.summary.completionRate, 33.3);
  assert.equal(cr.students.find(x => x.name === '测试丙').status, '未提交');

  // PDF、ZIP、Excel、CSV
  const pdf = await call('GET', `/api/teacher/assessments/${sub1.data.assessmentId}/pdf`, null, { cookie });
  assert.equal(pdf.data.subarray(0, 5).toString(), '%PDF-');
  assert.ok(/filename\*=UTF-8''/.test(pdf.headers.get('content-disposition')));
  const cpdf = await call('GET', `/api/teacher/class-report/pdf?class_id=${cls.id}&unit_id=U1-7`, null, { cookie });
  assert.equal(cpdf.data.subarray(0, 5).toString(), '%PDF-');
  const zip = await call('GET', `/api/teacher/bulk/zip?class_id=${cls.id}&unit_id=U1-7`, null, { cookie });
  assert.equal(zip.data.readUInt32LE(0), 0x04034b50);
  const xlsx = await call('GET', `/api/teacher/export?format=xlsx&class_id=${cls.id}&unit_id=U1-7`, null, { cookie });
  assert.equal(xlsx.data.readUInt32LE(0), 0x04034b50);
  const csv = await call('GET', `/api/teacher/export?format=csv&class_id=${cls.id}&unit_id=U1-7`, null, { cookie });
  assert.ok(csv.data.toString('utf8').includes('测试甲'));

  // 题库：错误答案不能保存
  const bad = await call('POST', '/api/teacher/questions', { question: { unit_id: 'U1-7', subtopic_id: 'U1-7-1', difficulty: 1, qtype: 'number', stages: [3], text: '1 + 2 + 3 = ?', expr: { nums: [1, 2, 3], ops: ['+', '+'] }, answer: { value: 7 }, worked_solution: 'x', explanation: 'e', hint: 'h', misconception: 'm' } }, { cookie });
  assert.equal(bad.status, 422);

  // 清理
  const del = await call('DELETE', `/api/teacher/classes/${cls.id}`, { confirm: cname }, { cookie });
  assert.equal(del.status, 200);
});
