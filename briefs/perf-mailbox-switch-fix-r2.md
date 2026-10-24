# perf/mailbox-switch fix r2: last click wins on fast A → B → A

Branch perf/mailbox-switch, commit e40b131 on 5a8c373. Finding: briefs/perf-mailbox-switch-review-r1.md P2-1 (pre-existing on e70c30b).
The task (fix-mailbox-switch-aba-r2) implemented and gated the change, then died at a usage limit before committing; the orchestrator reviewed the diff, reran quick gates and committed.

Change (useAccountController.ts switchAccount): a click on the mailbox still shown while another switch is in flight no longer returns early. It bumps the switch version (cancels the pending switch), persists the selection in click order through the existing serialized writer, skips the folder read and commits nothing, so A's view stays. 401/403 on that write → nothing activates, server view reloads.

Tests: new mailboxSwitchRapid.dom.test.tsx on the real MailClient (A→B→C ends on C without B's list/topics; A→B→A ends on A in sidebar and server without reloading A; slow first write cannot overwrite the later choice), five new cases in useAccountController.dom.test.tsx (A→B→A, A→B→A→B, click on shown mailbox sends nothing, 403 on A's write, overlapping bootstrap).

Gates: task run after the last edit — DOM suite 593/0, build ok, auth browser 20/20 incl. shell.spec.ts:229. Orchestrator rerun — bun check 0, lint clean on the 3 files, switch DOM files 37/0. merge-tree vs integration/stage a504783: clean.
