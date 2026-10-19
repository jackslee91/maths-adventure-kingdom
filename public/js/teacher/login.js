// 教师登录
import { api } from '../api.js';
import { getTeacher } from '../main.js';

export function renderTeacherLogin(app) {
  document.body.classList.add('theme-teacher');
  app.innerHTML = `<main class="teacher-login"><form novalidate>
    <h1 style="margin:0 0 4px">教师登录</h1><p class="desc" style="color:#5b6478;margin:0 0 16px">登录后可使用教学模式与管理中心。学生无法进入这里。</p>
    <label class="field"><span>用户名</span><input class="input" name="username" autocomplete="username" required></label>
    <label class="field"><span>密码</span><input class="input" type="password" name="password" autocomplete="current-password" required></label>
    <p class="error-text" role="alert"></p>
    <div class="row"><a class="btn ghost" href="#/">返回首页</a><span class="grow"></span><button class="btn" type="submit">登录</button></div>
  </form></main>`;
  const f = app.querySelector('form');
  f.username.focus();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const err = f.querySelector('.error-text');
    err.textContent = '';
    try {
      await api.post('/api/teacher/login', { username: f.username.value, password: f.password.value });
      await getTeacher(true);
      const next = sessionStorage.getItem('ma_next') || '#/admin';
      sessionStorage.removeItem('ma_next');
      location.hash = next;
    } catch (ex) { err.textContent = ex.message; }
  };
}
