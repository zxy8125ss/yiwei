# 交互逐个点一遍：读完→复习安排→自测打分→复习页→导出
from playwright.sync_api import sync_playwright
import sys; B=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8765/'; errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},service_workers='block'); pg=ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(B+'#/t/loushiming/intro'); pg.wait_for_timeout(500)
    pg.click('[data-go="text"]'); pg.wait_for_timeout(200)
    assert pg.is_visible('#wen'), '导读→原文失败'
    pg.click('[data-s="0.2"]'); assert pg.is_visible('.note'), '点句子没出注释'
    pg.click('[data-s="0.2"]'); assert not pg.is_visible('.note'), '再点没收起'
    pg.click('#tPy'); assert 'nopy' in pg.get_attribute('#wen','class'), '注音开关无效'
    pg.click('#tY'); assert pg.is_visible('.para-y'), '全文译文无效'
    pg.click('#fsP'); 
    pg.click('#doneBtn'); pg.wait_for_timeout(300)
    st=pg.evaluate("JSON.parse(localStorage.getItem('yw.state.v1'))")
    assert st['texts']['loushiming']['box']==0 and st['texts']['loushiming']['due'], st
    # 模拟到期
    pg.evaluate("s=JSON.parse(localStorage.getItem('yw.state.v1'));s.texts.loushiming.due='2026-01-01';localStorage.setItem('yw.state.v1',JSON.stringify(s))")
    pg.goto(B+'#/'); pg.reload(); pg.wait_for_timeout(500)
    assert pg.inner_text('.tabbar .dot')=='1', '复习角标不对'
    pg.click('.tabbar a[href="#/review"]'); pg.wait_for_timeout(300)
    pg.click('#rgo'); pg.wait_for_timeout(200)
    n=0
    while pg.is_visible('#showB'):
        pg.click('#showB'); pg.click('[data-v="1"]'); n+=1; pg.wait_for_timeout(50)
    txt=pg.inner_text('.result'); assert '100%' in txt, txt
    st=pg.evaluate("JSON.parse(localStorage.getItem('yw.state.v1'))")['texts']['loushiming']
    assert st['box']==1, st
    print('自测题数', n, '|', txt.replace('\n',' / '))
    pg.goto(B+'#/me'); pg.wait_for_timeout(300)
    with pg.expect_download() as d: pg.click('#exp')
    print('导出文件', d.value.suggested_filename)
    pg.goto(B+'#/xuci/%E8%80%8C'); pg.wait_for_timeout(300); assert pg.is_visible('.xsense')
    b.close()
print('\n'.join(errs) or '交互全部通过')
