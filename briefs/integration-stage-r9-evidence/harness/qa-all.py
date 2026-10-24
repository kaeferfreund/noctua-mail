import subprocess,sys,os
# Each spec receives a fresh synthetic mailbox; SMTP delivery and flag tests cannot alter one another's baseline.
for spec in ['qa-compose.spec.ts','qa-shell.spec.ts','qa-admin-breakpoint.spec.ts','qa-translation.spec.ts','qa-unread-count.spec.ts']:
 print('QA_SPEC',spec,flush=True)
 rc=subprocess.run(['bun','scripts/runQaShellBrowserTests.ts','--config=playwright.qa-round2.config.ts',spec],env={**os.environ,'QA_SHELL_USE_BUILD':'1','QA_SHELL_PORT':'3799','NOCTUA_MAILBOX_WATCHER':'1','QA_ROUND2_FIXTURE':'1'}).returncode
 if rc:sys.exit(rc)
