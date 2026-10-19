// 题库管理：浏览、预览、试做、新增（由算式自动建立）、修改、删除、新单元
import { esc, el, toast, modal, confirmBox, loading } from '../ui.js';
import { api } from '../api.js';
import { questionTextHTML, answerView } from '../question-view.js';
import { invalidateCache } from './dashboard.js';

const QT = { number: '填答案', remainder: '商和余数', steps: '两步算式', mcq: '选择题', order: '排列步骤' };
const STAGES = ['', '启航站', '训练营', '独立挑战', '迷宫', 'Boss', '王者认证'];
let filt = { unit_id: '', subtopic_id: '', difficulty: '', qtype: '', stage: '', q: '' };

export async function renderBank(main, cache) {
  if (!filt.unit_id) filt.unit_id = cache.units[0]?.id || '';
  const draw = async () => {
    const unit = cache.units.find(u => u.id === filt.unit_id);
    main.innerHTML = `<h1>题库管理</h1><p class="desc">所有题目都经过程序验算才会启用：新增或修改时，系统会重新计算答案、检查竖式与批改规则，不通过就不能保存。</p>
      <div class="t-card filters">
        <label>单元<select class="input" data-k="unit_id">${cache.units.map(u => `<option value="${esc(u.id)}" ${u.id === filt.unit_id ? 'selected' : ''}>${esc(u.code)} ${esc(u.title)}</option>`).join('')}</select></label>
        <label>知识点<select class="input" data-k="subtopic_id"><option value="">全部</option>${(unit?.subtopics || []).map(s => `<option value="${esc(s.id)}" ${s.id === filt.subtopic_id ? 'selected' : ''}>${esc(s.code)} ${esc(s.title)}（${s.count}）</option>`).join('')}</select></label>
        <label>难度<select class="input" data-k="difficulty"><option value="">全部</option>${[1, 2, 3].map(d => `<option ${String(d) === filt.difficulty ? 'selected' : ''} value="${d}">${['', '容易', '中等', '挑战'][d]}</option>`).join('')}</select></label>
        <label>题型<select class="input" data-k="qtype"><option value="">全部</option>${Object.entries(QT).map(([k, v]) => `<option value="${k}" ${k === filt.qtype ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>关卡<select class="input" data-k="stage"><option value="">全部</option>${[1, 2, 3, 4, 5, 6].map(s => `<option value="${s}" ${String(s) === filt.stage ? 'selected' : ''}>第 ${s} 关 ${STAGES[s]}</option>`).join('')}</select></label>
        <label>搜索<input class="input" data-k="q" value="${esc(filt.q)}" placeholder="题目文字或编号"></label>
        <span class="grow"></span><button class="btn green" id="new">新增题目</button><button class="btn ghost" id="newunit">新增单元</button>
      </div><div id="ql">${loading()}</div>`;
    main.querySelectorAll('[data-k]').forEach(i => i.addEventListener('change', () => { filt[i.dataset.k] = i.value; if (i.dataset.k === 'unit_id') filt.subtopic_id = ''; draw(); }));
    main.querySelector('#new').onclick = () => openEditor(null, cache, draw);
    main.querySelector('#newunit').onclick = () => newUnit(cache, draw);
    const p = new URLSearchParams(Object.entries(filt).filter(([, v]) => v));
    const { questions } = await api.get(`/api/teacher/questions?${p}`);
    main.querySelector('#ql').innerHTML = `<div class="t-card"><h2>${questions.length} 道题</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>编号</th><th>题目</th><th>正确答案</th><th>难度</th><th>题型</th><th>关卡</th><th>来源</th><th></th></tr></thead><tbody>
      ${questions.map(q => `<tr><td class="num">${esc(q.id)}</td><td style="max-width:420px">${esc(q.text.split('\n')[0])}</td><td class="num">${esc(q.answerText)}</td><td>${['', '容易', '中等', '挑战'][q.difficulty]}</td><td>${QT[q.qtype]}</td>
        <td>${q.stages.join('、')}</td><td>${esc(q.source || '')}${q.is_textbook ? ' <span class="pill ok">课本</span>' : ''}</td>
        <td class="row" style="flex-wrap:nowrap"><button class="btn small ghost" data-pv="${esc(q.id)}">预览</button><button class="btn small ghost" data-ed="${esc(q.id)}">修改</button><button class="btn small red" data-del="${esc(q.id)}">删除</button></td></tr>`).join('')}
    </tbody></table></div></div>`;
    main.querySelectorAll('[data-pv]').forEach(b => b.onclick = () => preview(questions.find(q => q.id === b.dataset.pv)));
    main.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => openEditor(questions.find(q => q.id === b.dataset.ed), cache, draw));
    main.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!(await confirmBox('删除题目', `确定删除 ${b.dataset.del}？如果已有学生作答，系统会改为停用，报告仍可显示。`))) return;
      const r = await api.del(`/api/teacher/questions/${encodeURIComponent(b.dataset.del)}`);
      toast(r.message || '已删除', 'ok', 5000); invalidateCache(); draw();
    });
  };
  await draw();
}

function preview(q) {
  const body = el(`<div>${questionTextHTML(q)}<div class="slot"></div><div class="q-actions"><button class="btn small" id="try">试做批改</button></div><div id="tr"></div>
    <div class="q-preview" style="margin-top:12px"><p><b>正确答案：</b>${esc(q.answerText)}　<b>满分：</b>${q.marks} 分</p>
      ${q.alternatives?.length ? `<p><b>其他可接受的答案：</b>${esc(q.alternatives.join('；'))}</p>` : ''}
      <p><b>解题步骤：</b></p><ol>${(q.worked_solution || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <p><b>说明：</b>${esc(q.explanation || '')}</p><p><b>提示：</b>${esc(q.hint || '')}${q.hint2 ? `；${esc(q.hint2)}` : ''}</p>
      <p><b>常见错误：</b>${esc(q.misconception || '')}</p><p><b>技能：</b>${esc((q.tags || []).join('、'))}</p></div></div>`);
  const sq = { ...q };
  if (q.qtype === 'steps') { sq.stepPrompt = q.expr ? `${q.expr.nums[0]} ${{ '+': '+', '-': '−', '*': '×', '/': '÷' }[q.expr.ops[0]]} ${q.expr.nums[1]} =` : '第一步'; sq.hasRemainder = !!q.answer.remainder; }
  const av = answerView(sq, { keypad: false });
  body.querySelector('.slot').appendChild(av.el);
  body.querySelector('#try').onclick = async () => {
    const { result } = await api.post('/api/teacher/questions/check', { id: q.id, response: av.getResponse() });
    body.querySelector('#tr').innerHTML = `<div class="feedback ${result.correct ? 'ok' : 'no'}" style="border-width:2px"><b>${result.correct ? '正确' : '不正确'}</b>：得 ${result.marks} / ${result.maxMarks} 分。${esc(result.feedback)}${result.misconception ? `（判断：${esc(result.misconception)}）` : ''}</div>`;
  };
  modal(`预览 ${q.id}`, body, { wide: true, actions: [{ label: '关闭', cls: 'ghost' }] });
}

function newUnit(cache, done) {
  const b = el(`<div><p class="desc">新增老师下一个要教的单元。建立后可以用“新增题目”加入题目；有题目的单元才会出现在学生的地图上。</p>
    <div class="row"><label class="field"><span>单元编号</span><input class="input" name="code" placeholder="例如：2.1"></label><label class="field grow"><span>单元名称</span><input class="input" name="title" placeholder="例如：分数"></label></div>
    <label class="field"><span>知识点（每行一个，写“编号 名称”）</span><textarea class="input" name="subs" placeholder="2.1.1 真分数与假分数&#10;2.1.2 带分数"></textarea></label></div>`);
  modal('新增单元', b, { actions: [{ label: '取消', cls: 'ghost' }, { label: '建立单元', cls: 'green', onClick: async (x) => {
    const subtopics = x.querySelector('[name=subs]').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(\S+)\s+(.+)$/); return m ? { code: m[1], title: m[2] } : { code: l, title: l }; });
    try { await api.post('/api/teacher/units', { code: x.querySelector('[name=code]').value, title: x.querySelector('[name=title]').value, subtopics }); invalidateCache(); toast('单元已建立', 'ok'); location.reload(); }
    catch (e) { toast(e.message, 'err'); return false; }
  } }] });
}

function openEditor(q, cache, done) {
  const isNew = !q;
  const units = cache.units;
  const d = q ? JSON.parse(JSON.stringify(q)) : { unit_id: filt.unit_id || units[0]?.id, subtopic_id: '', difficulty: 2, qtype: 'number', stages: [3, 5, 6], text: '', answer: {}, worked_solution: [], explanation: '', hint: '', hint2: '', misconception: '', alternatives: [], marks: 1, source: '老师新增' };
  const subsOf = (uid) => (units.find(u => u.id === uid)?.subtopics || []);
  const body = el(`<div class="editor">
    ${isNew ? `<div class="t-card" style="background:#f8fafc"><h2>第一步：输入课本的算式，系统自动建立题目</h2>
      <p class="desc">例如“3801 + 8632 − 1472”或“3245 × 19 ÷ 30”。系统会按课本方法算出答案、写出解题步骤、提示与常见错误。应用题可以在下面加上情境题干。选择题与排序题请直接在第二步填写。</p>
      <div class="row"><label class="field grow"><span>算式</span><input class="input" name="expression" placeholder="3801 + 8632 − 1472"></label>
        <label class="field"><span>题型</span><select class="input" name="btype"><option value="">自动</option><option value="number">填答案</option><option value="steps">两步算式（第一步 + 答案）</option><option value="remainder">商和余数</option></select></label></div>
      <label class="field"><span>情境题干（选填，应用题用）</span><textarea class="input" name="btext" rows="2" placeholder="一间图书馆原有 3 801 本书……"></textarea></label>
      <div class="row"><label class="field"><span>单位（选填）</span><input class="input" name="bunit" placeholder="张、本、令吉"></label><button type="button" class="btn" id="build">自动建立</button></div></div>` : ''}
    <h2>${isNew ? '第二步：检查与修改' : '修改题目'}</h2>
    <div class="row">
      <label class="field"><span>单元</span><select class="input" name="unit_id">${units.map(u => `<option value="${esc(u.id)}" ${u.id === d.unit_id ? 'selected' : ''}>${esc(u.code)} ${esc(u.title)}</option>`).join('')}</select></label>
      <label class="field grow"><span>知识点</span><select class="input" name="subtopic_id"></select></label>
      <label class="field"><span>难度</span><select class="input" name="difficulty">${[1, 2, 3].map(x => `<option value="${x}" ${x === Number(d.difficulty) ? 'selected' : ''}>${['', '容易', '中等', '挑战'][x]}</option>`).join('')}</select></label>
      <label class="field"><span>题型</span><select class="input" name="qtype">${Object.entries(QT).map(([k, v]) => `<option value="${k}" ${k === d.qtype ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>满分</span><input class="input" type="number" name="marks" min="1" max="5" value="${d.marks || 1}" style="width:80px"></label></div>
    <p><b>出现在哪些关卡</b></p><div class="check-grid">${[1, 2, 3, 4, 5, 6].map(s => `<label><input type="checkbox" name="st" value="${s}" ${d.stages.includes(s) ? 'checked' : ''}> 第 ${s} 关 ${STAGES[s]}</label>`).join('')}</div>
    <label class="field"><span>题目（第一行是题目，下一行起是补充说明）</span><textarea class="input" name="text" rows="3">${esc(d.text)}</textarea></label>
    <div id="ansfields"></div>
    <label class="field"><span>解题步骤（每行一步）</span><textarea class="input" name="worked" rows="4">${esc((d.worked_solution || []).join('\n'))}</textarea></label>
    <div class="row"><label class="field grow"><span>说明</span><input class="input" name="explanation" value="${esc(d.explanation || '')}"></label><label class="field grow"><span>常见错误</span><input class="input" name="misconception" value="${esc(d.misconception || '')}"></label></div>
    <div class="row"><label class="field grow"><span>提示 1</span><input class="input" name="hint" value="${esc(d.hint || '')}"></label><label class="field grow"><span>提示 2（选填）</span><input class="input" name="hint2" value="${esc(d.hint2 || '')}"></label></div>
    <div class="row"><label class="field grow"><span>其他可接受的答案（用 ; 分开，选填）</span><input class="input" name="alternatives" value="${esc((d.alternatives || []).join('; '))}"></label><label class="field"><span>单位</span><input class="input" name="unit_label" value="${esc(d.unit_label || '')}"></label>
      <label class="field grow"><span>来源</span><input class="input" name="source" value="${esc(d.source || '')}"></label></div>
    <p class="error-text" id="err"></p></div>`);
  const $ = (s) => body.querySelector(s);
  const fillSubs = () => { $('[name=subtopic_id]').innerHTML = subsOf($('[name=unit_id]').value).map(s => `<option value="${esc(s.id)}" ${s.id === d.subtopic_id ? 'selected' : ''}>${esc(s.code)} ${esc(s.title)}</option>`).join(''); };
  $('[name=unit_id]').onchange = fillSubs; fillSubs();
  const exprStr = d.expr ? d.expr.nums.map((n, i) => (i ? ` ${d.expr.ops[i - 1]} ` : '') + n).join('') : '';
  const ansFields = () => {
    const t = $('[name=qtype]').value;
    const a = d.answer || {};
    let h = '';
    if (t === 'number') h = `<label class="field"><span>正确答案</span><input class="input" name="a_value" value="${esc(a.value ?? '')}"></label>`;
    if (t === 'remainder') h = `<div class="row"><label class="field"><span>商</span><input class="input" name="a_q" value="${esc(a.q ?? '')}"></label><label class="field"><span>余数</span><input class="input" name="a_r" value="${esc(a.r ?? '')}"></label></div>`;
    if (t === 'steps') h = `<div class="row"><label class="field"><span>第一步结果</span><input class="input" name="a_s1" value="${esc(a.steps?.[0] ?? '')}"></label><label class="field"><span>最后答案</span><input class="input" name="a_final" value="${esc(a.final ?? '')}"></label><label class="field"><span>余数（没有填 0）</span><input class="input" name="a_rem" value="${esc(a.remainder ?? 0)}"></label></div>`;
    if (t === 'mcq') h = `<label class="field"><span>选项（每行一个；正确的选项前面加 *）</span><textarea class="input" name="a_choices" rows="4">${esc((d.choices || []).map(c => (String(c.value) === String(a.value) ? '*' : '') + c.text).join('\n'))}</textarea></label>`;
    if (t === 'order') h = `<label class="field"><span>步骤（按正确顺序每行一个，学生会看到打乱的顺序）</span><textarea class="input" name="a_items" rows="4">${esc((a.order || []).map(id => d.items?.find(i => i.id === id)?.text || '').join('\n'))}</textarea></label>`;
    if (['number', 'remainder', 'steps'].includes(t)) h += `<label class="field"><span>算式（系统用来验算与判断错误类型；应用题也请填写）</span><input class="input" name="a_expr" value="${esc(exprStr)}" placeholder="3801 + 8632 - 1472"></label>`;
    $('#ansfields').innerHTML = h;
  };
  $('[name=qtype]').onchange = ansFields; ansFields();

  $('#build')?.addEventListener('click', async () => {
    try {
      const { question: b } = await api.post('/api/teacher/questions/build', { expression: $('[name=expression]').value, text: $('[name=btext]').value, unit_label: $('[name=bunit]').value, qtype: $('[name=btype]').value || null, difficulty: Number($('[name=difficulty]').value), stages: [...body.querySelectorAll('[name=st]:checked')].map(x => Number(x.value)) });
      Object.assign(d, b);
      $('[name=qtype]').value = b.qtype; $('[name=text]').value = b.text; $('[name=worked]').value = b.worked_solution.join('\n');
      $('[name=explanation]').value = b.explanation; $('[name=hint]').value = b.hint; $('[name=hint2]').value = b.hint2 || ''; $('[name=misconception]').value = b.misconception; $('[name=marks]').value = b.marks; $('[name=unit_label]').value = b.unit_label || '';
      ansFields();
      $('[name=a_expr]') && ($('[name=a_expr]').value = $('[name=expression]').value);
      toast('已自动建立，请检查后保存。', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  });

  const collect = () => {
    const t = $('[name=qtype]').value;
    const parseExpr = (s) => {
      const m = String(s || '').replace(/[\s,，]/g, '').replace(/[−–]/g, '-').replace(/[×xX]/g, '*').replace(/÷/g, '/').match(/^(\d+)([-+*/])(\d+)(?:([-+*/])(\d+))?$/);
      if (!m) return null;
      return { nums: [Number(m[1]), Number(m[3]), ...(m[4] ? [Number(m[5])] : [])], ops: [m[2], ...(m[4] ? [m[4]] : [])] };
    };
    const out = { ...d, unit_id: $('[name=unit_id]').value, subtopic_id: $('[name=subtopic_id]').value, difficulty: Number($('[name=difficulty]').value), qtype: t, marks: Number($('[name=marks]').value),
      stages: [...body.querySelectorAll('[name=st]:checked')].map(x => Number(x.value)), text: $('[name=text]').value.trim(), worked_solution: $('[name=worked]').value,
      explanation: $('[name=explanation]').value, hint: $('[name=hint]').value, hint2: $('[name=hint2]').value, misconception: $('[name=misconception]').value,
      alternatives: $('[name=alternatives]').value, unit_label: $('[name=unit_label]').value || null, source: $('[name=source]').value };
    delete out.answerText; delete out.tags;
    const n = (v) => Number(String(v).replace(/[\s,]/g, ''));
    if (t === 'number') out.answer = { value: n($('[name=a_value]').value) };
    if (t === 'remainder') out.answer = { q: n($('[name=a_q]').value), r: n($('[name=a_r]').value) };
    if (t === 'steps') out.answer = { steps: [n($('[name=a_s1]').value)], final: n($('[name=a_final]').value), remainder: n($('[name=a_rem]').value || 0) };
    if (['number', 'remainder', 'steps'].includes(t)) {
      const es = $('[name=a_expr]').value.trim();
      out.expr = es ? parseExpr(es) : null;
      if (es && !out.expr) throw new Error('算式格式看不懂');
      if (!out.vertical && !out.given) out.step = null;
    } else out.expr = t === 'mcq' && d.context !== 'concept' ? d.expr || null : null;
    if (t === 'mcq') {
      const lines = $('[name=a_choices]').value.split('\n').map(l => l.trim()).filter(Boolean);
      const old = d.choices || [];
      out.choices = lines.map((l, i) => { const text = l.replace(/^\*/, '').trim(); const prev = old.find(c => c.text === text); return { text, value: prev?.value || `o${i}`, ...(prev?.mc ? { mc: prev.mc } : {}), ...(prev?.why ? { why: prev.why } : {}) }; });
      const right = lines.findIndex(l => l.startsWith('*'));
      if (right < 0) throw new Error('请在正确的选项前面加 *');
      out.answer = { value: out.choices[right].value };
    }
    if (t === 'order') {
      const lines = $('[name=a_items]').value.split('\n').map(l => l.trim()).filter(Boolean);
      out.items = lines.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));
      out.answer = { order: out.items.map(i => i.id) };
    }
    if (!out.context) out.context = 'calc';
    return out;
  };
  modal(isNew ? '新增题目' : `修改 ${q.id}`, body, { wide: true, actions: [{ label: '取消', cls: 'ghost' }, { label: '验算并保存', cls: 'green', onClick: async () => {
    try {
      const question = collect();
      const r = isNew ? await api.post('/api/teacher/questions', { question }) : await api.put(`/api/teacher/questions/${encodeURIComponent(q.id)}`, { question });
      toast(`已保存 ${r.id}（验算通过）`, 'ok'); invalidateCache(); done();
    } catch (e) { $('#err').textContent = e.message; return false; }
  } }] });
}
