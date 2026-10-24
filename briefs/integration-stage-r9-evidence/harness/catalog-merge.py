import json,subprocess,sys,pathlib
ref=sys.argv[1]; expected_diff=json.loads(sys.argv[2]) if len(sys.argv)>2 else {}
get=lambda r,p: subprocess.check_output(['git','show',r+':'+p],text=True)
def pairs_hook(pairs):
  keys=[k for k,_ in pairs]; assert len(keys)==len(set(keys)),('dup',keys); return dict(pairs)
def leaves(d,pre=''):
  for k,v in d.items():
    if isinstance(v,dict): yield from leaves(v,pre+k+'.')
    else: yield pre+k,v
for loc in ['de','en']:
  p=f'messages/{loc}.json'
  a=json.loads(get('HEAD',p),object_pairs_hook=pairs_hook); b=json.loads(get(ref,p),object_pairs_hook=pairs_hook)
  la=dict(leaves(a)); lb=dict(leaves(b))
  added=[k for k in lb if k not in la]; diffs=[k for k in lb if k in la and la[k]!=lb[k]]
  def union(x,y):
    for k,v in y.items():
      if k not in x: x[k]=v
      elif isinstance(x[k],dict) and isinstance(v,dict): union(x[k],v)
      elif isinstance(x[k],dict)!=isinstance(v,dict): raise SystemExit(f'shape conflict {k}')
    return x
  m=union(a,b); lm=dict(leaves(m))
  print(loc,'stage',len(la),'branch',len(lb),'added',len(added),'merged',len(lm),'unequal-shared',[(k,la[k],lb[k]) for k in diffs])
  from collections import Counter
  print(' added-by-prefix',Counter('.'.join(k.split('.')[:2]) if k.split('.')[0] in('Settings','Compose','Errors','Admin') and len(k.split('.'))>2 else k for k in added).most_common())
  pathlib.Path(p).write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
  json.loads(pathlib.Path(p).read_text(),object_pairs_hook=pairs_hook)
