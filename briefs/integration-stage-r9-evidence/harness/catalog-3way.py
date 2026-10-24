import json,subprocess,sys,pathlib
base,ours,theirs=sys.argv[1:4]
get=lambda r,p: subprocess.check_output(['git','show',r+':'+p],text=True)
def hook(pairs):
  ks=[k for k,_ in pairs]; assert len(ks)==len(set(ks)),('dup',ks); return dict(pairs)
def leaves(d,pre=()):
  for k,v in d.items():
    if isinstance(v,dict): yield from leaves(v,pre+(k,))
    else: yield pre+(k,),v
def setp(d,path,v):
  for k in path[:-1]: d=d.setdefault(k,{})
  d[path[-1]]=v
def delp(d,path):
  stack=[]
  for k in path[:-1]: stack.append((d,k)); d=d[k]
  del d[path[-1]]
  for parent,k in reversed(stack):
    if not parent[k]: del parent[k]
for loc in ['de','en']:
  p=f'messages/{loc}.json'
  B,O,T=[json.loads(get(r,p),object_pairs_hook=hook) for r in (base,ours,theirs)]
  lb,lo,lt=dict(leaves(B)),dict(leaves(O)),dict(leaves(T))
  m=json.loads(json.dumps(O)); added=changed=removed=0; conflicts=[]
  # union structure: insert theirs-only keys preserving theirs order inside existing objects
  def union(x,y):
    for k,v in y.items():
      if k not in x: x[k]=json.loads(json.dumps(v))
      elif isinstance(x[k],dict) and isinstance(v,dict): union(x[k],v)
  for path,v in lt.items():
    if path in lo:
      if v!=lo[path]:
        if path in lb and lb[path]==lo[path]: setp(m,path,v); changed+=1
        elif path in lb and lb[path]==v: pass
        else: conflicts.append(('.'.join(path),lo[path],v))
    elif path not in lb: added+=1
  union(m,T)
  for path in lb:
    if path not in lt and path in lo and lo[path]==lb[path]: delp(m,path); removed+=1
  lm=dict(leaves(m))
  print(loc,'base',len(lb),'ours',len(lo),'theirs',len(lt),'added',added,'theirs-changed',changed,'removed',removed,'merged',len(lm),'conflicts',conflicts)
  pathlib.Path(p).write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
  json.loads(pathlib.Path(p).read_text(),object_pairs_hook=hook)
