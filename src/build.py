"""把 content/*.txt（精讲稿）编译成 App 数据 data/texts.json，并与开源底本逐字比对。
用法：python3 -I build.py <输出目录>
"""
import json, re, sys, pathlib, unicodedata

HERE = pathlib.Path(__file__).parent
SRC = json.loads((HERE / 'source.json').read_text('utf8'))
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / 'out'

# 底本（吴氏原本经繁转简）与现代通行写法的异体对照：底本字 -> 通行字
VARIANTS = {
    '堦': '阶', '髣髴': '仿佛', '著': '着', '𠫤': '吝', '祇': '只', '檝': '楫', '沈': '沉',
    '諠': '喧', '懽': '欢', '䫉': '貌', '朞': '期', '俛': '俯', '袆': '祎', '瑯琊': '琅琊',
    '邪': '耶', '欤': '欤',
}
PUNCT = re.compile(r'[，。、；：？！“”‘’「」『』（）《》—…·\s]')

def plain(s):
    """去掉注音标记与标点，得到纯正文"""
    s = re.sub(r'\{([^:{}]+):[^{}]*\}', r'\1', s)
    return PUNCT.sub('', s)

def norm(s, allow=()):
    s = PUNCT.sub('', s)
    for a, b in VARIANTS.items():
        s = s.replace(a, b)
    for a, b in allow:
        s = s.replace(a, b)
    return s

def ruby(s):
    """{字:拼音:通×} -> 结构化片段列表"""
    parts, pos = [], 0
    for m in re.finditer(r'\{([^:{}]+):([^:{}]*)(?::([^{}]*))?\}', s):
        if m.start() > pos:
            parts.append(s[pos:m.start()])
        seg = {'c': m.group(1)}
        if m.group(2): seg['py'] = m.group(2)
        if m.group(3): seg['tj'] = m.group(3)
        parts.append(seg)
        pos = m.end()
    if pos < len(s):
        parts.append(s[pos:])
    return parts

def parse(path):
    meta, paras, words, cur, sent = {}, [], [], None, None
    idioms = []
    allow = []
    for raw in path.read_text('utf8').splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        if line.startswith('@word '):
            w, ex, d, t = [x.strip() for x in line[6:].split('|')]
            words.append({'w': w, 'ex': ex, 'd': d, 't': t})
        elif line.startswith('@idiom '):
            w, ex, d = [x.strip() for x in line[7:].split('|')]
            idioms.append({'w': w, 'ex': ex, 'd': d})
        elif line.startswith('@allow '):  # 允许的异文：底本字=本稿字
            a, b = line[7:].split('=')
            allow.append((a.strip(), b.strip()))
        elif line.startswith('@'):
            k, _, v = line[1:].partition(' ')
            meta[k] = v.strip()
        elif line.startswith('#p'):
            cur = []
            paras.append(cur)
        elif line.startswith('='):
            star = line.startswith('=*')
            text = line[2:].strip()
            sent = {'t': ruby(text), 'n': [], 'y': ''}
            if star: sent['m'] = 1
            cur.append(sent)
        elif line.startswith('~'):
            for item in line[1:].split('|'):
                item = item.strip()
                if not item: continue
                k, _, d = item.partition('：')
                sent['n'].append({'w': k.strip(), 'd': d.strip()})
        elif line.startswith('>'):
            sent['y'] = line[1:].strip()
        else:
            raise SystemExit(f'{path.name}: 看不懂这一行：{line}')
    return meta, paras, words, allow, idioms

def diff(a, b):
    """返回第一处不同的位置附近片段"""
    for i, (x, y) in enumerate(zip(a, b)):
        if x != y:
            return i, a[max(0, i-8):i+8], b[max(0, i-8):i+8]
    if len(a) != len(b):
        i = min(len(a), len(b))
        return i, a[max(0, i-8):i+8], b[max(0, i-8):i+8]
    return None

def main():
    texts, problems = [], []
    for f in sorted((HERE / 'content').glob('*.txt')):
        meta, paras, words, allow, idioms = parse(f)
        body = ''.join(plain(''.join(p if isinstance(p, str) else p['c'] for p in s['t'])) for p in paras for s in p)
        src = norm(SRC[meta['src']]['simp'], allow)
        mine = norm(body, ())
        import difflib
        for op, a1, a2, b1, b2 in difflib.SequenceMatcher(None, src, mine, autojunk=False).get_opcodes():
            if op != 'equal':
                problems.append(f"{meta['title']}：{op} 底本「{src[max(0,a1-4):a2+4]}」 本稿「{mine[max(0,b1-4):b2+4]}」")
        for s in (s for p in paras for s in p):
            if not s['y']: problems.append(f"{meta['title']}：缺译文 {plain(str(s['t']))[:10]}")
        for w in idioms:
            if plain(w['ex']).replace(' ', '') not in body:
                problems.append(f"{meta['title']}：成语出处句不在原文中：{w['ex']}")
        for w in words:
            if plain(w['ex']).replace(' ', '') not in body:
                problems.append(f"{meta['title']}：字词卡例句不在原文中：{w['ex']}")
        intro = {k[6:]: v for k, v in meta.items() if k.startswith('intro.')}
        if 'flow' in intro: intro['flow'] = [x.strip() for x in intro['flow'].split('|')]
        listen = []
        for k, v in meta.items():
            if k.startswith('listen'):
                url, _, label = v.partition('|')
                listen.append({'url': url.strip(), 'label': label.strip()})
        texts.append({
            'id': meta['id'], 'title': meta['title'], 'author': meta['author'], 'dynasty': meta['dynasty'],
            'stage': int(meta['stage']), 'juan': meta['juan'], 'genre': meta.get('genre', ''),
            'chars': len(body), 'intro': intro, 'paras': paras, 'words': words, 'idioms': idioms, 'listen': listen,
        })
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'texts.json').write_text(json.dumps(texts, ensure_ascii=False, separators=(',', ':')), 'utf8')
    print(f'共 {len(texts)} 篇，' + ('全部与底本一致' if not problems else f'{len(problems)} 处待查：'))
    for p in problems: print('  ', p)

main()
