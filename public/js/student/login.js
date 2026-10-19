// 学生登录：姓名、班级、冒险密码（4 位数字）
import { esc, el, toast } from '../ui.js';
import { api, session } from '../api.js';
import { mascot, explorerBoy, explorerGirl, setPageScene, hasAsset } from '../assets/index.js';
import { play } from '../audio.js';
import { chooseHero, heroChoice } from './common.js';

export async function renderLogin(app) {
  document.body.classList.add('theme-game');
  setPageScene('bg.login');
  app.innerHTML = `<main class="login-wrap"><form class="parchment login-card" novalidate>
    <div class="login-guide" aria-hidden="true">${mascot('happy', 110)}</div>
    ${hasAsset('char.girl.idle') ? `<div class="login-kid left" aria-hidden="true">${explorerBoy(260)}</div><div class="login-kid right" aria-hidden="true">${explorerGirl(260)}</div>` : ''}
    <h1>冒险者登记</h1>
    <p class="lead">我是向导阿算！先选你的班级和名字，我们一起勇闯数学王国。</p>
    <label class="field"><span>班级</span><select class="input" name="class_id" required><option value="">载入中……</option></select></label>
    <label class="field hidden" id="pick-field"><span>选择你的名字</span><select class="input" name="student_id"></select></label>
    <div id="type-fields">
      <label class="field"><span>学生姓名</span><input class="input" name="name" maxlength="30" autocomplete="off" placeholder="例如：张小明"></label>
      <label class="field"><span>学号（选填）</span><input class="input" name="pupil_no" maxlength="20" autocomplete="off" inputmode="numeric" placeholder="班上有同名同学时才需要"></label>
    </div>
    <label class="field"><span>冒险密码（4 位数字）</span><input class="input" name="pin" type="password" inputmode="numeric" maxlength="4" pattern="\\d{4}" required autocomplete="off">
      <small id="pin-tip">第一次登记时自己设定，以后在别的电脑继续冒险要用到。忘记了请老师帮你重设。</small></label>
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

  // 选了班级：老师已建立名单的话，用下拉选单选名字；名单上没有的同学可以自己写名字
  const pickField = form.querySelector('#pick-field');
  const typeFields = form.querySelector('#type-fields');
  const pinTip = form.querySelector('#pin-tip');
  const OTHER = 'other';
  let roster = [];
  const TIP_NEW = '这是你第一次登记：请自己设定 4 位数字密码，并记住它！以后在别的电脑继续冒险要用到。';
  const TIP_OLD = '请输入你的冒险密码。忘记了请老师帮你重设。';
  const updateMode = () => {
    const v = form.student_id.value;
    const typing = !roster.length || v === OTHER;
    typeFields.classList.toggle('hidden', !typing);
    const s = roster.find(x => String(x.id) === v);
    pinTip.textContent = s ? (s.registered ? TIP_OLD : TIP_NEW) : '第一次登记时自己设定，以后在别的电脑继续冒险要用到。忘记了请老师帮你重设。';
  };
  const loadRoster = async () => {
    roster = [];
    pickField.classList.add('hidden');
    if (sel.value) {
      try { roster = (await api.get(`/api/public/classes/${encodeURIComponent(sel.value)}/roster`)).students; } catch { roster = []; }
    }
    if (roster.length) {
      form.student_id.innerHTML = `<option value="">请选择你的名字</option>${roster.map(s => `<option value="${s.id}">${s.pupilNo ? `${esc(s.pupilNo)}　` : ''}${esc(s.name)}</option>`).join('')}<option value="${OTHER}">我的名字不在名单上</option>`;
      pickField.classList.remove('hidden');
      const me = session.profile();
      if (me && roster.some(s => s.id === me.id)) form.student_id.value = String(me.id);
    }
    updateMode();
  };
  sel.addEventListener('change', () => { try { localStorage.setItem('ma_last_class', sel.value); } catch { /* 忽略 */ } loadRoster(); });
  form.student_id.addEventListener('change', updateMode);
  try { const last = localStorage.getItem('ma_last_class'); if (last && [...sel.options].some(o => o.value === last)) sel.value = last; } catch { /* 忽略 */ }
  await loadRoster();
  const prof = session.profile();
  if (prof) form.name.value = prof.name;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector('.error-text');
    err.textContent = '';
    const picked = roster.length && form.student_id.value !== OTHER ? form.student_id.value : '';
    const body = { class_id: form.class_id.value, name: form.name.value.trim(), pupil_no: form.pupil_no.value.trim(), pin: form.pin.value.trim() };
    if (picked) body.student_id = Number(picked);
    if (!body.class_id) { err.textContent = '请选择你的班级。'; return; }
    if (roster.length && !form.student_id.value) { err.textContent = '请从名单选择你的名字。'; return; }
    if (!picked && body.name.length < 2) { err.textContent = '请输入完整的姓名。'; return; }
    if (!/^\d{4}$/.test(body.pin)) { err.textContent = '冒险密码要是 4 位数字。'; return; }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const r = await api.post('/api/student/login', body);
      session.set(r.token, r.student);
      play('level');
      toast(r.isNew ? `欢迎你，${r.student.name}！冒险密码已设定，请记住它。` : `欢迎回来，${r.student.name}！`, 'ok');
      const go = () => { location.hash = '#/student?go=map'; };
      // 第一次进入：先选择男生或女生冒险家
      if (hasAsset('char.girl.idle') && !heroChoice(r.student)) chooseHero(go); else go();
    } catch (ex) {
      err.textContent = ex.message;
      if (ex.extra?.needPupilNo) form.pupil_no.focus();
    } finally { btn.disabled = false; }
  });
}
