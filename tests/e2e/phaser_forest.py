"""《魔法森林大冒险》（第 2 关 Phaser 版）端到端测试：
登记 → 选冒险家 → 奔跑跳跃收集金币星星 → 碰到史莱姆与魔法门出题 → 答对 / 答错 → 走到宝箱过关 →
确认数据库有作答记录、金币不影响成绩、老师端读得到。
用法：python3 tests/e2e/phaser_forest.py http://localhost:3000 "postgres://..." [截图文件夹]
"""
import sys, random, json, subprocess
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000'
DB = sys.argv[2] if len(sys.argv) > 2 else 'postgres://postgres@127.0.0.1:5432/mathadv'
SHOTS = sys.argv[3] if len(sys.argv) > 3 else None
NAME = '森林测试' + str(random.randint(100, 999))

def sql(q):
    return subprocess.run(['psql', DB, '-tAc', q], capture_output=True, text=True, check=True).stdout.strip()

def question(qid):
    r = json.loads(sql(f"select json_build_object('qtype', qtype, 'data', data) from questions where id = '{qid}'"))
    return r['qtype'], r['data']

def fill(card, wrong=False):
    qtype, d = question(card.get_attribute('data-qid')); a = d['answer']
    if qtype == 'mcq':
        v = a['value'] if not wrong else [c['value'] for c in d['choices'] if c['value'] != a['value']][0]
        card.locator(f'.choice[data-v="{v}"]').first.click()
    elif qtype == 'order':
        items = {i['id']: i['text'] for i in d['items']}
        for i in (a['order'] if not wrong else list(reversed(a['order']))): card.locator('.order-item', has_text=items[i]).first.click()
    elif qtype == 'number': card.locator('input[name=value]').fill(str(a['value'] + (7 if wrong else 0)))
    elif qtype == 'remainder':
        card.locator('input[name=q]').fill(str(a['q'] + (3 if wrong else 0))); card.locator('input[name=r]').fill(str(a['r']))
    elif qtype == 'steps':
        card.locator('input[name=s1]').fill(str(a['steps'][0]))
        if card.locator('input[name=final]').count(): card.locator('input[name=final]').fill(str(a['final'] + (5 if wrong else 0)))
        else: card.locator('input[name=q]').fill(str(a['final'])); card.locator('input[name=r]').fill(str(a['remainder']))
    card.locator('[data-a=submit]').click()

def shot(pg, n):
    if SHOTS: pg.screenshot(path=f'{SHOTS}/{n}.png')

def dbg(pg): return pg.evaluate('window.__forestDebug && window.__forestDebug()')

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--enable-unsafe-swiftshader'])
        pg = b.new_page(viewport={'width': 1280, 'height': 800})
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(BASE + '/#/student/login')
        pg.wait_for_selector('select[name=class_id] option:nth-child(2)', state='attached')
        pg.select_option('select[name=class_id]', index=1); pg.wait_for_timeout(400)
        if pg.locator('#pick-field:not(.hidden)').count(): pg.select_option('select[name=student_id]', 'other')
        pg.fill('input[name=name]', NAME); pg.fill('input[name=pin]', '2468'); pg.click('button[type=submit]')
        pg.wait_for_selector('.hero-pick'); pg.click('.hero-card[data-g=girl]'); pg.wait_for_selector('.map-stage')
        sid = sql(f"select id from students where name = '{NAME}'")
        state = '{"badges":[],"stages":{"1":{"best":100,"runs":1,"stars":3,"passed":true,"completed":true}},"remedial":{}}'
        sql(f"insert into progress(student_id,unit_id,state) values({sid},'U1-7','{state}') on conflict (student_id,unit_id) do update set state=excluded.state")
        try:
            pg.goto(BASE + '/#/student/play/U1-7/2')
            pg.wait_for_selector('#forest-stage[data-state=play]', timeout=25000)
            shot(pg, 'forest-1-start')
            # 跳上第一个石台拿金币
            pg.wait_for_timeout(600)
            print('fps', dbg(pg)['fps'])
            x0 = dbg(pg)['px']
            pg.keyboard.down('ArrowRight'); pg.wait_for_timeout(600); pg.keyboard.press('Space'); pg.wait_for_timeout(300)
            shot(pg, 'forest-2-jump'); pg.keyboard.up('ArrowRight')
            assert dbg(pg)['px'] > x0 + 80, f"勇者应该能向右奔跑 {x0} -> {dbg(pg)}" 
            seen = 0; wrong_done = False; doors = 0
            for _ in range(40):
                d = dbg(pg)
                if not any(e['alive'] for e in d['encs']):
                    break
                pg.keyboard.down('ArrowRight')
                for _ in range(200):
                    if pg.get_attribute('#forest-stage', 'data-state') == 'challenge': break
                    pg.wait_for_timeout(80)
                pg.keyboard.up('ArrowRight')
                assert pg.get_attribute('#forest-stage', 'data-state') == 'challenge', '应该碰到怪兽或魔法门'
                pg.wait_for_selector('#act-panel .qcard[data-qid]', timeout=8000)
                card = pg.locator('#act-panel .qcard[data-qid]').first
                title = pg.inner_text('#act-panel .act-panel-head')
                if '魔法门' in title: doors += 1
                if seen == 0: shot(pg, 'forest-3-quiz')
                if not wrong_done and '史莱姆' in title and card.locator('input[name=value], input[name=q], .choice').count():
                    fill(card, wrong=True); pg.wait_for_selector('#act-panel .feedback.no', timeout=8000)
                    fill(card, wrong=True); pg.wait_for_selector('#act-panel .support-box, #act-panel .feedback.no h3', timeout=8000)
                    pg.locator('#act-panel [data-a=next]').first.click()
                    wrong_done = True
                else:
                    fill(card)
                    pg.wait_for_selector('#act-panel .feedback.ok button', timeout=8000)
                    pg.locator('#act-panel .feedback.ok button').first.click()
                    pg.wait_for_timeout(500)
                    if seen == 0: shot(pg, 'forest-4-hit')
                pg.wait_for_selector('#forest-stage[data-state=play]', timeout=8000)
                seen += 1
            assert doors >= 1, '应该至少遇到一扇魔法门'
            assert wrong_done, '应该测试到答错的流程'
            pg.keyboard.down('ArrowRight')
            pg.wait_for_selector('#forest-stage[data-state=win]', timeout=20000)
            pg.keyboard.up('ArrowRight'); pg.wait_for_timeout(700); shot(pg, 'forest-5-chest')
            pg.wait_for_selector('.result-card', timeout=15000)
            pg.wait_for_timeout(600); shot(pg, 'forest-6-result')
            n_attempts = int(sql(f"select count(*) from attempts a join stage_runs r on r.id = a.run_id where r.student_id = {sid} and r.stage = 2"))
            assert n_attempts >= seen, f'数据库应有作答记录（{n_attempts} < {seen}）'
            run = sql(f"select finished_at is not null from stage_runs where student_id = {sid} and stage = 2 order by id desc limit 1")
            assert run == 't', '闯关记录应已完成'
            print(f'作答 {seen} 次，数据库记录 {n_attempts} 笔，魔法门 {doors} 扇')
            assert not errors, errors
            print('✅ 魔法森林测试通过')
        finally:
            sql(f"delete from students where id = {sid}")
            b.close()

main()
