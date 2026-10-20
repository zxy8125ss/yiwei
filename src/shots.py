import sys, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
OUT = '/home/claude/yiwei-work/shots/'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ('light', 'dark'):
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, color_scheme=scheme, service_workers='block')
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        def shot(h, name, act=None, full=True):
            pg.goto(BASE + h); pg.wait_for_timeout(600)
            if act: act(); pg.wait_for_timeout(300)
            w = pg.evaluate('document.documentElement.scrollWidth')
            if w > 390: errs.append(f'{name}: 横向溢出 {w}px')
            pg.screenshot(path=f'{OUT}{scheme}-{name}.png', full_page=full)
        shot('#/', 'home')
        shot('#/t/shishuo/intro', 'intro')
        shot('#/t/shishuo/text', 'text', lambda: pg.click('[data-s="0.1"]'))
        shot('#/t/shishuo/words', 'words')
        def quiz():
            pg.click('#qGo'); pg.wait_for_timeout(200); pg.click('#hintB'); pg.click('#showB')
        shot('#/t/shishuo/test', 'test', quiz, full=False)
        shot('#/zt/mingju', 'zt'); shot('#/zt/duoyi', 'duoyi'); shot('#/zt/tongjia', 'tongjia'); shot('#/t/chushibiao/text', 'text2'); shot('#/t/baorenan/text', 'text3'); shot('#/t/tengwanggexu/words', 'words2'); shot('#/zt/chengyu', 'chengyu')
        shot('#/me', 'me')
        ctx.close()
    b.close()
print('\n'.join(errs) or '无报错、无横向溢出')
