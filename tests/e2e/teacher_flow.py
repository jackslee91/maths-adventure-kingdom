"""端到端测试：教师登录、用算式新增题目、布置小测、写评语、下载报告、教学模式。
用法：python3 tests/e2e/teacher_flow.py http://localhost:3000 教师用户名 密码
"""
import sys
from playwright.sync_api import sync_playwright

BASE, USER, PW = sys.argv[1], sys.argv[2], sys.argv[3]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1366, 'height': 900}, accept_downloads=True)
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(BASE + '/#/admin')
    pg.fill('input[name=username]', USER); pg.fill('input[name=password]', PW); pg.click('button[type=submit]')
    pg.wait_for_selector('text=提交记录')
    # 题库：由算式自动建立
    pg.goto(BASE + '/#/admin/bank'); pg.wait_for_selector('text=道题')
    pg.click('#new'); pg.fill('[name=expression]', '4 506 × 12 ÷ 8'); pg.fill('[name=btext]', '每箱有 4 506 粒橡胶种子，12 箱平均分给 8 个园丘。每个园丘分得多少粒？'); pg.fill('[name=bunit]', '粒')
    pg.click('#build'); pg.wait_for_timeout(400)
    assert pg.input_value('[name=a_value]') == '6759', pg.input_value('[name=a_value]')
    pg.click('button:has-text("验算并保存")'); pg.wait_for_selector('text=验算通过')
    # 故意改错答案：应被拒绝
    pg.click('#new'); pg.fill('[name=expression]', '100 + 200 - 50'); pg.click('#build'); pg.wait_for_timeout(300)
    pg.fill('[name=a_value]', '999'); pg.click('button:has-text("验算并保存")')
    pg.wait_for_selector('#err:has-text("没有通过验证")')
    pg.click('.modal button:has-text("取消")')
    # 小测
    pg.goto(BASE + '/#/admin/quizzes'); pg.click('#new'); pg.wait_for_selector('.qk')
    pg.fill('.modal [name=title]', '自动测试小测'); pg.click('#auto5'); pg.click('button:has-text("布置给学生")')
    pg.wait_for_selector('td:has-text("自动测试小测")')
    # 个人报告：写评语、下载 PDF
    pg.goto(BASE + '/#/admin/records'); pg.click('#rec a.btn:has-text("报告") >> nth=0'); pg.wait_for_selector('.comment-edit')
    pg.fill('.comment-edit', '计算细心，继续加油！'); pg.click('#save'); pg.wait_for_selector('text=评语已保存')
    with pg.expect_download() as dl: pg.click('#pdf')
    assert dl.value.suggested_filename.endswith('个人学习报告.pdf'), dl.value.suggested_filename
    # 报告生成中心
    pg.goto(BASE + '/#/admin/reports'); pg.wait_for_selector('.a4')
    pg.fill('.note[data-k=measures]', '每周两次小组辅导'); pg.click('#save-notes'); pg.wait_for_selector('text=已保存')
    for label in ['四年级数学_全班学习分析报告.pdf', '全部报告 ZIP', '导出 Excel（.xlsx）']:
        with pg.expect_download() as dl: pg.click(f'button:has-text("{label}")')
        print('下载：', dl.value.suggested_filename)
    # 教学模式
    pg.goto(BASE + '/#/teach/L5'); pg.click('[data-c=start]'); pg.click('#skip')
    for _ in range(4): pg.click('[data-c=next]')
    assert '都除以 10' in pg.inner_text('.board') or '除以' in pg.inner_text('.board')
    pg.click('[data-c=reveal]'); pg.click('[data-c=again]'); pg.wait_for_timeout(500)
    pg.click('.teach-toc [data-tool=quiz]'); pg.click('[data-plus] >> nth=0'); pg.click('[data-c=reveal]'); pg.wait_for_selector('text=正确答案')
    # 清理测试题目与小测
    pg.goto(BASE + '/#/admin/quizzes'); pg.once('dialog', lambda d: d.accept())
    pg.click('tr:has-text("自动测试小测") [data-del]'); pg.click('.modal button:has-text("确定")')
    print('页面错误：', errors)
    b.close()
    if errors: sys.exit(1)
    print('✅ 教师端流程测试通过')
