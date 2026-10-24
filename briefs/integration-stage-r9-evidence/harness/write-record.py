import pathlib,subprocess,json,re,hashlib
P=pathlib.Path
run=lambda *args:subprocess.check_output(args,text=True).strip()
head=run('git','rev-parse','HEAD');base=run('git','rev-parse','9424150');resume=run('git','rev-parse','9386f4e')
history=[json.loads(x) for x in P('.tmp/gates.jsonl').read_text().splitlines()];latest={x['name']:x for x in history}
required=['deps-paths','install-final','typecheck-complete','ci','stress','lint','lint-baseline-comparison','build-final','standalone-packages-final','standalone-workers-final','auth-browser','html-privacy','qa-all','smoke','security','migration','shutdown-idle-final','shutdown-watcher-final','i18n-standalone-final','german320','integration-files-lint-complete','diff-check','diff-check-worktree']
for name in required:assert latest[name]['exit_code']==(1 if name=='lint' else 0),(name,latest.get(name))
assert run('git','status','--short')==''
assert subprocess.run(['git','diff','--quiet','3fe0562','--','bun.lock']).returncode==0
before=json.loads(P('.tmp/bundle-before.json').read_text());after=json.loads(P('.tmp/bundle-after-final.json').read_text());after['sha']=run('git','rev-parse',after['sha'])
prior=json.loads(P('.tmp/bundle-after.json').read_text());assert all(after[k]==prior[k] for k in ['js_assets','raw_bytes','gzip_bytes'])

def log(name):return re.sub(r'\x1b\[[0-9;]*m','',P('.tmp/'+name+'.log').read_text())
def summary(name):
 t=log(name);return {'passed':[int(x) for x in re.findall(r'(?m)^ (\d+) pass$',t)],'failed':[int(x) for x in re.findall(r'(?m)^ (\d+) fail$',t)],'assertions':[int(x) for x in re.findall(r'(?m)^ (\d+) expect\(\) calls$',t)],'verbatim_summary':re.findall(r'(?m)^ \d+ (?:pass|fail|expect\(\) calls)$|^Ran .*$',t)}
def shutdown(name):
 for line in log(name).splitlines():
  if line.startswith('{'):
   try:r=json.loads(line)
   except ValueError:continue
   if 'durationMs' in r:return r
 raise RuntimeError(name)
def commits(start):
 return [{'sha':sha,'subject':subject} for line in run('git','log','--first-parent','--reverse','--format=%H\t%s',start+'..HEAD').splitlines() for sha,subject in [line.split('\t',1)]]
conflicts={
 '1':[], '2':[], '5':[], '6':[],
 '7':[
 {'files':['messages/de.json','messages/en.json'],'resolution':'Union namespace/key sets in existing order; keep slice 2a shared copy and slice 2b reviewed List/Reader/Notifications copy.'},
 {'files':['lib/i18n/catalogs.test.ts'],'resolution':'One shape-validating leaf walker, strict ICU/parity checks and every case from both slices.'},
 {'files':['app/components/shell/Shell.dom.test.tsx'],'resolution':'Shared render/I18nTestProvider import and slice 2a provider-wrapped SSR/hydration test.'},
 {'files':['app/components/shell/ShellHeader.tsx','app/components/shell/ShellSidebar.tsx'],'resolution':'Translated accessible labels plus slice 2b stable data-shell-action attributes.'},
 {'files':['app/components/mailclient/useMessageMutations.ts'],'resolution':'Additional overlap with input 5: preserve useEffect/useRef folder refresh generation and useTranslations notifications together.'}],
 '9':[]}
