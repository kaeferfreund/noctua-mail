import subprocess,sys,json,pathlib,shutil
stages=[
 ('bundle-after',['node','.tmp/bundle.mjs',__import__('subprocess').check_output(['git','rev-parse','HEAD'],text=True).strip(),'after']),
 ('standalone-packages',['bun','.tmp/standalone-check.ts']),
 ('standalone-workers',['bun','build-scripts/verifyStandaloneWorkerBuild.ts']),
 ('auth-browser',['env','AUTH_BROWSER_USE_BUILD=1','AUTH_BROWSER_PORT=3799','bun','run','test:auth-browser']),
 ('html-privacy',['bun','test','--config=bunfig.browser.toml','--timeout','120000','./tests/browser/htmlPrivacy.test.ts']),
 ('qa-all',['python3','.tmp/qa-all-r9.py']),
 ('smoke',['env','AUTH_SMOKE_PORT=3799','bun','scripts/smokeTeamAuth.ts']),
 ('security',['bash','tests/runTeamAuthSecurityControls.sh']),

 ('migration',['bun','.tmp/migration-gate.ts']),
 ('shutdown-idle',['env','BETTER_AUTH_URL=http://127.0.0.1:3799','PASSKEY_RP_ID=127.0.0.1','BETTER_AUTH_SECRET=synthetic-shutdown-idle-secret-0123456789','NOCTUA_MAILBOX_WATCHER=','bun','scripts/checkGracefulShutdown.ts','--port','3799','--data-dir',str(pathlib.Path('.tmp/shutdown-idle-data').resolve())]),
 ('shutdown-watcher',['bun','.tmp/watcher-shutdown.ts']),
 ('i18n-standalone',['bun','.tmp/locale-gate.ts']),
 ('german320',['env','QA_SHELL_USE_BUILD=1','QA_SHELL_PORT=3799','NOCTUA_MAILBOX_WATCHER=1','QA_ROUND2_FIXTURE=1','bun','.tmp/qa-standalone.ts','--config=.tmp/german320.config.ts']),
]
failed=[]
start=sys.argv[1] if len(sys.argv)>1 else stages[0][0];active=False
for name,cmd in stages:
 if name==start:active=True
 if not active:continue
 result=subprocess.run(['python3','.tmp/gate.py',name,*cmd])
 if result.returncode:failed.append(name);print('GATE_FAILED',name,flush=True)
print('PROD_GATES_DONE failed=',failed,flush=True);sys.exit(1 if failed else 0)
