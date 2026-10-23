"""Summarize one or more load result dirs.  Usage: python3 summarize.py OUTDIR [OUTDIR...]"""
import json,pathlib,statistics,sys
def stats(v):
  if not v: return {'n':0}
  v=sorted(v)
  return {'n':len(v),'p50':round(statistics.median(v),3),'p95':round(v[int((len(v)-1)*.95)],3),'p99':round(v[int((len(v)-1)*.99)],3),'max':round(v[-1],3),'total':round(sum(v),3)}
result={}
for arg in sys.argv[1:]:
  p=pathlib.Path(arg); d=json.loads((p/'main.json').read_text())
  d['draftLatencyMs']=stats(d.pop('latencies'))
  e=d.pop('endpoints')
  d['endpoints']={'me':{**stats(e['me']['ms']),'statuses':e['me']['statuses'],'errors':e['me']['errors']},
    'summary':{**stats(e['summary']['ms']),'statuses':e['summary']['statuses'],'errors':e['summary']['errors']},
    'sseScopedRead':{**stats(e['sse']['scopedMs']),'events':e['sse']['events'],'closed':e['sse']['closed']}}
  d['auth']=json.loads((p/'child-0.json').read_text())
  d['syncLoops']=[json.loads(f.read_text()) for f in sorted(p.glob('child-[12].json'))]
  for w in d['syncLoops']: w['errors']=len(w['errors'])
  spans={}
  for f in (p/'metrics').glob('*.json'):
    for k,v in json.loads(f.read_text())['spans'].items(): spans.setdefault(k,[]).extend(v)
  d['timings']={k:stats(v) for k,v in sorted(spans.items())}
  d['busyRetries']=sum(len(v) for k,v in spans.items() if k.startswith('retry.'))
  d['retryExhaustions']=sum(len(v) for k,v in spans.items() if k.startswith('exhausted.'))
  d['errors']=d['errors'][:5]
  result[p.name]=d
print(json.dumps(result,indent=2))
