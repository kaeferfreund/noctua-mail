import sys,os,json,subprocess,time,pathlib,base64
name=sys.argv[1];cmd=['nice','-n','15',*sys.argv[2:]]
env=os.environ.copy();env['TMPDIR']=str(pathlib.Path('.tmp').resolve());env.setdefault('NOCTUA_DATA_DIR',str(pathlib.Path('.tmp/gate-data').resolve()));env.setdefault('PLAYWRIGHT_HOST_PLATFORM_OVERRIDE','ubuntu24.04-arm64')
env.setdefault('BETTER_AUTH_SECRET','synthetic-integration-gate-secret-0123456789abcdef');env.setdefault('IMAP_SECRET_KEY',base64.b64encode(bytes([6])*32).decode());env.setdefault('BETTER_AUTH_URL','http://localhost:3799');env.setdefault('PASSKEY_RP_ID','localhost')
start=time.monotonic()
with open('.tmp/'+name+'.log','w') as f:
 p=subprocess.Popen(cmd,stdout=f,stderr=subprocess.STDOUT,env=env);rc=p.wait()
r={'name':name,'command':cmd,'exit_code':rc,'duration_seconds':round(time.monotonic()-start,3)}
with open('.tmp/gates.jsonl','a') as f:f.write(json.dumps(r)+'\n')
print(json.dumps(r));print(pathlib.Path('.tmp/'+name+'.log').read_text()[-4500:]);sys.exit(rc)
