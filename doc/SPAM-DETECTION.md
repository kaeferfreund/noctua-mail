# Spam detection

New INBOX mail is classified once by a small language model (default
`claude-haiku-5-5` via the Vercel AI SDK) that learns from the users' own
"Als Spam" / "Kein Spam" decisions. Phase 1 only marks: a message the model
calls spam with enough confidence gets the "Verdächtig" badge and appears in the
"Verdächtig" view. Moving it to Junk automatically is a per-mailbox setting,
off by default.

Code: `lib/mail/spam/` (`service.ts` wiring, `classifySpam.ts`, `input.ts`,
`allowlist.ts`, `staticRules.ts`, `examples.ts`, `queue.ts`, `config.ts`,
`settings.ts`, `provider.ts`), storage in `lib/db/spam.ts`.

## Pipeline

1. **Trigger.** Every successful sync job (any mode, including the IMAP IDLE
   watcher's repair sync) calls `scheduleSpamSweep(accountId)` in the server
   process (`lib/syncJobs.ts`). The sweep takes the 50 oldest INBOX rows of the
   last 3 days with `spamCheckedAt IS NULL` that are not already queued or
   claimed, and claims only those once per process (24 h memory, so a failed or
   undecided message is not retried by the next sweep; the rest of a backlog is
   picked up by the next sweeps). Mailboxes with their own switch off are
   skipped before any data is read.
   Sync never waits: the queue runs in the background with concurrency 2.
2. **Skip.** Only messages still in the INBOX are checked; anything moved to
   Junk, Trash, Sent or Drafts meanwhile is skipped.
3. **Input** (`input.ts`): From, Reply-To, To, Subject, Date, List-Id,
   List-Unsubscribe, the top-most `Authentication-Results` block and the first
   `X-Spam-*` headers (the receiving server's verdicts), the domains of all
   links, attachment names/types and the plain text without quoted replies,
   capped at 4,096 characters. No raw HTML. Without a stored source the message
   row is used.
4. **Hard allowlist** (`allowlist.ts`, never spam): enrolled mailbox and
   identity addresses and the household's own domains (free-mail domains
   excluded) — only when SPF or DKIM passed for that domain, because forged
   own-domain senders exist in the corpus —, addresses the mailbox has written
   to (exact To/Cc/Bcc of its Sent folder), and senders whose latest decision is
   "Kein Spam" (a later "Als Spam" lifts the correspondent entry).
   A sender whose latest decision is "Als Spam" also skips the static allow
   rules below; the model decides with that decision among the examples.
5. **Static rules** (`staticRules.ts`, file below): allow `address`/`domain`
   rules short-circuit to ham (`requireAuth` rules only after SPF/DKIM pass);
   deny rules short-circuit to spam only with `safe: true`; all other matches,
   `builtin:*` features and the server's `X-Spam-Flag: YES` are passed to the
   model as hints. `name` entries never allow; a known display name from an
   unknown address is a weak hint only.
6. **Model** (`classifySpam.ts`): `generateText` with `Output.object` (the AI
   SDK 7 replacement of `generateObject`) and a Zod schema
   `{ verdict: "spam" | "ham" | "unsure", confidence: 0–1, reasons: string[] (≤ 5, German) }`,
   Anthropic `effort: "low"`, no SDK retries, 30 s timeout per call (a timeout
   is a failed attempt). Angle brackets in mail-derived text and examples are
   replaced by ‹ ›, so data cannot close the `<email>`/`<beispiele>` blocks.
   The prompt contains the 16 nearest user decisions (same sender address >
   same root domain > subject similarity > most recent, at least three of each
   label when available).
7. **Store.** `spamVerdict = "spam"` only when the model said spam with
   `confidence ≥ threshold` (default 0.85; per mailbox override); a spam verdict
   below the threshold is stored as `"unsure"`. Automatic results never
   overwrite a row that is already checked, so a user correction always wins.
8. **Auto-move** (optional per mailbox): marked messages are moved with the same
   code path as "Als Spam" (`app/api/_helpers/message/junkMove.ts`).

Failures (no key, 429, network, timeout, invalid model output) are retried at
most twice (after 5 s and 30 s), then dropped; the message stays unmarked. Each account
logs such failures at most once per 10 minutes. Without `ANTHROPIC_API_KEY` only
the allowlist and static rules decide; everything else stays unchecked.

## Learning from decisions

- "Als Spam" (`POST …/messages/:id/spam`, editor+) stores a spam example.
- "Kein Spam" (`POST …/messages/:id/not-spam`, editor+) stores a ham example and
  marks the moved message as ham.
- "Kein Spam" on a "Verdächtig" mark (`POST …/messages/:id/not-suspicious`,
  manager+) keeps the message in place, clears the mark and stores a ham example.

Examples live in the shard table `spam_examples` (sender, root domain, subject,
280-character unquoted snippet, label, source, user, time). The latest decision
per sender and subject replaces older ones; at most 2,000 per account are kept.

## Storage and migration

Additive, following the `senderKey` pattern (doc/HTML-MAIL-PRIVACY.md):

- account shard `messages`: nullable `spamVerdict TEXT`, `spamConfidence REAL`,
  `spamReasons TEXT` (JSON array), `spamCheckedAt INTEGER`, plus the partial
  index `idx_messages_account_spam (accountId, spamVerdict) WHERE spamVerdict IS NOT NULL`;
- account shard table `spam_examples` with three indexes. It is account-scoped,
  so it gets the v3 writer guards; on an existing v3 shard the table and its
  guards are created in one immediate transaction (`ensureSpamRuntimeSchema` in
  `lib/db/schema.ts`). `PRAGMA user_version` and the shard v2 key/guard contract
  are unchanged; the guard inventory grows from 27 to 28 tables;
- master table `spam_settings (scope, settings, updatedAt, updatedByUserId)`:
  scope `global` or an account id.

Existing rows start with NULL and are never backfilled; only mail newer than
three days at the first sweep is checked.

**Deploy:** this is a shard schema change. Follow the stopped-backup procedure of
doc/FTS-V3-MIGRATION.md §1–2 (stop all database clients, create and verify a
complete stopped backup) before the first start of this build, and verify
afterwards that every shard opens (`shardWriterGuardsInstalled`) and has the
`spam_examples` table. Rollback is the stopped-snapshot restore of §6.

## Configuration

| Setting | Where | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | env | unset → static-only |
| `NOCTUA_SPAM_PROVIDER` | env | `anthropic` |
| `NOCTUA_SPAM_MODEL` | env, admin setting overrides | `claude-haiku-5-5` |
| `NOCTUA_SPAM_THRESHOLD` | env, admin setting overrides | `0.85` (0.5–1) |
| `NOCTUA_SPAM_ENABLED` | env, admin setting overrides | off |
| `NOCTUA_SPAM_RULES_FILE` | env | `<data dir>/spam-static-rules.json` |
| on/off, auto-move, own threshold | per mailbox (admin) | on / off / global |

Admin UI: Verwaltung → Spam-Erkennung (`GET/PUT /api/admin/spam-settings`).
Per mailbox: Postfach-Einstellungen → Spam-Erkennung, visible to admins only
(`GET/PUT /api/admin/accounts/:accountId/spam-settings`). Another provider (for
example a local OpenAI-compatible server) is one more case in `provider.ts`.

## Static rules file

`briefs/spam/static-rules.json` (derived from the dev corpus, report in
`briefs/spam/static-rules-report.md`) contains personal addresses and is not
part of the repository. Copy it to `<data dir>/spam-static-rules.json` (mode
600) or point `NOCTUA_SPAM_RULES_FILE` at it. It is re-read when its mtime or
size changes. A missing or invalid file means no static rules; unknown fields
and unknown `builtin:*` values are ignored.

## Evaluation

Read-only (SQLite `immutable=1`), never writes to the data dir:

```sh
bun scripts/spam-eval.ts --data /path/to/noctua-data \
  --sample briefs/spam/eval-sample.json --rules briefs/spam/static-rules.json
```

With `ANTHROPIC_API_KEY` set it calls the model for every undecided message
(~1,300 calls for the full sample; `--limit N` and `--concurrency N` help);
without it only the allowlist and static rules run. `--limit N` alone takes the
first N sample items, and the sample lists spam first, so a small limit
evaluates no ham. For a test run use `--limit 100 --stratified` (N/2 spam and
N/2 ham). The output lists precision, recall, decision sources, false positives
and spam passed by the allowlist by subject and sender only. Ham that the server already flagged (`serverSpamFlag`)
is reported separately from plain false positives. The static rules were derived
from the same corpus, so their precision there is optimistic.
