# 用模拟的 GitHub 接口测：开启 → 自动上传 → 清空本机（相当于删图标重加）→ 再开启 → 记录找回
import json, sys
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
gists = {}
H = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS'}
def api(route):
    try: _api(route)
    except Exception as e:
        print('mock error', route.request.method, route.request.url, e); route.fulfill(status=500, headers=H, body='')
def _api(route):
    req = route.request; url = req.url; m = req.method
    if m == 'OPTIONS': return route.fulfill(status=204, headers=H)
    if '/user' in url and '/gists' not in url: return route.fulfill(headers=H, json={'login': 'zxy8125ss'})
    if url.split('?')[0].endswith('/gists') and m == 'GET':
        return route.fulfill(headers=H, json=[{'id': k, 'description': v['description'], 'files': {f: {} for f in v['files']}} for k, v in gists.items()])
    if url.endswith('/gists') and m == 'POST':
        d = json.loads(req.post_data); gid = f'g{len(gists)+1}'; gists[gid] = {'description': d['description'], 'files': {k: v['content'] for k, v in d['files'].items()}}
        return route.fulfill(headers=H, json={'id': gid})
    gid = url.split('/gists/')[1].split('?')[0]
    if m == 'PATCH':
        d = json.loads(req.post_data)
        for k, v in d['files'].items(): gists[gid]['files'][k] = v['content']
        return route.fulfill(headers=H, json={'id': gid})
    return route.fulfill(headers=H, json={'files': {k: {'content': v, 'truncated': False} for k, v in gists[gid]['files'].items()}})
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
    ctx.route('https://api.github.com/**', api)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('requestfailed', lambda r: print('FAILED', r.method, r.url, r.failure))
    pg.goto(B + '#/t/shishuo/text'); pg.wait_for_timeout(500); pg.click('#doneBtn'); pg.wait_for_timeout(200)
    pg.goto(B + '#/'); pg.wait_for_timeout(400)
    assert '开启自动备份' in pg.inner_text('main'), '首页没有备份提醒'
    pg.goto(B + '#/me'); pg.wait_for_timeout(400)
    pg.fill('#cKey', 'ghp_test'); pg.click('#cGo'); pg.wait_for_timeout(800)
    assert len(gists) == 1, gists
    st = json.loads(list(gists.values())[0]['files']['yiwei-backup.json'])['state']
    assert 'shishuo' in st['texts'], st
    assert 'ghp_test' not in json.dumps(gists), '密钥被上传了'
    # 再读一篇，3 秒内自动上传
    pg.goto(B + '#/t/loushiming/text'); pg.wait_for_timeout(400); pg.click('#doneBtn'); pg.wait_for_timeout(3800)
    st = json.loads(list(gists.values())[0]['files']['yiwei-backup.json'])['state']
    assert 'loushiming' in st['texts'], '没有自动上传'
    # 模拟删图标重加：清空本机
    pg.close(); ctx.close()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block'); ctx.route('https://api.github.com/**', api)
    pg = ctx.new_page(); pg.goto(B + '#/me'); pg.wait_for_timeout(500)
    assert pg.is_visible('#cKey')
    pg.fill('#cKey', 'ghp_test'); pg.click('#cGo'); pg.wait_for_timeout(800)
    assert len(gists) == 1, '重复建了备份'
    s = pg.evaluate("JSON.parse(localStorage.getItem('yw.state.v1'))")
    assert 'shishuo' in s['texts'] and 'loushiming' in s['texts'], s
    pg.goto(B + '#/'); pg.wait_for_timeout(400)
    assert '开启自动备份' not in pg.inner_text('main')
    pg.goto(B + '#/me'); pg.wait_for_timeout(400); pg.screenshot(path='/home/claude/yiwei-work/shots/me-cloud.png', full_page=True)
    b.close()
print('\n'.join(errs) or '自动备份：开启、自动上传、清空后找回 全部通过')
