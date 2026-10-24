import json,collections,os,sys
def load(p,root):
  out=[]
  for r in json.load(open(p)):
    f=os.path.relpath(r['filePath'],root)
    for m in r['messages']: out.append((f,m.get('ruleId'),m['severity'],m['message'].split('\n')[0]))
  return out
base=load('.tmp/lint-base.json',os.path.abspath('.tmp/lint-base')); head=load('.tmp/lint-head.json',os.getcwd())
cb,ch=collections.Counter(base),collections.Counter(head)
new=ch-cb; gone=cb-ch
res={'base_4547815':{'errors':sum(1 for x in base if x[2]==2),'warnings':sum(1 for x in base if x[2]==1)},
     'head':{'errors':sum(1 for x in head if x[2]==2),'warnings':sum(1 for x in head if x[2]==1)},
     'new_vs_base':sorted(new.elements()),'gone_vs_base':sorted(gone.elements())}
json.dump(res,open('.tmp/lint-comparison-r9.json','w'),indent=1)
print(json.dumps({k:v for k,v in res.items() if not k.endswith('base') or True},indent=1)[:6000])
