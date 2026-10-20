import re, html, json, sys, pathlib
import opencc
cc = opencc.OpenCC('t2s')
src = pathlib.Path(sys.argv[1])
ncx = (src/'OEBPS/toc.ncx').read_text('utf8')
pairs = re.findall(r'<text>([^<]*)</text>\s*</navLabel>\s*<content src="([^"#]*)', ncx)
want = sys.argv[2].split(',')
out = {}
for title, f in pairs:
    for w in want:
        if title.endswith(w) and w not in out:
            t = (src/'OEBPS'/f).read_text('utf8')
            body = re.search(r'<h2>.*?</h2>(.*?)<p class="translation"', t, re.S)
            body = body.group(1) if body else ''
            body = re.sub(r'<span class="zhu">.*?</span>', '', body, flags=re.S)
            body = html.unescape(re.sub(r'<[^>]+>', '', body))
            body = re.sub(r'\s+', '', body)
            author = html.unescape(re.sub(r'<[^>]+>','',re.search(r'<h2>(.*?)</h2>', t, re.S).group(1)))
            out[w] = {'trad': body, 'simp': cc.convert(body), 'author': author, 'file': f}
json.dump(out, open(sys.argv[3], 'w'), ensure_ascii=False, indent=1)
print(len(out), [w for w in want if w not in out])
