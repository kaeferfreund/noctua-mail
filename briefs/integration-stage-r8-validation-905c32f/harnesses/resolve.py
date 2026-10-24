import subprocess,json,pathlib,re
get=lambda ref,p: subprocess.check_output(['git','show',ref+':'+p],text=True)
for loc in ['de','en']:
 p=f'messages/{loc}.json'; a=json.loads(get('HEAD',p)); b=json.loads(get('46d629e',p))
 def union(a,b):
  for k,v in b.items():
   if k not in a:a[k]=v
   elif isinstance(a[k],dict) and isinstance(v,dict):union(a[k],v)
  return a
 pathlib.Path(p).write_text(json.dumps(union(a,b),ensure_ascii=False,indent=2)+'\n')
# Preserve our complete translated chunks, then add incoming stable attributes.
for p in ['app/components/shell/Shell.dom.test.tsx','app/components/shell/ShellHeader.tsx','app/components/shell/ShellSidebar.tsx']:
 s=pathlib.Path(p).read_text();s=re.sub(r'<<<<<<< HEAD\n(.*?)=======\n.*?>>>>>>> [^\n]+\n',lambda m:m[1],s,flags=re.S)
 if p.endswith('ShellHeader.tsx'):s=s.replace('aria-label={t("sidebar.toggle")} />','aria-label={t("sidebar.toggle")} data-shell-action="toggle-sidebar" />')
 if p.endswith('ShellSidebar.tsx'):s=s.replace('aria-label={t("compose.new")}>','aria-label={t("compose.new")} data-shell-action="compose">')
 pathlib.Path(p).write_text(s)
p=pathlib.Path('app/components/mailclient/useMessageMutations.ts');s=p.read_text();s=re.sub(r'<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> [^\n]+\n',lambda m:m[1]+m[2].replace('import { useCallback } from "react";\n',''),s,flags=re.S);p.write_text(s)
p='lib/i18n/catalogs.test.ts';s=get('46d629e',p);ours=get('HEAD',p);walker=ours[ours.index('function leaves'):ours.index('\ndescribe(')];s=s[:s.index('function flatten')]+walker+s[s.index('\ndescribe('):];s=s.replace('flatten(', 'leaves(');s=s.replace('test }','test, it }');s=s.replace('import { catalogs,','import de from "@/messages/de.json";\nimport en from "@/messages/en.json";\nimport { catalogs,');s += '\n'+ours[ours.index('describe('):];pathlib.Path(p).write_text(s)