fts=json.loads(P('.tmp/migration-results.json').read_text());fts=[{k:v for k,v in r.items() if k!='schema'} for r in fts]
idle=shutdown('shutdown-idle-final');watcher=shutdown('shutdown-watcher-final')
qa101=json.loads(P('.tmp/qa101-summary.json').read_text())
cleanup=json.loads(P('.tmp/cleanup-audit.json').read_text());assert cleanup['live_worktree_processes']==[]
handoff={
 'dependencies':{'sharp_override':'0.35.5','sharp_libvips':'1.3.4 / 8.18.7','imapflow':'2.9.1','nodemailer':'10.2.1','mcp_sdk':'1.32.1','tracing_includes':['/* -> ./node_modules/@img/sharp-libvips-*/lib/**','/api/accounts/*/sync -> ./node_modules/imapflow/**'],'standalone_entry':'bun --bun server.js; ship noctua-server.mjs, .next/static and public'},
 'fts_v3':{'migration':'One-way transaction at first configured open per physical shard; open every mapped account, including cold/inactive shards. Stop all old/new clients first and retain a coordinated verified backup of master/auth, mapped shards with WAL/SHM, sources, attachments and matching private keys.','planning':'For the reviewed 11,000-message v2 workload, budget 2.0-3.0 seconds per shard for whole open; present smaller synthetic v2 copy measured 987.030 ms and legacy format-0 copy 4304.075 ms including configured API/runtime probes. Allow additional time for pre-v2 composite-key conversion; serially budget every shard and validate representative stopped copies. No larger-shard latency guarantee.','space':'At least 2 x largest shard file + 56 MB WAL headroom per shard filesystem, plus backup and normal reserve; reviewed process RSS approximately 220 MB. Larger/concurrent migrations need larger allowances.','verification':'Follow doc/FTS-V3-MIGRATION.md steps 3-5 in order: readonly collision/orphan inventory; timed configured first open; exact schema/81 guards, bijection/FTS/FKs, scoped search/page boundaries, then provenance/privacy. Record orphan decisions. Resync every historically shared account even if current collisions are zero.','rollback':'Stop writers and restore the complete coordinated snapshot with the matching old binary and keys. No in-place downgrade, version lowering, guard removal, ANALYZE or PRAGMA optimize.'},
 'i18n':{'default':'German (du); German and English catalogs bundled in standalone.','precedence':['stored users.uiLocale','validated noctua-ui-locale cookie','Accept-Language','de'],'verification':'Five standalone locale cases, static assets HTTP 200, German list and reader captured at 320 px without document overflow.','followups':'Server bucket boundaries versus Europe/Berlin remain the documented doc/I18N.md follow-up, outside round 8.'},
 'required_new_environment_variables':[],
 'retained_systemd':{'TimeoutStopSec':'10s','KillSignal':'SIGTERM','KillMode':'mixed'}}
report={'status':'complete','worktree':str(P.cwd()),'branch':'integration/stage','final_sha':None,'round7_base':base,'resumed_from':resume,'validated_source_head':head,'round8_commits':commits(base),'commits_created_in_continuation':commits(resume),'pins':{branch:run('git','rev-parse',pin) for branch,pin in json.loads(P('.tmp/pins.json').read_text()).items()},'conflicts_per_input':conflicts,'inputs_3_4':'Contained in input 2; not merged separately.',
 'gates':{name:{**latest[name],**(summary(name) if name in ['deps-paths','ci','stress','html-privacy','security'] else {})} for name in required},
 'acceptance':{'typecheck_errors':0,'typecheck_files':1195,'ci_unit':2804,'ci_dom':462,'stress':8412,'auth_browser':20,'html_privacy_assertions':177,'qa':{'total':11,'compose':4,'shell':4,'admin_breakpoint':1,'translation':1,'unread_count':1,'skipped':0,'read_settled_ms':qa101['settledMs'],'unread_ms':qa101['unreadMs'],'new_mail_ms':qa101['newMailMs']},'smoke':'SMOKE PASS','security':156,'lint':{'errors':1,'warnings':25,'new':0,'baseline_error':'app/components/calendar/useCalendarConflicts.ts:58:5 react-hooks/set-state-in-effect'},'standalone_locale_cases':5,'german320_screenshots':['german-list-320.png','german-reader-320.png'],'git_diff_check':True},
 'bundle':{'method':'Unique root firstLoadChunkPaths, Node node:zlib gzipSync level 6 per asset; retained round-7 build reproduces recorded baseline exactly.','before':before,'after':after,'delta_raw_bytes':after['raw_bytes']-before['raw_bytes'],'delta_gzip_bytes':after['gzip_bytes']-before['gzip_bytes'],'gzip_increase_percent':round((after['gzip_bytes']/before['gzip_bytes']-1)*100,6)},
 'shutdown':{'idle':idle,'watcher':watcher,'idle_over_300_ms':idle['durationMs']>300,'before_optional_cleanup_ms':{'idle':77,'watcher':50},'historical_baselines_ms':{'round7_idle':102,'imapflow2_branch_under_load':505}},
 'fts_migrations':fts,'remaining_typecheck_errors':[],'deploy_handoff_delta':handoff,
 'dropped_inputs':[{'input':8,'branch':'feat/sender-identities-2','pin':'d5ae17b','reason':'Deferred to round 9 while fix round 4 is under decisive performance review.'},{'input':10,'branch':'feat/sender-identities-3','reason':'Deferred to round 9; in fix round 2.'}],
 'lockfile_sha256':hashlib.sha256(P('bun.lock').read_bytes()).hexdigest(),'lock_unchanged_from_input_2':True,'cleanup':cleanup,'pushed':False,'pr_created':False,'deployed':False}
