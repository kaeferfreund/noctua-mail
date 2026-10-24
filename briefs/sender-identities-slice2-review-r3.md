# feat/sender-identities-2 — review round 3 (read-only verification of 781b4b2)

Reviewer: Codex gpt-6.1-sol high (task review-sender-identities-2-r3). Verdict: **FIX**. Round-2 P1 (microtask window between final assertion and first effect) is CLOSED.

## Findings

### P2-A Local-only RSVP acquires the master writer without withDbWriteRetry
- lib/db/calendar/events.ts:136, :387; lib/outboundWrite.ts:10
- Repro: hold BEGIN IMMEDIATE on a separate master connection, POST calendar respond with sendReply:false (series and occurrence scope).
- 8f2a6ca: 200/200. 781b4b2: 400 {ok:false,message:"database is locked"} after ~14 ms / ~8 ms; no transaction left behind.
- Required: retry the complete guarded calendar write, preparing fresh authorization on each attempt.

### P2-B The global master writer stays held during shard lock acquisition and the whole replacement transaction
- lib/outboundWrite.ts:10; lib/db/messages/upsert.ts:697
- Paired 60 s load (two sync subprocesses with production sync/lease APIs, production watcher on a synthetic fixture, continuous draft saves, auth-connection timestamp writes at 20 Hz):

| metric | baseline 8f2a6ca | head 781b4b2 |
|---|---|---|
| successful draft saves | 1652 | 694 |
| draft save failures | 0 | 2 |
| SQLITE_BUSY retry events | 205 | 533 |
| retry exhaustions | 2 | 8 |
| auth write attempts | 1104 | 1100 |
| auth BUSY failures | 215 | 348 |
| worker completed/failed | 161/1, 156/0 | 135/2, 128/2 |

- Runtime busy_timeout: master 0, auth 0, shard 15000 (lib/db/connection.ts:118/:299). The master is therefore held while waiting up to 15 s for the shard writer.
- Hold time (200 draft saves on an 11k shard; guarded master transaction incl. shard acquisition and commit): p50 10.95 ms, p99 23.17 ms, max 48.96 ms.
- Required: reduce the master-held window and handle contention without weakening authorization through shard commit. Reviewer's note: acquiring the shard writer FIRST avoids holding master while waiting for the shard, provided every guarded path changes consistently and master exclusion is retained from the assertion through shard commit. No path currently holds a shard transaction while acquiring master (audit list below), so shard→master is a consistent order.

## Verified (no finding)
- Final synchronous assertion immediately precedes sendMail (lib/mail/smtp.ts:114, :151), APPEND after pool acquisition (lib/mail/imap/mutations.ts:53), cleanup messageDelete (:161); shard assertions inside immediate transactions (upsert.ts:698, calendar/events.ts:138, :389). 20 queued-revocation denial cases per path, zero effects.
- Audited master/shard paths (no overlap): threadCollab.ts:184/192/213; membershipCleanup.ts:20 (shard txn ends before master lifecycle updates :52–56); threads.ts:364/413; runSyncJob.ts:30, syncJobs.ts:589/616, processLeases.ts:23 master-only; mailboxWatcher.ts:82 vs :151; connection.ts:356 master txn before shard open.
- Rollback: nested deferred/immediate shard transactions, injected INSERT failure restores old draft/attachment/FTS rows, assertCurrent failure rolls back shard changes, revocation on another master connection cannot commit during the guarded shard transaction; integrity_check ok on both.
- Semantics: 14/14 normalized REST responses identical to 8f2a6ca; rejected APPEND keeps exactly one draft (old local row preserved; baseline deleted it first); MCP AI flag shares guarded creation (mcpServer.ts:846, drafts.ts:459–461); calendar tests 3×.
- Source-cache gap (isolated branch only): revocation queued right before sanitization → 403, SQL rows preserved but the old cached source overwritten (drafts.ts:451 precedes the guard at :461; eager publication in syncMessageSanitizer.ts:49/:58). The scratch merge with round-5 staging/publication returns 403 with SQL AND cached source unchanged → resolved by the merge.
- Gates at 781b4b2: typecheck 0 (1104 files); test:ci 2559 server + 366 DOM, 0 failed; focused 3×307; collaboration fixture 31/31; lint 1/25 baseline; build ok; diff --check ok.

## Merge resolution notes vs 9424150 (integration/stage round 7 = team-inbox)
Conflicts: lib/db/messages/upsert.ts (1 hunk), lib/drafts.ts (1 hunk). Same two conflicts and identical blobs vs chore/deps-nodemailer-mcp bd92941 and feat/i18n-strings a3d131c. Scratch typecheck after resolution: 0 errors (1174 files).

upsert.ts:
1. Keep the round-5 staging, publication, inner rollback, outer rollback and finally-cleanup structure.
2. Inside its outer try, prepare authorization and wrap the existing shard immediate transaction with authorizedWrite.
3. Call assertCurrent first inside the shard callback, before snapshots and replacement deletion.
4. Insert round-3 replaceDraftId bookkeeping and attachment/calendar/FTS/message deletion before the existing replaceExisting block.
5. Close the guarded transaction with `.immediate());` and publish collaboration events afterwards.
6. Preserve senderKey/sourceSha256 columns, bindings and snapshots, and final-row-id file installation. Keep asynchronous staging and cleanup outside the master-held window.

lib/drafts.ts:
1. Apply localFlags before upsert.
2. Keep round-5 `const stored` and add `{beforeWrite, replaceDraftId: existingDraft?.id}` to upsertMessages.
3. Resolve draftId through stored.messageRowIds, reread the stored row, retain the compose-field overlay.
4. Do not choose round-3 draftId=sanitized.id or savedMessage=sanitized.
5. Keep auto-merged RFC-5322 serialization and guarded post-replacement IMAP cleanup.

Integration caveat: retained files.install/rollback performs synchronous filesystem operations inside the combined master-held window → renewed latency/contention verification after the merge.

## Decision (orchestrator, 2026-10-23 05:10 UTC)
Fix round 4 on the branch: first merge 9424150 into feat/sender-identities-2 per the notes above, then restructure the guard to shard-writer-first with master exclusion only from the assertion through shard commit, one retrying helper (withDbWriteRetry, fresh authorization per attempt) shared by every guarded local write incl. the calendar paths, then repeat the paired load against the 9424150 baseline.
