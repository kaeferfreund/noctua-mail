# FTS identity v3 review — round 1

Verdict: **FIX**. Reviewed `c8198067454a0034d6e6393f1d99401506bf6446`.

No data-integrity regression was reproduced. Complete the mandatory rollout runbook before approval; reconcile the readonly marker criterion. All required test gates passed.

## Findings

### P2 — /home/monkey/code/noctua-mail/briefs/perf-fts-identity-v3.md:102

Mandatory one-way rollout handoff is incomplete. It mentions stopping clients and restoring a pre-upgrade backup, but gives no explicit backup inventory/procedure for master, all mapped shards, their WALs and key material, no ordered post-start verification, and no historically shared-shard resync instruction. This is an operational-readiness finding; no migration data-integrity regression was reproduced.

Reproduction: Read Deploy handoff lines 96-102 and search the complete handoff for backup, keys, WAL, verify and resync. Compare with checklist item 13 and the collision CLI note.

Result: There is no explicit prerequisite to create and validate the complete stopped backup before the automatically migrating startup. The inventory CLI warns to resync every mapped account for a shard shared before account keys even when the surviving collision count is zero; the deploy section omits that instruction.

Required fix: Complete the owner rollout runbook before rollout approval: stop all old app/worker/script clients; resolve every shard path from master; take and verify a consistent stopped backup of master, shards, any remaining WAL/SHM sidecars, retained-source/attachment data needed for full restore and encryption/auth key configuration; run read-only collision/orphan inventory; budget temporary disk/WAL space; start the merged binary; verify v3 shapes/81 guards/both views, counts/FTS integrity, account-scoped searches and provenance/privacy; document restore-only rollback and historical shared-shard resync. Include the independently measured WAL/RSS envelope with its synthetic-data limitations.

### P3 — lib/db/schema.ts:977

The literal checklist requirement that read-only/cold opens never register a writer marker is not implemented. initAccountSchema unconditionally prepares the connection, including a readonly healthy v3 handle. This behavior already existed for the v2 marker; it is not a newly introduced write bypass.

Reproduction: Open a migrated synthetic file with new Database(path,{readonly:true}); SELECT noctua_writer_v3() initially fails; call initAccountSchema(db); SELECT noctua_writer_v2(),noctua_writer_v3() then returns 2,3.

Result: Markers are registered on this readonly cold initializer. An actual DELETE still fails with "attempt to write a readonly database". Raw readonly inventory handles and raw SQLite reader handles remain unregistered. Ordinary application read requests use write-capable configured handles because reads can perform provenance/runtime backfills.

Required fix: Reconcile the acceptance wording with the existing opener contract. If marker-free readonly initialization is required, provide a separate readonly schema probe and keep writer preparation on every writing opener. Do not remove or weaken registration for ordinary application handles.

## Verification overview

Search: 176 comparisons, no differences (84 SQL + 92 application comparisons, including four matching baseline errors).

Migration: [2030.265, 2967.126, 2890.239] ms. WAL peak: 56027912 bytes. RSS after: [226766848, 219537408, 221761536] bytes. Configured SQLite cache target: 32 MiB; resident cache bytes were not separately available.

CI: 2,778 unit + 433 DOM. Stress: 8334. Focused: 185 across 23 files. Headless privacy: 177 assertions. Zero failures.

Sender merge at 781b4b2 conflicts in upsert.ts and drafts.ts. All five other supplied heads merge cleanly. The pending sender fix and resolved integration require a new verification pass.

All tracked files remain unchanged. Scratch data was removed and ports 3893/3894 are free.

## Complete machine-readable evidence

The JSON below is identical in content to the final review response. It includes all 13 checklist items, source/guard inventories, the 15-site corpus sample, crash results, measurements, exact gates, merge results, rollout gaps and cleanup.

