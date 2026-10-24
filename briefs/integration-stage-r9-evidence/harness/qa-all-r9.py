import subprocess,sys,os
# Each spec receives a fresh synthetic mailbox (runQaShellBrowserTests scratch); unmodified round-2 harness.
runs=[(s,'playwright.qa-round2.config.ts') for s in ['qa-compose.spec.ts','qa-shell.spec.ts','qa-admin-breakpoint.spec.ts','qa-translation.spec.ts','qa-unread-count.spec.ts','qa-admin-self-grant.spec.ts']]
runs+=[('qa-i18n-views.spec.ts','playwright.qa-i18n-views.config.ts'),('review.spec.ts','.tmp/review-r4/review.config.ts')]
only=sys.argv[1:]
for spec,cfg in runs:
 if only and spec not in only: continue
 print('QA_SPEC',spec,cfg,flush=True)
 args=['bun','scripts/runQaShellBrowserTests.ts','--config='+cfg]+([spec] if spec!='review.spec.ts' else [])
 rc=subprocess.run(args,env={**os.environ,'QA_SHELL_USE_BUILD':'1','QA_SHELL_PORT':'3799','NOCTUA_MAILBOX_WATCHER':'1','QA_ROUND2_FIXTURE':'1'}).returncode
 print('QA_EXIT',spec,rc,flush=True)
 if rc:sys.exit(rc)
