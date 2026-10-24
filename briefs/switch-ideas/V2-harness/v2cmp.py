import json,sys
a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2]))
same=0; diffs=[]
for k in sorted(set(a)|set(b)):
    x=a.get(k); y=b.get(k)
    if x==y: same+=1; continue
    if x is None or y is None: diffs.append((k,'missing')); continue
    if x['status']!=y['status']: diffs.append((k,f"status {x['status']} vs {y['status']}")); continue
    bx,by=x['body'],y['body']
    if not isinstance(bx,dict): diffs.append((k,'body')); continue
    fields=[f for f in sorted(set(bx)|set(by)) if bx.get(f)!=by.get(f)]
    detail=''
    if fields==['items']:
        ix,iy=bx['items'],by['items']
        detail=f" n={len(ix)}/{len(iy)} ids_equal={[i['id'] for i in ix]==[i['id'] for i in iy]}"
        for i,(p,q) in enumerate(zip(ix,iy)):
            if p!=q: detail+=f" first@{i} keys={[f for f in set(p)|set(q) if p.get(f)!=q.get(f)]}"; break
    if 'groups' in fields: detail+=f" groups {bx.get('groups')} -> {by.get('groups')}"
    diffs.append((k,'fields '+','.join(fields)+detail))
print(f"identical {same}/{len(set(a)|set(b))}")
for d in diffs: print(' DIFF',*d)
