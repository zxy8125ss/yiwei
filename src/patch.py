"""对精讲稿做批量替换：python3 -I src/patch.py 文件 规则.json
规则里英文引号会按中文引号成对转换后再匹配。"""
import json, sys
def q(s):
    out, i = [], 0
    for ch in s:
        if ch == '"': out.append('“' if i % 2 == 0 else '”'); i += 1
        else: out.append(ch)
    return ''.join(out)
p = sys.argv[1]; s = open(p, encoding='utf8').read()
bad = []
for a, b in json.load(open(sys.argv[2], encoding='utf8')):
    a2, b2 = q(a), q(b)
    if a2 in s: s = s.replace(a2, b2)
    elif a in s: s = s.replace(a, b2)
    else: bad.append(a[:30])
open(p, 'w', encoding='utf8').write(s)
print('未匹配：', bad) if bad else print('全部替换')
