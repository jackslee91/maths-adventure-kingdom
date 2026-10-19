// 学生查看自己的个人学习报告（预览、打印、下载 PDF）
import { esc, loading, toast } from '../ui.js';
import { sapi, download } from '../api.js';
import { individualReportHTML } from '../report-view.js';
import { requireLogin, topbar, bindTopbar } from './common.js';
import { music } from '../audio.js';

export async function renderStudentReport(app, id) {
  if (!requireLogin()) return;
  music(false);
  document.body.classList.add('theme-game');
  app.innerHTML = `<div class="game-page">${topbar({ back: '#/student', backLabel: '背包', title: '我的学习报告' })}${loading('正在生成报告……')}</div>`;
  bindTopbar(app);
  let r;
  try { r = await sapi.get(`/api/student/reports/${id}`); }
  catch (e) { app.querySelector('.loading').outerHTML = `<div class="parchment"><p class="error-text">${esc(e.message)}</p></div>`; return; }
  app.querySelector('.loading').outerHTML = `<div class="report-shell">
    <div class="report-toolbar"><button class="btn green" id="pdf">下载 PDF</button><button class="btn" id="print">打印报告</button>
      <span>这份报告已经交给老师。可以请家长在“家长签阅”处签名。</span></div>
    <div class="print-area">${individualReportHTML(r)}</div></div>`;
  app.querySelector('#print').onclick = () => window.print();
  app.querySelector('#pdf').onclick = async (e) => {
    e.target.disabled = true;
    try { const n = await download(`/api/student/reports/${id}/pdf`, { student: true }); toast(`已下载：${n}`, 'ok'); }
    catch (ex) { toast(ex.message, 'err'); } finally { e.target.disabled = false; }
  };
}
