import json,glob,re,statistics as st,sys
def pct(xs,p):
    xs=sorted(xs); 
    if not xs: return float('nan')
    k=(len(xs)-1)*p/100; f=int(k); c=min(f+1,len(xs)-1); return xs[f]+(xs[c]-xs[f])*(k-f)
data={}; loads={}
for f in sorted(glob.glob('results/r*-*-*.json')):
    m=re.match(r'results/r\d-(base|head)-(warm|cold)\.json',f); v,kind=m.group(1),m.group(2)
    r=json.load(open(f)); loads.setdefault(v,[]).append((f.split('/')[1][:-5], r['uptimeBefore'].split('average:')[1].split(',')[0].strip(), r['uptimeAfter'].split('average:')[1].split(',')[0].strip()))
    for run in r['runs']:
        if run['mode']=='warm-first': continue
        k=f"{run['mode']}:{run['from']}->{run['to']}"
        data.setdefault(k,{}).setdefault(v,[]).append(run)
print("loads (1-min before -> after):"); [print(' ',v,l) for v,l in loads.items()]
print(f"{'pair':24} {'var':4} {'n':>3} {'highlight p50':>13} {'first rows p50/p90':>19} {'settled p50/p90':>16} {'req':>4} {'me':>3} {'old':>4} {'longtask':>8}")
order=['cold:small->large','cold:large->small','cold:small->folders','warm:large->small','warm:small->large','warm:large->medium','warm:medium->large','warm:folders->small','warm:small->folders','warm:large->folders','warm:folders->large']
for k in order:
    for v in ['base','head']:
        rs=data.get(k,{}).get(v,[])
        if not rs: continue
        hl=[r['marks']['highlight'] for r in rs if r['marks'].get('highlight') is not None]
        fr=[r['marks']['firstRows'] for r in rs if r['marks'].get('firstRows') is not None]
        se=[r['settledMs'] for r in rs]
        req=st.median(len(r['requests']) for r in rs)
        me=st.median(sum(1 for q in r['requests'] if q['url'].startswith('/api/auth/me')) for r in rs)
        old=st.median(sum(1 for q in r['requests'] if q.get('oldAccount')) for r in rs)
        lt=st.median(r['longTasks']['totalMs'] for r in rs)
        to=sum(1 for r in rs if r['timedOut'])
        print(f"{k:24} {v:4} {len(rs):3} {st.median(hl):13.0f} {st.median(fr):9.0f}/{pct(fr,90):<9.0f} {st.median(se):7.0f}/{pct(se,90):<8.0f} {req:4.0f} {me:3.0f} {old:4.0f} {lt:8.0f}" + (f" timeouts={to}" if to else ""))
