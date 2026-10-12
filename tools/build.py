# python3 tools/build.py  ->  public/index.html (one self-contained file: shell + engine + ui). Works offline for local play too.
import os
r=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..');rd=lambda p:open(os.path.join(r,p),encoding='utf-8').read()
s=rd('src/shell.html').replace('/*ENGINE*/',rd('src/engine.js')).replace('/*UI*/',rd('src/ui.js'))
open(os.path.join(r,'public','index.html'),'w',encoding='utf-8').write(s);print('built public/index.html',len(s),'bytes')