```json
{
  "verdict": "FIX",
  "reviewed_commit": "c8198067454a0034d6e6393f1d99401506bf6446",
  "findings": [
    {
      "severity": "P2",
      "location": "/home/monkey/code/noctua-mail/briefs/perf-fts-identity-v3.md:102",
      "issue": "Mandatory one-way rollout handoff is incomplete. It mentions stopping clients and restoring a pre-upgrade backup, but gives no explicit backup inventory/procedure for master, all mapped shards, their WALs and key material, no ordered post-start verification, and no historically shared-shard resync instruction. This is an operational-readiness finding; no migration data-integrity regression was reproduced.",
      "reproduction": "Read Deploy handoff lines 96-102 and search the complete handoff for backup, keys, WAL, verify and resync. Compare with checklist item 13 and the collision CLI note.",
      "result": "There is no explicit prerequisite to create and validate the complete stopped backup before the automatically migrating startup. The inventory CLI warns to resync every mapped account for a shard shared before account keys even when the surviving collision count is zero; the deploy section omits that instruction.",
      "required_fix": "Complete the owner rollout runbook before rollout approval: stop all old app/worker/script clients; resolve every shard path from master; take and verify a consistent stopped backup of master, shards, any remaining WAL/SHM sidecars, retained-source/attachment data needed for full restore and encryption/auth key configuration; run read-only collision/orphan inventory; budget temporary disk/WAL space; start the merged binary; verify v3 shapes/81 guards/both views, counts/FTS integrity, account-scoped searches and provenance/privacy; document restore-only rollback and historical shared-shard resync. Include the independently measured WAL/RSS envelope with its synthetic-data limitations."
    },
    {
      "severity": "P3",
      "location": "lib/db/schema.ts:977",
      "issue": "The literal checklist requirement that read-only/cold opens never register a writer marker is not implemented. initAccountSchema unconditionally prepares the connection, including a readonly healthy v3 handle. This behavior already existed for the v2 marker; it is not a newly introduced write bypass.",
      "reproduction": "Open a migrated synthetic file with new Database(path,{readonly:true}); SELECT noctua_writer_v3() initially fails; call initAccountSchema(db); SELECT noctua_writer_v2(),noctua_writer_v3() then returns 2,3.",
      "result": "Markers are registered on this readonly cold initializer. An actual DELETE still fails with \"attempt to write a readonly database\". Raw readonly inventory handles and raw SQLite reader handles remain unregistered. Ordinary application read requests use write-capable configured handles because reads can perform provenance/runtime backfills.",
      "required_fix": "Reconcile the acceptance wording with the existing opener contract. If marker-free readonly initialization is required, provide a separate readonly schema probe and keep writer preparation on every writing opener. Do not remove or weaken registration for ordinary application handles."
    }
  ],
  "checklist": {
    "1": {
      "status": "finding",
      "evidence": [
        "P3 documents the literal readonly/cold-marker mismatch. All production writing openers retain the audited marker lifecycle: connection.ts:105-107 calls preparation before pragmas; getAccountDb at :373-375 and membershipCleanup.ts:17-19 are the account-shard constructors. initAccountSchema also prepares direct schema handles. Future versions refuse before registration/configuration. The archived 9424150 opener explicitly refused v3.",
        "shardFormat.ts:27-55 discovers ordinary accountId tables and emits BEFORE INSERT/UPDATE/DELETE with noctua_writer_v3() IS NOT 3. The listed 27 tables have exactly 81 guards. Both missing-v3 and v2-only handles reject every combination, including zero-row updates/deletes with FK enforcement OFF. A wrong v3 marker returning 2 rejects a real mutation. Both old FTS views reject all six DML combinations.",
        "143 SQL-literal/interpolated statements in 29 production source files were inventoried using the TypeScript AST and checked against rg searches; two SQL-like log/UI strings were excluded. The dynamic historical table-copy INSERT in accountKeys.ts:200 is additional and runs inside the prepared migration transaction. Passed-db helpers (schema, accountKeys, ftsIdentity, senderKey, topics, thread remaps) are reached from configured handles. Physical FTS writes are confined to the inventoried migration/identity/upsert/delete paths; deliberate raw SQL against physical FTS/shadows is outside the audited guarantee.",
        "API/serverDb/db exports, sync/watch/runSyncJob and recompute workers, collaboration, drafts, resync, cross-account copy and MCP all converge on the configured DB API. The collision CLI opens readonly without connection configuration. Other constructors open master/auth, synthetic UID state or worker-job bookkeeping, not mail shards."
      ],
      "guard_tables_each_insert_update_delete": [
        "attachments",
        "calendar_event_conflicts",
        "calendar_event_suppressions",
        "calendar_events",
        "calendar_participation_overrides",
        "calendar_reminders",
        "category_feedback_events",
        "category_model_state",
        "draft_tombstones",
        "folders",
        "mailbox_state",
        "mailbox_summary",
        "message_calendar_events",
        "message_fts_identity",
        "message_translations",
        "messages",
        "recipient_aliases",
        "sent_by",
        "thread_activity",
        "thread_collab_state",
        "thread_comments",
        "thread_signals",
        "thread_topics",
        "threads",
        "topic_learning_signals",
        "topic_signal_exclusions",
        "topics"
      ],
      "current_dml_inventory": {
        "lib/db/accountKeys.ts": {
          "lines": [
            209
          ],
          "tables": [
            "message_fts"
          ]
        },
        "lib/db/calendar/conflicts.ts": {
          "lines": [
            56,
            122
          ],
          "tables": [
            "calendar_event_conflicts"
          ]
        },
        "lib/db/calendar/events.ts": {
          "lines": [
            183,
            205,
            366,
            435,
            444
          ],
          "tables": [
            "calendar_events",
            "calendar_participation_overrides"
          ]
        },
        "lib/db/calendar/inviteStates.ts": {
          "lines": [
            42,
            158,
            199,
            228,
            293
          ],
          "tables": [
            "message_calendar_events"
          ]
        },
        "lib/db/calendar/reminders.ts": {
          "lines": [
            484,
            508,
            528,
            617,
            644,
            665,
            683,
            742,
            787
          ],
          "tables": [
            "calendar_reminders"
          ]
        },
        "lib/db/calendar/suppressions.ts": {
          "lines": [
            22,
            36
          ],
          "tables": [
            "calendar_event_suppressions"
          ]
        },
        "lib/db/categories.ts": {
          "lines": [
            78,
            99,
            365,
            378,
            455
          ],
          "tables": [
            "category_feedback_events",
            "category_model_state",
            "messages"
          ]
        },
        "lib/db/folders.ts": {
          "lines": [
            68,
            70,
            146,
            150,
            176
          ],
          "tables": [
            "folders",
            "mailbox_state",
            "messages"
          ]
        },
        "lib/db/ftsIdentity.ts": {
          "lines": [
            39,
            41,
            64,
            70,
            76,
            78
          ],
          "tables": [
            "${SHARD_FTS_TABLE}",
            "message_fts_identity"
          ]
        },
        "lib/db/mailboxSummary.ts": {
          "lines": [
            40,
            48
          ],
          "tables": [
            "mailbox_summary"
          ]
        },
        "lib/db/messages/attachments.ts": {
          "lines": [
            30,
            47,
            54
          ],
          "tables": [
            "attachments",
            "messages"
          ]
        },
        "lib/db/messages/delete.ts": {
          "lines": [
            94,
            96,
            142,
            146,
            149,
            205,
            213,
            221
          ],
          "tables": [
            "${SHARD_FTS_TABLE}",
            "attachments",
            "messages"
          ]
        },
        "lib/db/messages/draftTombstones.ts": {
          "lines": [
            47,
            53,
            108
          ],
          "tables": [
            "draft_tombstones"
          ]
        },
        "lib/db/messages/flags.ts": {
          "lines": [
            36,
            81,
            130
          ],
          "tables": [
            "messages"
          ]
        },
        "lib/db/messages/move.ts": {
          "lines": [
            86,
            100,
            113,
            177,
            273,
            285,
            303,
            361
          ],
          "tables": [
            "messages"
          ]
        },
        "lib/db/messages/retrieval.ts": {
          "lines": [
            59
          ],
          "tables": [
            "messages"
          ]
        },
        "lib/db/messages/senderKey.ts": {
          "lines": [
            21
          ],
          "tables": [
            "messages"
          ]
        },
        "lib/db/messages/sizes.ts": {
          "lines": [
            66
          ],
          "tables": [
            "messages"
          ]
        },
        "lib/db/messages/upsert.ts": {
          "lines": [
            112,
            113,
            117,
            120,
            124,
            128,
            130,
            133,
            151,
            164,
            170,
            173,
            180,
            197
          ],
          "tables": [
            "${SHARD_FTS_TABLE}",
            "attachments",
            "message_calendar_events",
            "messages"
          ]
        },
        "lib/db/schema.ts": {
          "lines": [
            292,
            494,
            541,
            583,
            1341,
            1449
          ],
          "tables": [
            "calendar_events",
            "calendar_reminders",
            "message_calendar_events",
            "messages"
          ]
        },
        "lib/db/threadCollab.ts": {
          "lines": [
            83,
            97,
            152,
            161,
            172,
            250,
            251,
            253,
            255,
            259,
            370
          ],
          "tables": [
            "sent_by",
            "thread_activity",
            "thread_collab_state",
            "thread_comments",
            "thread_topics"
          ]
        },
        "lib/db/threads.ts": {
          "lines": [
            36,
            83,
            122,
            172,
            249,
            282,
            285,
            321,
            323,
            365,
            397,
            474
          ],
          "tables": [
            "messages",
            "thread_signals",
            "thread_topics",
            "threads",
            "topic_learning_signals"
          ]
        },
        "lib/db/topics.ts": {
          "lines": [
            81,
            94,
            109,
            114,
            135
          ],
          "tables": [
            "topic_learning_signals",
            "topic_signal_exclusions"
          ]
        },
        "lib/db/translations.ts": {
          "lines": [
            59
          ],
          "tables": [
            "message_translations"
          ]
        },
        "lib/membershipCleanup.ts": {
          "lines": [
            29,
            33
          ],
          "tables": [
            "thread_activity",
            "thread_collab_state"
          ]
        },
        "lib/recipientAliases.ts": {
          "lines": [
            196,
            198,
            272,
            321,
            352
          ],
          "tables": [
            "recipient_aliases"
          ]
        },
        "lib/topics/core.ts": {
          "lines": [
            117,
            148,
            161,
            166,
            237,
            242,
            270,
            290,
            318
          ],
          "tables": [
            "thread_topics",
            "topic_learning_signals",
            "topics"
          ]
        },
        "lib/topics/transfer.ts": {
          "lines": [
            359,
            360,
            361,
            362,
            364,
            368,
            372
          ],
          "tables": [
            "thread_topics",
            "topic_learning_signals",
            "topic_signal_exclusions",
            "topics"
          ]
        },
        "scripts/backfillCalendarSnapshots.ts": {
          "lines": [
            56
          ],
          "tables": [
            "message_calendar_events"
          ]
        }
      }
    },
    "2": {
      "status": "verified",
      "evidence": [
        "All 112 frozen legacy sites reject on v3: 105 missing-function preparation failures and 7 legacy read-only-view failures; snapshots unchanged (shardFormat.test.ts, independently run focused gate plus full CI).",
        "The frozen 164a57e corpus is historical legacy-binary coverage, not an exhaustive HEAD writer inventory. Fifteen samples were checked against current source. Most retain the same table/operation but source lines, composite predicates and bindings have changed; translations.ts:59 changed INSERT OR REPLACE to account-scoped INSERT...ON CONFLICT UPDATE. No frozen entry was modified.",
        "The following current SQL files have no entry in the frozen corpus; their writers were separately traced and are covered by the 81-table-operation rejection matrix. Therefore the historical replay alone must not be cited as proof that every current SQL site was replayed."
      ],
      "current_files_absent_from_frozen_corpus": [
        "lib/db/accountKeys.ts",
        "lib/db/ftsIdentity.ts",
        "lib/db/messages/retrieval.ts",
        "lib/db/messages/senderKey.ts",
        "lib/membershipCleanup.ts",
        "lib/recipientAliases.ts",
        "lib/topics/core.ts",
        "lib/topics/transfer.ts",
        "scripts/backfillCalendarSnapshots.ts"
      ],
      "sample_15": [
        {
          "legacy": "lib/db/translations.ts:59",
          "table": "message_translations",
          "current_matching_operation_lines": [],
          "note": "Current translation INSERT UPSERT is at line 59; historical REPLACE text is stale."
        },
        {
          "legacy": "lib/db/topics.ts:81",
          "table": "topic_learning_signals",
          "current_matching_operation_lines": [
            81
          ],
          "note": "Current table/operation counterpart found; frozen SQL/line need not equal HEAD."
        },
        {
          "legacy": "lib/db/topics.ts:94",
          "table": "topic_signal_exclusions",
          "current_matching_operation_lines": [
            94
          ],
          "note": "Current table/operation counterpart found; frozen SQL/line need not equal HEAD."
        },
        {
          "legacy": "lib/db/threads.ts:257",
          "table": "threads",
          "current_matching_operation_lines": [
            249
          ],
          "note": "Current table/operation counterpart found; frozen SQL/line need not equal HEAD."
        },
        {
          "legacy": "lib/db/threadCollab.ts:147",
          "table": "thread_comments",
          "current_matching_operation_lines": [
            161,
            172,
            253,
            259
          ],
          "note": "Current table/operation counterpart found; frozen SQL/line need not equal HEAD."
        },
        {
          "legacy": "lib/db/schema.ts:536",
          "table": "calendar_events",
          "current_matching_operation_lines": [
            494,
            541,
            583
          ],
          "note": "Current table/operation counterpart found; frozen SQL/line need not equal HEAD."
        },
        {
          "legacy": "lib/db/messages/upsert.ts:121",
          "table": "attachments",
          "current_matching_operation_lines": [
            117,
            120,
            130
          ],
          "note": "Current table/operation counterpart found; frozen SQL/line need not equal HEAD."
        },
        {
          "legacy": "lib/db/messages/sizes.ts:66",
          "table": "messages",
          "current_matching_operation_lines": [
            66
          ],
          "note": "Current table/operation counterpart found; frozen SQL/line need not equal HEAD."
        },
        {
          "legacy": "lib/db/messages/flags.ts:81",
          "table": "messages",
          "current_matching_operation_lines": [
            36,
            81,
            130
          ],
          "note": "Current table/operation counterpart found; frozen SQL/line need not equal HEAD."
        },
        {
          "legacy": "lib/db/messages/delete.ts:153",
          "table": "messages",
          "current_matching_operation_lines": [
            96,
            149,
            221
          ],
          "note": "Current table/operation counterpart found; frozen SQL/line need not equal HEAD."
        },
        {
          "legacy": "lib/db/folders.ts:70",
          "table": "folders",
          "current_matching_operation_lines": [
            70
          ],
          "note": "Current table/operation counterpart found; frozen SQL/line need not equal HEAD."
        },
        {
          "legacy": "lib/db/calendar/suppressions.ts:36",
          "table": "calendar_event_suppressions",
          "current_matching_operation_lines": [
            36
          ],
          "note": "Current table/operation counterpart found; frozen SQL/line need not equal HEAD."
        },
        {
          "legacy": "lib/db/calendar/inviteStates.ts:42",
          "table": "message_calendar_events",
          "current_matching_operation_lines": [
            42
          ],
          "note": "Current table/operation counterpart found; frozen SQL/line need not equal HEAD."
        },
        {
          "legacy": "lib/db/calendar/events.ts:183",
          "table": "calendar_participation_overrides",
          "current_matching_operation_lines": [
            183
          ],
          "note": "Current table/operation counterpart found; frozen SQL/line need not equal HEAD."
        },
        {
          "legacy": "lib/db/calendar/conflicts.ts:122",
          "table": "calendar_event_conflicts",
          "current_matching_operation_lines": [
            122
          ],
          "note": "Current table/operation counterpart found; frozen SQL/line need not equal HEAD."
        }
      ]
    },
    "3": {
      "status": "verified",
      "evidence": [
        "schema.ts:976-998 owns one outer immediate transaction for pre-v3 additive initialization and historical key/FTS conversion. Pre-v2 FK OFF occurs before BEGIN and restores in finally; ordinary v2 retains FK ON. accountKeys.ts:230 accepts the outer transaction instead of nesting. The two runtime installers accept inTransaction=true and WeakSet readiness publishes only after commit.",
        "An instrumented fresh initialization observed one transaction() call and zero nested calls. accountKeys/ftsIdentity focused tests cover v0/v1/v2, rollback, custom indexes/triggers, provenance columns, FK restoration and idempotence.",
        "Incomplete declared-v3 schemas explicitly fail before additive recreation (shardFormat.ts:75-78). This is acceptable for process-crash rollout: every pre-commit SIGKILL recovered complete v2 via WAL and retried once; post-commit death left complete v3. An incomplete committed v3 shape indicates pre-existing/manual/storage corruption, not a normal interrupted migration. It requires stopped-backup restore or a separately reviewed atomic repair; there is no repair CLI or downgrade. The handoff describes this distinction but the full backup/runbook is missing (P2)."
      ]
    },
    "4": {
      "status": "verified",
      "evidence": [
        {
          "point": "side-table",
          "signal": "SIGKILL",
          "recovered": "identical v2",
          "retry": {
            "migrated": true,
            "droppedFtsOrphans": 0
          }
        },
        {
          "point": "population",
          "signal": "SIGKILL",
          "recovered": "identical v2",
          "retry": {
            "migrated": true,
            "droppedFtsOrphans": 0
          }
        },
        {
          "point": "guards",
          "signal": "SIGKILL",
          "recovered": "identical v2",
          "retry": {
            "migrated": true,
            "droppedFtsOrphans": 0
          }
        },
        {
          "point": "before-version",
          "signal": "SIGKILL",
          "recovered": "identical v2",
          "retry": {
            "migrated": true,
            "droppedFtsOrphans": 0
          }
        },
        {
          "point": "after-version",
          "signal": "SIGKILL",
          "recovered": "identical v2",
          "retry": {
            "migrated": true,
            "droppedFtsOrphans": 0
          }
        },
        {
          "point": "after-commit",
          "signal": "SIGKILL",
          "recovered": "v3",
          "retry": {
            "migrated": false,
            "droppedFtsOrphans": 0
          }
        },
        {
          "exit": 137,
          "output": "population-start\n",
          "killed_ms_after_population_start": 25,
          "recovered_version": 2,
          "old_fts_count": 11000,
          "retry": {
            "migrated": true,
            "droppedFtsOrphans": 0
          }
        },
        "Independently ran the actual child worker at all four required points plus after-version/before-commit and after-commit. The first five compared complete schema/version/table snapshots and recovered identical v2. The 11k-row worker was killed by its exact PID 25 ms after entering the production FTS INSERT; no population-finished message was emitted, v2/11000 old FTS rows recovered and retry validated."
      ]
    },
    "5": {
      "status": "verified",
      "evidence": [
        "Focused connection.collab/ftsIdentity tests prove healthy v3 initialization and the full getAccountDb cold-reader path complete under another connection holding BEGIN IMMEDIATE without schema changes or write retry.",
        {
          "uncommitted_new_reader_version": 2,
          "uncommitted_identity_table_visible": false,
          "held_reader_snapshot_survives_commit": true,
          "staleRead": "no such column: message_fts_v2",
          "staleWrite": "no such function: noctua_writer_v3",
          "migration_transaction_calls": 1,
          "nested_transaction_calls": 0
        },
        "A reader first opened during the uncommitted side-table stage saw version 2, no identity table and consistent old FTS hits. A held v2 read transaction continued to see its old snapshot after commit. After ending that snapshot an old MATCH statement failed explicitly (views do not support old MATCH); the v3 MATCH returned the same hit set. A v2-only stale writer failed with missing noctua_writer_v3. Mixed binaries are unsupported, not silently downgraded."
      ]
    },
    "6": {
      "status": "verified",
      "evidence": [
        "An exact git archive of 9424150 under .tmp/base, with its own schema/connection modules and shared installed dependencies, opened the migrated synthetic shard.",
        "configure: Account shard format 3 is newer than supported format 2\ninitialize: Account shard format 3 is newer than supported format 2\nmarker: absent\n",
        "Neither its configuration nor its direct initializer accepted v3 or registered the v2 marker. No version reset or tracked checkout change was used."
      ]
    },
    "7": {
      "status": "verified",
      "evidence": [
        "scripts/checkShardMessageCollisions.ts:10-15 remains readonly and reports shardVersion/ftsOrphanCount before initialization. Synthetic collision IDs were present in two accounts, plus two cross-owned/missing-message orphan FTS rows. CLI snapshots were unchanged; result was version 2, orphan count 2 and sharedMessageIdCount 1.",
        {
          "migrated": true,
          "droppedFtsOrphans": 2
        },
        [
          "[shard-format-v3] dropped 2 orphan FTS rows"
        ],
        [
          {
            "ftsRowid": 1,
            "accountId": "a",
            "messageId": "same"
          },
          {
            "ftsRowid": 2,
            "accountId": "b",
            "messageId": "same"
          }
        ],
        "ftsIdentity.ts:39-45 populates only canonical messages in BINARY(accountId,id) order, deliberately independent of old FTS/message rowids. Focused regression also covers duplicated and missing old FTS entries, unchanged message rows and zero dropped orphans on retry."
      ]
    },
    "8": {
      "status": "verified",
      "evidence": [
        "11,000 canonical messages, 11,000 attachment metadata rows and payload files, 11,000 synthetic raw-source files with recorded SHA-256; two accounts share local/RFC/thread/attachment IDs, with collision-suffixed local IDs. The body is 3900 characters plus matching HTML. Half of sender keys are NULL. Old FTS rowids start at message rowid+500000.",
        "84 ordered SQL MATCH/account/thread comparisons (14 fixed term/phrase/prefix/column/Boolean/Unicode cases x 3 account scopes x 2 thread scopes) matched. Another 92 comparisons used exact archived baseline application query.ts with only physical-table constant and injected DB/own-address dependencies changed; current query.ts is byte-identical to baseline. Message/thread/related lists, page/group cases matched, including four identical pre-existing alpha OR needle syntax errors.",
        "Every messages-column canonical SHA-256 matched across migration: fc965c46ee9c6de3b418f50fde08bba73f59a60eafff66a31e3da8732d3e9581",
        "Large-shard production upsert/update, folder/account replacement, single/batch/prefix delete all maintained three-way bijection and the other account hash. Repeated updates preserved identity, replacement allocated a new identity, and old tokens disappeared. Mutation counts follow."
      ],
      "large_mutation_states": {
        "states": [
          {
            "label": "initial",
            "messages": 11000,
            "identities": 11000,
            "fts": 11000
          },
          {
            "label": "existing upsert",
            "messages": 11000,
            "identities": 11000,
            "fts": 11000
          },
          {
            "label": "repeat existing upsert",
            "messages": 11000,
            "identities": 11000,
            "fts": 11000
          },
          {
            "label": "folder replacement",
            "messages": 7336,
            "identities": 7336,
            "fts": 7336
          },
          {
            "label": "single delete",
            "messages": 7335,
            "identities": 7335,
            "fts": 7335
          },
          {
            "label": "batch delete",
            "messages": 7334,
            "identities": 7334,
            "fts": 7334
          },
          {
            "label": "account replacement",
            "messages": 5501,
            "identities": 5501,
            "fts": 5501
          },
          {
            "label": "folder prefix delete",
            "messages": 5500,
            "identities": 5500,
            "fts": 5500
          }
        ],
        "other_account_hash_before": "57dfc5796300e83e4ecda3eb5b7e5785d14006cd173f7faa58d90c7829791f6b",
        "other_account_hash_after": "57dfc5796300e83e4ecda3eb5b7e5785d14006cd173f7faa58d90c7829791f6b",
        "newtoken_hits_after_delete": 0
      }
    },
    "9": {
      "status": "verified",
      "evidence": [
        "Bun 1.4.4 / SQLite 3.53.4 / Linux arm64, commands nice -n 10. Shared-host contention was present (observed load 13.43/9.33/8.70 during verification). Timing claims are fixture-specific and exact handoff absolute timings were not reproduced.",
        "200 FTS-only deletes: median v2 2340.659 ms -> v3 5.732 ms. Existing-message production 47-binding SQL UPSERT plus FTS maintenance: median 11.834 -> 0.288 ms. One warmup, 5 delete and 15 upsert samples, immediate transaction/rollback restoration; source/network/whole-sync work excluded. Validated production map+FTS rebuild including views and guards: median 968.888 ms over three rollback samples.",
        "Three fresh-process, committed 11k migrations: 2030.265/2967.126/2890.239 ms. Parent sampled WAL every 2 ms; child also measured its retained post-commit WAL. Peak was 56027912 bytes in all three runs. RSS immediately after migration was 226766848/219537408/221761536 bytes. Configured page-cache target was 32768 KiB; resident SQLite-cache bytes are not exposed by the public bun:sqlite API and were not separately measured.",
        "Compact main file 153776128 bytes -> 207552512 bytes after migration, 50672 x 4096-byte pages with 13431 reusable free pages. Observed incremental main growth plus WAL is 109804296 bytes (about 104.7 MiB), excluding backups, sources and other shards; this is an observed envelope, not a guaranteed bound. A stopped preview with ~11k plus a small fixture fits a short maintenance window on this evidence, allowing several seconds for migration and additional startup/backup/verification time. Do not promise a one-second startup or extrapolate to larger production shards."
      ]
    },
    "10": {
      "status": "verified",
      "evidence": [
        "All sentences of the handoff audit-semantics statement checked: composite account/message/thread keys and ownership predicates retained; discovered-table BEFORE guards retain missing-function and runtime wrong-version rejection; v2 stays 2 while v3 is 3; configureAccountDb and separately configured membership cleanup keep their old lifecycle and absent/partial-collaboration behavior.",
        "Both old FTS names are read-only views. Physical FTS/shadow arbitrary-SQL protection is explicitly excluded, consistently with the S1/S2 contract.",
        "Messages columns and NULL/known senderKey/sourceSha256 values survive unchanged. Migration does not open raw sources or invoke sender backfill. Exact-source plus matching-digest provenance in senderKey.ts and retrieval remains byte-identical; independent full-column hashes and S3/browser gates agree. users.uiLocale remains in master schema.",
        "git diff 9424150..c819806 confirms connection.ts, query.ts, retrieval.ts, senderKey.ts, auth/sync/parser/storage/UI production code and bun.lock unchanged. Seventeen files, three commits. The only semantic exceptions are the three declared choices: additive initialization in the outer migration transaction, explicit failure instead of automatic repair, and physical-table constant re-export. The reader-marker observation is inherited behavior, not an additional v3 audit-semantic change.",
        "Lockfile blob is identical at base and reviewed commit: 2ee737cd99a00af5a80bcef216fe7ab224830e6c. git diff --check 9424150..c819806 passes."
      ]
    },
    "11": {
      "status": "verified",
      "evidence": [
        "typecheck: 0 errors in 1177 files (no generated .next file in this review checkout). CI: 2778 unit + 433 DOM, zero failures. Focused: 185 tests / 1485 assertions across 23 sender/provenance/collab/shared-shard/migration files (178/20 plus 7/3 supplemental). Privacy: 1 headless test / 177 assertions, zero failures. Stress: 8334 pass / 0 fail, 34494 assertions, 301 files, 1346.81 seconds; seed 1337, rerun-each=3.",
        "All scratch/fixtures were routed under worktree .tmp via TMPDIR and isolated NOCTUA_DATA_DIR. Browser test ran a copy under .tmp/browser with only 3798/3799 -> 3893/3894 substituted; tracked test files were never changed. Repository Playwright workflow was used."
      ]
    },
    "12": {
      "status": "verified",
      "evidence": [
        "git merge-tree --write-tree c819806 origin/feat/sender-identities-2 at 781b4b2 reports one upsert.ts hunk and a drafts.ts conflict. The five other supplied dependency/follow-up heads merge cleanly. Results below are for these exact fixed heads, not the pending sender fix round 4.",
        "upsert.ts merged-artifact lines 713-787: v3 side retains staging rollback/cleanup around shard .immediate(); sender side adds prepareOutboundWrite, assertCurrent and replaceDraftId deletion. The localized v3 import/preparation/lookup/insert hunks otherwise auto-merge. Preserve all of them, including mapping-before-every-FTS-insert and FTS-before-message-delete for duplicate, scope and replaced-draft paths.",
        "781b4b2 still wraps the shard transaction in the master authorizedWrite, contrary to the announced pending fix. Integrate the actual fix-round-4 shard-writer-first structure and keep a master immediate boundary around assertCurrent plus synchronous DML body; preserve shard rollback/file restoration, final collision IDs, missing-map errors only for surviving rows, source metadata and event publication after commit. Deleted replacement snapshots may legitimately need new mappings. Re-run integrated sender/draft/FTS tests and merge-tree after that new head; this review does not certify an unbuilt conflict resolution."
      ]
    },
    "13": {
      "status": "finding",
      "evidence": [
        "P2: current handoff provides startup timing, one-way/restore-only rollback, process-crash retry and no-power-loss-guarantee, but omits the requested complete stopped-backup checklist, ordered start-and-verify steps and explicit shared-legacy resync note. See deploy_handoff_gaps."
      ]
    }
  },
  "measurements": {
    "migration_ms": [
      2030.265,
      2967.126,
      2890.239
    ],
    "wal_peak_bytes": 56027912,
    "rss_after": [
      226766848,
      219537408,
      221761536
    ],
    "deletes_200_ms": 5.732,
    "upsert_existing_ms": 0.288,
    "rebuild_ms": 968.888,
    "baseline_deletes_200_ms": 2340.659,
    "baseline_upsert_existing_ms": 11.834,
    "rebuild_samples_ms": [
      907.598,
      971.664,
      968.888
    ],
    "cache_configured_kib": 32768,
    "resident_sqlite_cache_bytes": null,
    "main_file_before_bytes": 153776128,
    "main_file_after_bytes": 207552512,
    "limitations": "Synthetic text/shared-host measurements; fresh-process migration timing includes validation and commit but excludes configuration/fixture generation; RSS is process RSS, not solely SQLite cache. No 300k or power-loss claim."
  },
  "search_equivalence": {
    "queries": 176,
    "sql_queries": 84,
    "application_comparisons": 92,
    "differences": [],
    "matching_baseline_errors": [
      {
        "method": "listMessages",
        "params": {
          "accountId": "first",
          "query": "alpha OR needle",
          "page": 1,
          "pageSize": 50
        },
        "error": "fts5: syntax error near \"OR\""
      },
      {
        "method": "listThreads",
        "params": {
          "accountId": "first",
          "query": "alpha OR needle",
          "page": 1,
          "pageSize": 50
        },
        "error": "fts5: syntax error near \"OR\""
      },
      {
        "method": "listMessages",
        "params": {
          "accountId": "second",
          "query": "alpha OR needle",
          "page": 1,
          "pageSize": 50
        },
        "error": "fts5: syntax error near \"OR\""
      },
      {
        "method": "listThreads",
        "params": {
          "accountId": "second",
          "query": "alpha OR needle",
          "page": 1,
          "pageSize": 50
        },
        "error": "fts5: syntax error near \"OR\""
      }
    ],
    "message_columns_sha256_before": "fc965c46ee9c6de3b418f50fde08bba73f59a60eafff66a31e3da8732d3e9581",
    "message_columns_sha256_after": "fc965c46ee9c6de3b418f50fde08bba73f59a60eafff66a31e3da8732d3e9581"
  },
  "gates": {
    "typecheck": {
      "exit_code": 0,
      "errors": 0,
      "files": 1177
    },
    "test_ci": {
      "exit_code": 0,
      "unit_pass": 2778,
      "unit_fail": 0,
      "unit_assertions": 11498,
      "unit_seconds": 453.93,
      "dom_pass": 433,
      "dom_fail": 0,
      "dom_assertions": 2552,
      "dom_seconds": 76.34
    },
    "test_stress": {
      "exit_code": 0,
      "pass": 8334,
      "fail": 0,
      "assertions": 34494,
      "files": 301,
      "seconds": 1346.81,
      "seed": 1337,
      "rerun_each": 3
    },
    "focused": {
      "exit_code": 0,
      "pass": 185,
      "fail": 0,
      "files": 23,
      "assertions": 1485,
      "seconds": 50.27,
      "runs": [
        {
          "pass": 178,
          "files": 20,
          "assertions": 1449,
          "seconds": 47.85
        },
        {
          "pass": 7,
          "files": 3,
          "assertions": 36,
          "seconds": 2.42
        }
      ],
      "html_privacy": {
        "exit_code": 0,
        "pass": 1,
        "fail": 0,
        "assertions": 177,
        "seconds": 66.09,
        "ports": [
          3893,
          3894
        ]
      }
    }
  },
  "merge_tree": {
    "origin/feat/sender-identities-2": {
      "head": "781b4b2",
      "exit_code": 1,
      "tree": "21d9e739be735e476ab9805a0f3ccf541f865d37",
      "conflicts": [
        "lib/db/messages/upsert.ts",
        "lib/drafts.ts"
      ],
      "upsert_conflict_hunks": [
        {
          "merged_artifact_lines": "713-787",
          "v3_side": "Shard immediate transaction with file rollback and finally cleanup.",
          "sender_side": "prepareOutboundWrite wrapper, assertCurrent and replaceDraftId deletion.",
          "required_resolution": "Keep v3 identity preparation/lookup/insert and file safety wrappers; adopt the pending sender fix shard-writer-first/master-body boundary; delete FTS before deleting draft/messages; map before FTS insert; publish after shard commit."
        }
      ]
    },
    "origin/chore/deps-nodemailer-mcp": {
      "head": "bd92941",
      "exit_code": 0,
      "tree": "4a5060a4561e6967266afecb03bad997cc184303",
      "conflicts": []
    },
    "origin/chore/deps-imapflow2": {
      "head": "ac566eb",
      "exit_code": 0,
      "tree": "9591c97510cf14b007615abf5b2f06f7e5c71826",
      "conflicts": []
    },
    "origin/chore/deps-sharp": {
      "head": "b3ad724",
      "exit_code": 0,
      "tree": "bd450f9233a0c6f1b3fcb92ffcfa88a5545229f9",
      "conflicts": []
    },
    "origin/fix/launcher-log-redaction": {
      "head": "3766c92",
      "exit_code": 0,
      "tree": "bec7cf1618b8a1cd0bd910425750bc3cb41ccc01",
      "conflicts": []
    },
    "origin/fix/post-r6-followups": {
      "head": "81ce731",
      "exit_code": 0,
      "tree": "d25a2ca9f2fa6cc0a9e97426abbd4426e7d1fc10",
      "conflicts": []
    }
  },
  "deploy_handoff_gaps": [
    "Explicit stop -> backup -> inventory -> start merged binary -> verify sequence, with all clients/workers/scripts stopped.",
    "Consistent complete backup/restore inventory: master, every mapped shard, surviving WAL/SHM, key configuration and retained file data; validate the backup before startup migration and retain the exact pre-upgrade binary/data pairing.",
    "Post-start schema/version/81-guard/two-view, bijection/FTS integrity, scoped-search and sender/provenance/privacy checks with expected outcomes.",
    "Historically shared pre-account-key shards require resync of every mapped account even when current collision counts are zero; rebuilding FTS cannot restore messages already lost under legacy keys. Unknown legacy senders remain unknown until owned/digest-verified source or authoritative resync.",
    "Add measured WAL/RSS/disk headroom and conservative maintenance timing from this review, retaining the synthetic/process-crash-only limits."
  ],
  "cleanup": {
    "tracked_files_unchanged": true,
    "tmp_removed": true,
    "ports_free": true,
    "report": "/home/monkey/code/noctua-mail/briefs/perf-fts-identity-v3-review-r1.md",
    "tracked_file_edits_during_review": false,
    "notes": "All probes/copies/synthetic data were under the review worktree .tmp and removed. Browser port changes were made only in a scratch copy. No commits, pushes, server deployment or changes to other worktrees/data."
  }
}
```
