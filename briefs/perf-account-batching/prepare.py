"""Archive one variant of the tree into CHECKOUT/.tmp/<name> and add scratch-only load instrumentation.
Never writes tracked files.  Usage: python3 prepare.py CHECKOUT NAME REV
Adapted from briefs/sender-identities-slice2-regressions-r4/prepare.py: the outboundWrite guard on this tree
wraps BEGIN IMMEDIATE in its own try block, so the acquisition timestamp lives in an outer let."""
import subprocess,pathlib,shutil,sys
probes=pathlib.Path(__file__).resolve().parent
checkout=pathlib.Path(sys.argv[1]).resolve(); name=sys.argv[2]; rev=sys.argv[3]
target=checkout/'.tmp'/name
if target.exists(): shutil.rmtree(target)
target.mkdir(parents=True)
archive=subprocess.Popen(['git','-C',str(checkout),'archive',rev],stdout=subprocess.PIPE)
subprocess.run(['tar','-x','-C',str(target)],stdin=archive.stdout,check=True)
assert archive.wait()==0
(target/'node_modules').symlink_to(checkout/'node_modules',target_is_directory=True)
shutil.copyfile(probes/'dbProbe.ts',target/'lib/reviewDbProbe.ts')
shutil.copyfile(probes/'load.ts',target/'scripts/reviewLoad.ts')
def patch(rel,pairs,prefix):
  p=target/rel; s=p.read_text()
  for old,new in pairs:
    assert s.count(old)==1,(rel,old); s=s.replace(old,new)
  p.write_text(prefix+s)
patch('lib/db/connection.ts',[('// Shard-only tuning','attachDbProbe(db, options.accountShard ? "shard" : "master");\n  // Shard-only tuning')],'import { attachDbProbe } from "../reviewDbProbe";\n')
patch('lib/outboundWrite.ts',[
  ('try { master.exec("BEGIN IMMEDIATE"); }','const masterBefore=performance.now(); let masterAcquired=0;\n        try { master.exec("BEGIN IMMEDIATE"); masterAcquired=performance.now(); record("guard.masterAcquireMs",masterAcquired-masterBefore); }'),
  ('actor.assertCurrent(master);','const assertionStart=performance.now();\n          actor.assertCurrent(master);\n          record("guard.assertMs",performance.now()-assertionStart);\n          record("guard.dmlAttempts");'),
  ('shard.exec("COMMIT");','shard.exec("COMMIT");\n          record("guard.commits");'),
  ('master.exec("ROLLBACK");','master.exec("ROLLBACK");\n          record("guard.masterHoldMs",performance.now()-masterAcquired);')],
  'import { record } from "./reviewDbProbe";\n')
(checkout/'.tmp/tmp').mkdir(parents=True,exist_ok=True)
print('prepared',target,'from',rev)
