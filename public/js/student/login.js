// 学生登录：姓名、班级、冒险密码（4 位数字）
import { esc, el, toast } from '../ui.js';
import { api, session } from '../api.js';
import { mascot, setPageScene } from '../assets/index.js';
import { play } from '../audio.js';

export async function renderLogin(app) {
  document.body.classList.add('theme-game');
  setPageScene('bg.login');
  app.innerHTML = `<main class="login-wrap"><form class="parchment login-card" novalidate>
    <div class="login-guide" aria-hidden="true">${mascot('happy', 110)}</div>
    <h1>冒险者登记</h1>
    <p class="lead">我是向导阿算！写下你的名字，我们一起勇闯数学王国。</p>
    <label class="field"><span>班级</span><select class="input" name="class_id" required><option value="">载入中……</option></select></label>
    <label class="field"><span>学生姓名</span><input class="input" name="name" maxlength="30" autocomplete="off" required placeholder="例如：张小明"></label>
    <label class="field"><span>学号（选填）</span><input class="input" name="pupil_no" maxlength="20" autocomplete="off" inputmode="numeric" placeholder="班上有同名同学时才需要"></label>
    <label class="field"><span>冒险密码（4 位数字）</span><input class="input" name="pin" type="password" inputmode="numeric" maxlength="4" pattern="\\d{4}" required autocomplete="off">
      <small>第一次登记时自己设定，以后在别的电脑继续冒险要用到。忘记了请老师帮你重设。</small></label>
    <p class="error-text" role="alert"></p>
    <div class="row"><a class="btn ghost" href="#/">返回首页</a><span class="grow"></span><button class="btn orange big" type="submit">出发冒险</button></div>
  </form></main>`;
  const form = app.querySelector('form');
  const sel = form.class_id;
  try {
    const { classes } = await api.get('/api/public/classes');
    sel.innerHTML = `<option value="">请选择班级</option>${classes.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}`;
    if (!classes.length) sel.innerHTML = '<option value="">老师还没有建立班级</option>';
  } catch (e) { sel.innerHTML = `<option value="">${esc(e.message)}</option>`; }
  const prof = session.profile();
  if (prof) form.name.value = prof.name;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector('.error-text');
    err.textContent = '';
    const body = { class_id: form.class_id.value, name: form.name.value.trim(), pupil_no: form.pupil_no.value.trim(), pin: form.pin.value.trim() };
    if (!body.class_id) { err.textContent = '请选择你的班级。'; return; }
    if (body.name.length < 2) { err.textContent = '请输入完整的姓名。'; return; }
    if (!/^\d{4}$/.test(body.pin)) { err.textContent = '冒险密码要是 4 位数字。'; return; }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const r = await api.post('/api/student/login', body);
      session.set(r.token, r.student);
      play('level');
      toast(r.isNew ? `欢迎你，${r.student.name}！冒险密码已设定，请记住它。` : `欢迎回来，${r.student.name}！`, 'ok');
      location.hash = '#/student';
    } catch (ex) {
      err.textContent = ex.message;
      if (ex.extra?.needPupilNo) form.pupil_no.focus();
    } finally { btn.disabled = false; }
  });
}