P('.tmp/report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
body=['fix(integration): record round 8 validation and deployment handoff\n',
'''Resumed clean integration/stage at 9386f4eb5a701fc5df721ccac633b33bf13c0bab after the two approved merges. Read the round-8 and round-7 briefs, round-7 validation record and retained round-6 handoff. Fetched origin and verified all six included branch tips against their full pins. The first frozen install had populated 16 packages from input 2's changed lock; that was accepted as clarified by the owner. The lock itself was never regenerated or changed by installation. Final frozen install reports no changes and bun.lock exactly equals input 2.

Before each remaining merge, ran git merge-tree --write-tree HEAD <full pin>. Inputs 5, 6 and 9 were conflict-free and their committed trees exactly match the previews. Input 7 preserved the six documented conflict files plus the additional QA unread reconciliation overlap. Merge order was exactly 5, 6, 7, 9; inputs 3/4 are included by input 2, and 8/10 remain dropped. No pushes or PRs.\n''',
'Pinned inputs:\n'+json.dumps(report['pins'],indent=2),
'First-parent round-8 commits before this record:\n'+json.dumps(report['round8_commits'],indent=2),
'Conflicts and resolutions per input:\n'+json.dumps(conflicts,indent=2),
'''Integration corrections:
- Input 5's new unread-mutation and breakpoint DOM suites lacked locale context after inputs 6/7. Reused the existing I18nTestProvider render helper in a separate fix commit. Initial focused run: 21 pass / 8 fail; corrected focused run: 29 pass / 0 fail / 164 assertions. Catalog integration: 53 pass / 0 fail / 3831 assertions. Full CI and stress passed after this correction.
- The existing production QA runner did not supply input 5's 300-message/110-unread fixture, compose seed/outbox or control URL. Added the optional reviewed fixture using existing seed helpers and assigned sockets. Each of the five unmodified specs runs on fresh storage so SMTP and flag mutations cannot contaminate the unread baseline. All 11 passed, none skipped. The translated HtmlMessage privacy entrypoint now uses the existing application I18nProvider; all 177 privacy assertions passed.
- Temporary helper corrections, all recorded in the timed history: a fixture generator initially named a nonexistent FTS column; lint comparison initially parsed a code-location excerpt as a path; an added standalone probe incorrectly demanded a manifest for the bundled MCP SDK; the legacy migration oracle initially treated subject:needle as app syntax instead of passing fields=[subject]; and a watcher seeding parent retained the auth lifetime lock. Corrected the helpers, recreated disposable copies and reran them. The watcher seed now exits in a separate process before server startup. Existing suite assertions, deadlines and retry budgets were never changed. No host-load rerun was needed.
- Removed only two stale ignored non-target optional directories, @img/sharp-linuxmusl-arm64 0.34.5 and @img/sharp-libvips-linuxmusl-arm64 1.2.4, as in the dependency handoff. Frozen install still reported no changes. Rebuilt fresh standalone and repeated native/runtime, worker, locale, gzip and shutdown checks. Native ARM64/glibc output is sharp 0.35.5 and libvips package 1.3.4 / runtime 8.18.7. No nodemailer 8 exists in the lock, node_modules or standalone; mailparser-private nodemailer 10.2.0 is retained.
- Final application source is identical to that validated by full CI/stress and auth/browser QA. Later tracked corrections concern only acceptance fixtures. The final rebuild is at the final source head below; cleanup did not change JS bundle bytes.\n''',
'Validated source head: '+head+'\nFrozen bun.lock SHA-256: '+report['lockfile_sha256']+'\n',
'''Environment: Bun 1.4.4, Next 16.2.4; all heavy commands sequential at nice -n 15. TMPDIR is worktree-local .tmp. Runtime stores, account IDs, mail and keys are synthetic. App/standalone servers use only 3798/3799; protocol fixtures bind OS-assigned loopback sockets. Browser platform override ubuntu24.04-arm64. No other worktree or live datastore was edited/opened by these probes.\n''',
'Verbatim gate result excerpts:\n']

def redacted(r):
 r=json.loads(json.dumps(r));r['command']=[re.sub(r'^(BETTER_AUTH_SECRET|IMAP_SECRET_KEY)=.*',r'\1=<synthetic-process-only>',x) for x in r['command']];return r
for name in required:
 body.append(name+': '+json.dumps(redacted(latest[name])))
 t=log(name)
 if name in ['deps-paths','ci','stress','html-privacy','security']:lines=summary(name)['verbatim_summary']
 elif name=='auth-browser':lines=[s for s in t.splitlines() if re.match(r'^  \d+ passed',s)]
 elif name=='qa-all':lines=[s for s in t.splitlines() if s.startswith('QA_SPEC') or re.match(r'^  \d+ passed',s)]
 elif name=='migration':lines=[s for s in t.splitlines() if s.startswith(('INVENTORY ','MIGRATION PASS ','MASTER '))]
 elif name.startswith('shutdown-'):lines=[json.dumps(shutdown(name))]
 elif name=='build-final':lines=[s for s in t.splitlines() if any(x in s for x in ['▲ Next.js','Compiled successfully','Finished TypeScript','Generating static pages using'])]
 elif name=='smoke':lines=[s for s in t.splitlines() if s.startswith(('PASS ','SMOKE PASS'))]
 elif name=='german320':lines=[s for s in t.splitlines() if s.startswith('GERMAN 320 PASS') or re.match(r'^  \d+ passed',s)]
 else:lines=t.strip().splitlines()
 body.append('\n'.join(lines) or '(no output)')
 body.append('')
body.extend(['QA-101 measured timings (ms): '+json.dumps({k:qa101[k] for k in ['settledMs','unreadMs','newMailMs','mutationStatus','injectionStatus']}),
'Main-route first-load JS before/after:\n'+json.dumps(report['bundle'],indent=2),
'''Migration procedure: generated two synthetic 11,000-message/2-account original shards before input 9, using the unchanged round-7 v2 schema and the legacy format-0 SQL fixture. Closed them and copied them (no remaining WAL/SHM siblings). Never migrated originals. Runbook steps 3-5 on each copy: integrity/inventory with zero FTS orphans, timed first getAccountDb, exact schema and 81 guards, bijection/FTS integrity/FKs, scoped selective/common/phrase/subject/from/no-hit and page comparisons, all original message columns plus known/NULL provenance, attachment ownership and retained source/attachment bytes. Old round-7 preparer refuses v3; old marker-only writers and historical views reject DML. Two closes/reopens preserve schema. Three perf indexes exist. Fresh and older masters validate nullable uiLocale+CHECK, covering provisioning index and one receipt with two reopens; profile/auth epoch preserved. Whole configured API durations include runtime probes; fixture sizes/text differ from the review's ~154 MB 11k workload. No power-loss or arbitrary-SQL protection claim.\n''',
'FTS migration results:\n'+json.dumps(fts,indent=2),
'Shutdown measurements:\n'+json.dumps(report['shutdown'],indent=2),
'Complete timed gate history (including helper failures):\n'+'\n'.join(json.dumps(redacted(x)) for x in history),
'Deployment handoff delta; round-7 coordinated handoff otherwise retained:\n'+json.dumps(handoff,indent=2,ensure_ascii=False),
'Dropped inputs:\n'+json.dumps(report['dropped_inputs'],indent=2),
'''No pushes, PRs, deployments, credential changes, rebase, reset, force, stash, branch checkouts or worktree lifecycle operations. No .env.local or real secrets committed. No PRAGMA optimize or ANALYZE. Only owned PID/private process groups stopped; no pattern kills. Runtime probes/fixtures are closed and reserved ports free. Logs, JSON report, exact temporary harnesses and synthetic German 320 px screenshots are retained outside the worktree under ROOT/briefs/integration-stage-r8-validation-905c32f. The worktree-local .tmp is removed after this record commit.\n''',
'Cleanup audit:\n'+json.dumps(cleanup,indent=2),
'The tracked tree is clean. This final commit records validation and deployment handoff only.\n',
'Co-Authored-By: Codex gpt-6.1-sol <noreply@openai.com>'])
P('.tmp/validation-record.txt').write_text('\n'.join(body)+'\n')
print(json.dumps({'record_bytes':P('.tmp/validation-record.txt').stat().st_size,'required_gates':len(required),'commits_before_record':len(report['round8_commits']),'bundle':report['bundle'],'final_shutdown_ms':[idle['durationMs'],watcher['durationMs']]}))
