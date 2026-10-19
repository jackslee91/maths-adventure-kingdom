"""端到端测试：一位新学生从登记、六关闯关到提交评估与查看报告（无头浏览器）。
用法：python3 tests/e2e/student_flow.py http://localhost:3000 "postgres://..."
需要：playwright（Python）与 psql。测试会建立一位名为“自动测试”的学生，结束后删除。
"""
import json, subprocess, sys, time, random
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000'
DB = sys.argv[2] if len(sys.argv) > 2 else 'postgres://postgres@127.0.0.1:5432/mathadv'
SHOTS = sys.argv[3] if len(sys.argv) > 3 else None
NAME = '自动测试' + str(random.randint(100, 999))

def sql(q):
    return subprocess.run(['psql', DB, '-tAc', q], capture_output=True, text=True, check=True).stdout.strip()

def question(qid):
    row = sql(f"select json_build_object('qtype', qtype, 'data', data) from questions where id = '{qid}'")
    r = json.loads(row)
    return r['qtype'], r['data']

def shot(pg, name):
    if SHOTS: pg.screenshot(path=f'{SHOTS}/{name}.png', full_page=False)

def answer_card(pg, card, wrong=False, submit=True):
    qid = card.get_attribute('data-qid')
    qtype, d = question(qid)
    a = d['answer']
    if qtype == 'mcq':
        val = a['value']
        if wrong:
            val = [c['value'] for c in d['choices'] if c['value'] != a['value']][0]
        sel = card.locator(f'.choice[data-v="{val}"], .fork-door[data-v="{val}"]')
        sel.first.click()
        if card.locator('.fork-door').count():
            return qid
    elif qtype == 'order':
        items = {i['id']: i['text'] for i in d['items']}
        order = a['order'] if not wrong else list(reversed(a['order']))
        for i in order:
            card.locator('.order-item', has_text=items[i]).first.click()
    elif qtype == 'number':
        card.locator('input[name=value]').fill(str(a['value'] + (7 if wrong else 0)))
    elif qtype == 'remainder':
        card.locator('input[name=q]').fill(str(a['q'] + (3 if wrong else 0)))
        card.locator('input[name=r]').fill(str(a['r']))
    elif qtype == 'steps':
        card.locator('input[name=s1]').fill(str(a['steps'][0]))
        if card.locator('input[name=final]').count():
            card.locator('input[name=final]').fill(str(a['final'] + (5 if wrong else 0)))
        else:
            card.locator('input[name=q]').fill(str(a['final']))
            card.locator('input[name=r]').fill(str(a['remainder']))
    if submit:
        card.locator('[data-a=submit]').click()
    return qid

def wait_next(pg):
    pg.wait_for_selector('.feedback.ok [data-a=next], .feedback.ok button', timeout=8000)
    pg.locator('.feedback.ok button').first.click()

def play_practice(pg, wrong_first=False):
    seen = 0
    while True:
        pg.wait_for_selector('.qcard[data-qid], .result-card', timeout=15000)
        if pg.locator('.result-card').count():
            return
        card = pg.locator('.qcard[data-qid]').first
        if wrong_first and seen == 0 and card.locator('input[name=value], input[name=q], .choice').count():
            answer_card(pg, card, wrong=True); pg.wait_for_selector('.feedback.no', timeout=8000)
            if card.locator('.choice').count():
                pass
            answer_card(pg, card, wrong=True); pg.wait_for_selector('.support-box, .feedback.no h3', timeout=8000)
            shot(pg, 'support')
            assert pg.locator('.solution').count() >= 1, '两次答错后应显示解题步骤'
            qid = card.get_attribute('data-qid')
            pg.locator('[data-a=next]').first.click()
            pg.wait_for_selector(f'.qcard[data-qid="{qid}"]', state='detached', timeout=10000)
            seen += 1
            continue
        qid = answer_card(pg, card)
        wait_next(pg)
        pg.wait_for_selector(f'.qcard[data-qid="{qid}"]', state='detached', timeout=10000)
        seen += 1

