from pathlib import Path
p=Path('scripts/menu-v030.py')
s=p.read_text()
for old,new in [
    ('replace_between(s,start,end,menu+end,p)','replace_between(s,start,end,menu,p)'),
    ('replace_between(s,start,end,pause+end,p)','replace_between(s,start,end,pause,p)'),
    ('replace_between(s,start,end,settings+end,p)','replace_between(s,start,end,settings,p)'),
    ('replace_between(s,start,end,new_set+end,p)','replace_between(s,start,end,new_set,p)'),
    ('replace_between(s,start,end,new_bind+end,p)','replace_between(s,start,end,new_bind,p)'),
    ('replace_between(s,start,end,new_helpers+end,p)','replace_between(s,start,end,new_helpers,p)'),
]:
    if old not in s: raise SystemExit(f'missing generator marker: {old}')
    s=s.replace(old,new,1)
bad='''s=s.replace("${resourceLabels[kind]}${depleted?' · DEPLETED':''}","${resourceLabels[kind]}${depleted?` · ${this.tx('depleted')}`:''}",1)'''
good='''s=s.replace("${resourceLabels[kind]}${depleted?' · DEPLETED':''}","${resourceLabels[kind]}${depleted?' · '+this.tx('depleted'):''}",1)'''
if bad not in s: raise SystemExit('missing depleted translation generator marker')
s=s.replace(bad,good,1)
p.write_text(s)
print('v0.3.0 patch generator repaired')
