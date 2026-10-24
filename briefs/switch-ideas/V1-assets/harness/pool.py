import json,glob,re,statistics as st,sys
def pct(xs,p):
    xs=sorted(xs)
    if not xs: return float('nan')
    k=(len(xs)-1)*p/100; f=int(k); c=min(f+1,len(xs)-1); return xs[f]+(xs[c]-xs[f])*(k-f)
data={}; loads={}
for f in sorted(glob.glob('results/r*-warm.json')):
    m=re.match(r'results/r\d-(\w+)-warm\.json',f); v=m.group(1)
    r=json.load(open(f)); loads.setdefault(v,[]).append((f.split('/')[1][:-5], r['uptimeBefore'].split('average:')[1].split(',')[0].strip(), r['uptimeAfter'].split('average:')[1].split(',')[0].strip()))
    for run in r['runs']:
        if run['mode']=='warm-first': continue
        data.setdefault(f"{run['from']}->{run['to']}",{}).setdefault(v,[]).append(run)
print("loads (1-min before -> after):"); [print(' ',v,l) for v,l in loads.items()]
hdr=f"| pair | variant | n | feedback p50/p90 | highlight p50/p90 | first rows p50/p90 | settled p50/p90 | long tasks p50 |"
print(hdr); print("|"+"---|"*8)
order=['small->folders','large->folders','folders->small','small->large','folders->large','large->small']
for k in order:
    for v in ['base','L','M','head']:
        rs=data.get(k,{}).get(v,[])
        if not rs: continue
        g=lambda key:[r['marks'][key] for r in rs if r['marks'].get(key) is not None]
        fb,hl,fr=g('feedback'),g('highlight'),g('firstRows'); se=[r['settledMs'] for r in rs]
        lt=st.median(r['longTasks']['totalMs'] for r in rs)
        to=sum(1 for r in rs if r['timedOut'])
        f=lambda xs: f"{st.median(xs):.0f} / {pct(xs,90):.0f}" if xs else "–"
        print(f"| {k} | {v} | {len(rs)} | {f(fb)} | {f(hl)} | {f(fr)} | {f(se)} | {lt:.0f} |" + (f" timeouts={to}" if to else ""))