def play_maze(pg):
    global LAST_PG
    LAST_PG = pg
    while True:
        pg.wait_for_selector('.qcard[data-qid], .result-card', timeout=15000)
        if pg.locator('.result-card').count():
            return
        card = pg.locator('#room-q .qcard[data-qid]').first
        if card.locator('.fork-door').count():
            # 先走一次死路，确认答案会影响路线
            qtype, d = question(card.get_attribute('data-qid'))
            wrongv = [c['value'] for c in d['choices'] if c['value'] != d['answer']['value']][0]
            card.locator(f'.fork-door[data-v="{wrongv}"]').click()
            pg.wait_for_selector('.fork-door.dead', timeout=8000)
            card.locator(f'.fork-door[data-v="{d["answer"]["value"]}"]').click()
            pg.wait_for_selector('.feedback.ok button', timeout=8000)
            fq = card.get_attribute('data-qid')
            pg.locator('.feedback.ok button').first.click()
            try:
                pg.wait_for_selector(f'.qcard[data-qid="{fq}"]', state='detached', timeout=10000)
            except Exception:
                pg.screenshot(path=f'{SHOTS}/fail.png', full_page=True); print(pg.inner_text('#room-q')[:500]); raise
        else:
            qid = answer_card(pg, card)
            wait_next(pg)
            pg.wait_for_selector(f'.qcard[data-qid="{qid}"]', state='detached', timeout=10000)

def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1280, 'height': 900})
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and '401' not in m.text else None)
        pg.goto(BASE + '/#/student/login')
        pg.wait_for_selector('select[name=class_id] option:nth-child(2)', state='attached')
        pg.select_option('select[name=class_id]', index=1)
        pg.fill('input[name=name]', NAME); pg.fill('input[name=pin]', '1357')
        pg.click('button[type=submit]')
        pg.wait_for_selector('text=开始冒险')
        unit = 'U1-7'
        # 第一关
        pg.goto(BASE + f'/#/student/play/{unit}/1')
        for _ in range(12):
            pg.wait_for_selector('[data-a=next]')
            while pg.locator('[data-a=done][disabled]').count():
                pg.click('[data-a=next]')
            pg.click('[data-a=done]')
            time.sleep(0.15)
            if pg.locator('.qcard[data-qid]').count():
                break
        shot(pg, 's1-check')
        play_practice(pg)
        shot(pg, 's1-result')
        assert '过关' in pg.inner_text('.result-card'), '第一关应过关'
        # 第二关：第一题故意答错两次（测试补救）
        pg.goto(BASE + f'/#/student/play/{unit}/2')
        play_practice(pg, wrong_first=True)
        shot(pg, 's2-result')
        # 第三关
        pg.goto(BASE + f'/#/student/play/{unit}/3')
        play_practice(pg)
        # 第四关迷宫
        pg.goto(BASE + f'/#/student/play/{unit}/4')
        pg.wait_for_selector('.maze-scene')
        shot(pg, 's4-maze')
        play_maze(pg)
        # 第五关 Boss
        pg.goto(BASE + f'/#/student/play/{unit}/5')
        pg.wait_for_selector('.boss-arena')
        shot(pg, 's5-boss')
        play_practice(pg)
        shot(pg, 's5-result')
        # 第六关
        pg.goto(BASE + f'/#/student/exam/{unit}')
        pg.click('#go')
        pg.wait_for_selector('.exam-nav button')
        n = pg.locator('.exam-nav button').count()
        for i in range(n):
            card = pg.locator('#eq .qcard[data-qid]').first
            answer_card(pg, card, wrong=(i == 0), submit=False)
            if i < n - 1:
                pg.click('#next')
        shot(pg, 's6-exam')
        pg.click('#submit')
        pg.wait_for_selector('text=提交成功！老师已收到你的学习记录。', timeout=15000)
        shot(pg, 's6-done')
        pg.click('text=查看学习报告')
        pg.wait_for_selector('.a4')
        shot(pg, 's6-report')
        text = pg.inner_text('.a4')
        assert NAME in text and '各知识点表现' in text
        with pg.expect_download() as dl:
            pg.click('#pdf')
        path = dl.value.path()
        assert open(path, 'rb').read(5) == b'%PDF-', '下载的不是 PDF'
        sid = sql(f"select id from students where name = '{NAME}'")
        cnt = sql(f"select count(*) from assessments where student_id = {sid}")
        assert cnt == '1', f'应只有 1 份评估，实际 {cnt}'
        pct = sql(f"select percentage from assessments where student_id = {sid}")
        print(f'学生 {NAME}：评估得分率 {pct}%，页面错误 {len(errors)} 个')
        for e in errors: print('  ', e)
        b.close()
        sql(f"delete from students where id = {sid}")
        if errors: sys.exit(1)
        print('✅ 学生端完整流程测试通过')

LAST_PG = None
try:
    main()
except Exception:
    if LAST_PG and SHOTS: LAST_PG.screenshot(path=f'{SHOTS}/fail.png')
    raise
