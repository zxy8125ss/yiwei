import re,sys,pathlib
for f in sys.argv[1:]:
    p=pathlib.Path(f); out=[]
    for line in p.read_text('utf8').splitlines():
        n=0
        def rep(m):
            global n
        chars=[];i=0
        for ch in line:
            if ch=='"':
                chars.append('“' if i%2==0 else '”'); i+=1
            else: chars.append(ch)
        out.append(''.join(chars))
    p.write_text('\n'.join(out)+'\n','utf8')
