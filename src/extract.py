"""从开源 guwenguanzhi 电子书里抽出正文（去掉吴氏夹注），繁转简存 source.json。
用法：python3 -I extract.py <电子书目录> <篇名,篇名…> <输出json>"""
import re, json, sys, pathlib
from html.parser import HTMLParser
import opencc
cc = opencc.OpenCC('t2s')

class Body(HTMLParser):
    """收集 <p class="calibre5"> 里的文字，跳过 span.zhu（可能嵌套）"""
    def __init__(self):
        super().__init__(); self.out = []; self.inp = False; self.skip = 0; self.stack = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'p' and a.get('class') == 'calibre5': self.inp = True
        if self.inp and tag == 'span':
            z = a.get('class') == 'zhu'
            self.stack.append(z)
            if z: self.skip += 1
    def handle_endtag(self, tag):
        if tag == 'p': self.inp = False
        if self.inp and tag == 'span' and self.stack:
            if self.stack.pop(): self.skip -= 1
    def handle_data(self, d):
        if self.inp and not self.skip: self.out.append(d)

src = pathlib.Path(sys.argv[1])
ncx = (src / 'OEBPS/toc.ncx').read_text('utf8')
pairs = re.findall(r'<text>([^<]*)</text>\s*</navLabel>\s*<content src="([^"#]*)', ncx)
want = sys.argv[2].split(',')
out = {}
for title, f in pairs:
    for w in want:
        if title.endswith(w) and w not in out:
            t = (src / 'OEBPS' / f).read_text('utf8')
            p = Body(); p.feed(t)
            body = re.sub(r'\s+', '', ''.join(p.out))
            author = re.sub(r'<[^>]+>', '', re.search(r'<h2>(.*?)</h2>', t, re.S).group(1))
            out[w] = {'trad': body, 'simp': cc.convert(body), 'author': author, 'file': f}
json.dump(out, open(sys.argv[3], 'w'), ensure_ascii=False, indent=1)
print(len(out), [w for w in want if w not in out])
