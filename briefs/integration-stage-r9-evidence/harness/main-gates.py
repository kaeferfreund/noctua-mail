import json,time,pathlib,subprocess,sys,shutil
start=time.monotonic()
while time.monotonic()-start<1800:
 records=[json.loads(x) for x in pathlib.Path('.tmp/gates.jsonl').read_text().splitlines()]
 ci=next((r for r in records if r['name']=='ci'),None)
 if ci:
  if ci['exit_code']:sys.exit(ci['exit_code'])
  break
 time.sleep(1)
else:raise RuntimeError('CI did not finish in its existing budget')
for name,cmd,expected in [('stress',['timeout','2400','bun','run','test:stress'],0),('lint',['timeout','600','bun','run','lint'],1),('build',['timeout','1200','bun','run','build'],0)]:
 if name=='build':shutil.rmtree('.next/standalone',ignore_errors=True)
 result=subprocess.run(['python3','.tmp/gate.py',name,*cmd])
 if result.returncode!=expected:sys.exit(result.returncode or 1)
