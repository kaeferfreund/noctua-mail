import subprocess,json,pathlib,time,sys
start=time.monotonic()
while time.monotonic()-start<3600:
 records=[json.loads(x) for x in pathlib.Path('.tmp/gates.jsonl').read_text().splitlines()]
 build=next((r for r in records if r['name']=='build'),None)
 if build:
  if build['exit_code']:sys.exit(build['exit_code'])
  break
 stress=next((r for r in records if r['name']=='stress'),None)
 if stress and stress['exit_code']:sys.exit(stress['exit_code'])
 time.sleep(1)
else:raise RuntimeError('Build was not reached within validation budget')
for name,cmd in [('lint-baseline-comparison',['node','.tmp/lint-compare.mjs']),('typecheck-final',['bun','run','typecheck']),('integration-files-lint',['bun','x','eslint','scripts/runQaShellBrowserTests.ts','app/components/mailclient/useMessageMutations.dom.test.tsx','app/components/shell/SettingsFrame.breakpoint.dom.test.tsx']),('bundle-after',['node','.tmp/bundle.mjs',subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'after'])]:
 rc=subprocess.run(['python3','.tmp/gate.py',name,*cmd]).returncode
 if rc:sys.exit(rc)
sys.exit(subprocess.run(['python3','.tmp/prod-gates.py']).returncode)
