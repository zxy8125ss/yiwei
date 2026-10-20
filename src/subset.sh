#!/bin/sh
# 按 App 实际用到的字生成衬线字体子集
set -e
R=/home/claude/yiwei; F=/home/claude/yiwei-work/fonts/package
python3 -I -c "
import sys,re
s=''.join(open(f,encoding='utf8').read() for f in sys.argv[1:])
cs=sorted(set(c for c in s if ord(c)>127))
open('/home/claude/yiwei-work/chars.txt','w',encoding='utf8').write(''.join(cs)+'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz %().,:;!?-+/')
print(len(cs),'chars')" $R/data/texts.json $R/data/catalog.json $R/app.js
for w in 400Regular:400 600SemiBold:600; do
  src=${w%%:*}; out=${w##*:}
  pyftsubset $F/$src/NotoSerifSC_$src.ttf --text-file=/home/claude/yiwei-work/chars.txt --flavor=woff2 --layout-features='*' --output-file=$R/fonts/serif-$out.woff2
done
ls -la $R/fonts
