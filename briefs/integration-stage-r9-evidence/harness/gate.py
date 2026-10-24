import json, subprocess, sys, time, os
# usage: gate.py <name> <logfile> -- cmd...
name, log = sys.argv[1], sys.argv[2]
cmd = sys.argv[sys.argv.index('--')+1:]
env = {k: v for k, v in os.environ.items() if k not in ('CLAUDECODE', 'AGENT', 'REPL_ID')}
env['TMPDIR'] = os.path.join(os.getcwd(), '.tmp')
t = time.time()
with open(log, 'w') as f:
    rc = subprocess.call(cmd, stdout=f, stderr=subprocess.STDOUT, env=env)
d = round(time.time() - t, 3)
with open('.tmp/gates.jsonl', 'a') as g:
    g.write(json.dumps({"name": name, "command": cmd, "exit_code": rc, "duration_seconds": d, "env_unset": ["CLAUDECODE", "AGENT", "REPL_ID"]}) + "\n")
with open(log + '.rc', 'w') as f:
    f.write(f"rc={rc} duration={d}\n")
sys.exit(rc)
