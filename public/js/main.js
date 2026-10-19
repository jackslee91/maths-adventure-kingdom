// 路由与首页
import { esc, el, toast } from './ui.js';
import { mascot, explorer, explorerGirl, chest, initAssets, preload, setPageScene } from './assets/index.js';
import { api, session } from './api.js';
import { music } from './audio.js';

const app = document.getElementById('app');
let cleanup = null;
let teacherCache = null;

export async function getTeacher(force = false) {
  if (teacherCache && !force) return teacherCache;
  try { teacherCache = (await api.get('/api/teacher/me')).teacher; } catch { teacherCache = null; }
  return teacherCache;
}
export function clearTeacher() { teacherCache = null; }

export function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

const routes = [
  [/^#?\/?$/, () => home()],
  [/^#\/student\/?$/, () => import('./student/hub.js').then(m => m.renderHub(app))],
  [/^#\/student\/login$/, () => import('./student/login.js').then(m => m.renderLogin(app))],
  [/^#\/student\/map\/([^/]+)$/, (u) => import('./student/map.js').then(m => m.renderMap(app, u))],
  [/^#\/student\/play\/([^/]+)\/(\d)(?:\/(remedial|bonus))?$/, (u, s, k) => import('./student/play.js').then(m => m.renderPlay(app, u, Number(s), k || 'stage'))],
  [/^#\/student\/quiz\/(\d+)\/([^/]+)$/, (qid, u) => import('./student/play.js').then(m => m.renderPlay(app, u, 0, 'quiz', Number(qid)))],
  [/^#\/student\/exam\/([^/]+)(?:\/(\d+))?$/, (u, qid) => import('./student/exam.js').then(m => m.renderExam(app, u, qid ? Number(qid) : null))],
  [/^#\/student\/report\/(\d+)$/, (id) => import('./student/report.js').then(m => m.renderStudentReport(app, Number(id)))],
  [/^#\/teacher\/login$/, () => import('./teacher/login.js').then(m => m.renderTeacherLogin(app))],
  [/^#\/teach(?:\/([^/]+))?$/, (lesson) => guard(() => import('./teacher/teach.js').then(m => m.renderTeach(app, lesson)))],
  [/^#\/admin(?:\/([a-z-]+))?(?:\/(\d+))?$/, (tab, id) => guard(() => import('./teacher/dashboard.js').then(m => m.renderDashboard(app, tab || 'records', id)))],
];

async function guard(fn) {
  const t = await getTeacher();
  if (!t) { sessionStorage.setItem('ma_next', location.hash); location.hash = '#/teacher/login'; return; }
  return fn();
}

async function route() {
  if (typeof cleanup === 'function') { try { cleanup(); } catch { /* 忽略 */ } }
  cleanup = null;
  document.querySelectorAll('.burst, .modal-back').forEach(n => n.remove());
  setPageScene(null); // 每一页自己决定背景
  const h = location.hash.split('?')[0];
  document.body.className = '';
  try { if (localStorage.getItem('ma_reduce_motion') === '1') document.body.classList.add('reduce-motion'); } catch { /* 忽略 */ }
  window.scrollTo(0, 0);
  for (const [re, fn] of routes) {
    const m = h.match(re);
    if (m) {
      try {
        const r = await fn(...m.slice(1).map(x => (x === undefined ? undefined : decodeURIComponent(x))));
        if (typeof r === 'function') cleanup = r;
      } catch (e) {
        console.error(e);
        app.innerHTML = `<div class="page-error"><h2>页面载入失败</h2><p>${esc(e.message)}</p><a class="btn" href="#/">返回首页</a></div>`;
      }
      return;
    }
  }
  location.hash = '#/';
}

function home() {
  music(false);
  document.body.classList.add('theme-game');
  setPageScene('bg.home');
  const prof = session.profile();
  app.innerHTML = `
  <main class="home">
    <section class="home-hero">
      <div class="title-plank">
        <h1>数学冒险王</h1>
        <p class="subtitle">四年级数学闯关挑战</p>
      </div>
      <div class="home-cast" aria-hidden="true">${explorer(120)}${mascot('happy', 110)}${explorerGirl(120)}${chest(false, 80)}</div>
      <nav class="home-actions" aria-label="选择模式">
        <a class="mode-card orange" href="#/student">
          <strong>学生进入游戏</strong><span>${prof ? `欢迎回来，${esc(prof.name)}！继续你的冒险` : '输入姓名和班级，开始数学王国冒险'}</span></a>
        <a class="mode-card green" href="#/teach"><strong>教师教学模式</strong><span>课堂互动讲解：逐步竖式、常见错误、课堂小测</span></a>
        <a class="mode-card blue" href="#/admin"><strong>教师管理中心</strong><span>学生记录、全班分析、题库与 A4 报告</span></a>
      </nav>
      <p class="home-foot">内容依据 SJKC 四年级数学课本（KSSR Semakan）单元 1.7 混合运算</p>
    </section>
  </main>`;
}

window.addEventListener('hashchange', route);
window.addEventListener('unhandledrejection', (e) => { const m = e.reason?.message; if (m) toast(m, 'err'); });
// 先读取素材索引（哪些图片已上传），预先载入首页图片，再显示画面
(async () => {
  await initAssets();
  await preload(['bg.home', 'ui.title-plank', 'char.boy.idle', 'char.girl.idle', 'char.mascot.happy'], 3000);
  route();
})();
