# Spam detection

New INBOX mail is classified once by a small language model (default
`claude-haiku-5-5` via the Vercel AI SDK) that learns from the users' own
"Als Spam" / "Kein Spam" decisions. Phase 1 only marks: a message the model
calls spam with enough confidence gets the "Verdächtig" badge and appears in the
"Verdächtig" view. Moving it to Junk automatically is a per-mailbox setting,
off by default.

Code: `lib/mail/spam/` (`service.ts` wiring, `classifySpam.ts`, `input.ts`,
`allowlist.ts`, `staticRules.ts`, `senderProfile.ts`, `anomaly.ts`,
`examples.ts`, `queue.ts`, `config.ts`, `settings.ts`, `provider.ts`; the
scripts' helpers `evalData.ts`, `profileBuild.ts`, `profileFile.ts`), storage
in `lib/db/spam.ts`.

## Pipeline

1. **Trigger.** Every successful sync job (any mode, including the IMAP IDLE
   watcher's repair sync) calls `scheduleSpamSweep(accountId)` in the server
   process (`lib/syncJobs.ts`). The sweep takes the 50 oldest INBOX rows of the
   last 3 days with `spamCheckedAt IS NULL` and fewer than three failed
   attempts that are not already queued or claimed, and claims only those once
   per process (24 h memory, so an undecided message is not retried by the next
   sweep; the rest of a backlog is picked up by the next sweeps). The window
   uses `dateValue` (the sender's Date header); a back-dated mail outside it is
   not checked, because the arrival time is not stored on the row. Mailboxes with their own switch off are
   skipped before any data is read.
   Sync never waits: the queue runs in the background with concurrency 2.
2. **Skip.** Only messages still in the INBOX are checked; anything moved to
   Junk, Trash, Sent or Drafts meanwhile is skipped.
3. **Input** (`input.ts`): From, Reply-To, To, Subject, Date, List-Id,
   List-Unsubscribe, the top-most `Authentication-Results` block and the first
   `X-Spam-*` headers (the receiving server's verdicts; values cut at 600
   characters, `X-Spam-Status` at 4,000 so its whole test list stays), the
   domains of all links, attachment names/types and the plain text without
   quoted replies, capped at 4,096 characters. A reply attribution or forward
   marker cuts the text only after 1,024 characters of own text, so a fake
   attribution line at the top cannot hide the body; `> ` lines always go. No
   raw HTML. The stored source is parsed as bytes, so 8-bit bodies are decoded
   by their MIME charset. Without a stored source the message row is used. For the sender profile only (never in the prompt): Cc,
   Message-ID, Auto-Submitted and links whose text names another domain.
4. **Hard allowlist** (`allowlist.ts`, never spam): enrolled mailbox and
   identity addresses and the household's own domains (free-mail domains
   excluded) — only when SPF or DKIM passed for that domain, because forged
   own-domain senders exist in the corpus —, addresses the mailbox has written
   to (exact To/Cc/Bcc of its Sent folder), and senders whose latest decision is
   "Kein Spam" by a manager of the mailbox (a later "Als Spam" lifts the
   correspondent entry; an editor's "Kein Spam" is an example for the model,
   not an allowlist entry). "Passed" counts only the identity the method
   authenticated (DKIM `header.d`/`header.i`, SPF `smtp.mailfrom`, inside the
   domain; never `smtp.helo`, selectors or comments). Correspondents and "Kein
   Spam" senders also need SPF or DKIM pass for the sender's domain whenever
   the receiving server wrote Authentication-Results, so a forged From of a
   known sender goes to the model; without any results they apply as before.
   A sender whose latest decision is "Als Spam" also skips the static allow
   rules below; the model decides with that decision among the examples.
5. **Static rules** (`staticRules.ts`, file below): allow `address`/`domain`
   rules short-circuit to ham (`requireAuth` rules only after SPF/DKIM pass,
   the others unless Authentication-Results exist without a pass for them);
   deny rules short-circuit to spam only with `safe: true`; all other matches,
   `builtin:*` features and the server's `X-Spam-Flag: YES` are passed to the
   model as hints. `name` entries never allow; a known display name from an
   unknown address is a weak hint only.
6. **Trusted sender** (`senderProfile.ts`, `anomaly.ts`, section below):
   a sender with enough authenticated history in the household skips the
   model (`trusted:profile`) unless the mail deviates from its pattern; then
   it goes to the model with the deviations as a hint and threshold 0.9. A
   user's latest "Als Spam" for the sender skips this step.
7. **Model** (`classifySpam.ts`): `generateText` with `Output.object` (the AI
   SDK 7 replacement of `generateObject`) and a Zod schema
   `{ verdict: "spam" | "ham" | "unsure", confidence: 0–1, reasons: string[] (≤ 5, German) }`,
   Anthropic `effort: "low"` without thinking (`thinking: disabled`; models
   that always think keep it within the budget), at most 4,096 output tokens,
   no SDK retries, 30 s timeout per call (a timeout is a failed attempt). The
   provider drops min/max/length bounds from the schema it sends, so they are
   applied after parsing: reasons are trimmed, cut to 160 characters and
   capped at five; a confidence outside 0–1 fails the attempt. An answer cut
   off at the token limit is a failed attempt (`SpamOutputTruncatedError`). Angle brackets in mail-derived text and examples are
   replaced by ‹ ›, so data cannot close the `<email>`/`<beispiele>` blocks.
   The prompt contains the 16 nearest user decisions (same sender address >
   same root domain > subject similarity > most recent, at least three of each
   label when available).
8. **Store.** `spamVerdict = "spam"` only when the model said spam with
   `confidence ≥ threshold` (default 0.85; per mailbox override; at least 0.9
   for trusted senders); a spam verdict below the threshold is stored as
   `"unsure"`. Automatic results never overwrite a row that is already
   checked, so a user correction always wins. Every saved non-spam result
   adds the mail to its sender's profile.
9. **Auto-move** (optional per mailbox): marked messages are moved with the same
   code path as "Als Spam" (`app/api/_helpers/message/junkMove.ts`).

Failures (429, overload, network, timeout, invalid or cut-off model output) are
retried at most twice (after 5 s and 30 s), then dropped; the message stays
unmarked. Rejections of the request itself (HTTP 400/401/403/404: bad key,
unknown model id) are not retried. Failed attempts are stored on the unchecked
row (`spamReasons = ["failed:<n>"]`, ignored without a verdict), so the limit of
three attempts also holds after a restart or once the 24 h claim expires; a
message at the limit is never queued again. Each account logs such failures at
most once per 10 minutes, with the error's name, code and HTTP status only
(never its message, which can quote the mail or the model output). Without
`ANTHROPIC_API_KEY` only the allowlist and static rules decide; everything else
stays unchecked.

## Caching

Every model call starts with the same system block, marked as an Anthropic
prompt-cache breakpoint (`cacheControl` `ephemeral`, TTL 1 h, set in
`provider.ts`): the instructions plus a rule catalogue from the static rules file
(the hint labels, the `builtin:*` features and the safe deny rules — strongest
first up to 4,000 characters, then grouped and sorted; no hit counts, no dates,
never allow rules). With the current rules file the block is about 3,000
characters (≈ 1,000 tokens; Haiku 5.5 caches from 512 tokens). It is built from
the rules only, once per rules file version (mtime/size), so it is byte-identical
across mails. Everything per mail comes after the breakpoint in the user message:
examples, rule hints, the mail last. The examples get no second breakpoint: their
order depends on the subject of each mail.

The 1 h TTL fits the traffic (a few dozen mails a day in bursts); a 5 min entry
would expire between most calls. A cache write costs 2× input, a read 0.1×, so
the prefix pays off from the third call within an hour. A changed rules file
starts a new entry.

Reading the hit rate: each model call logs `[spam] model call` at debug level
with `inputTokens` (total), `cacheReadTokens`, `cacheWriteTokens` and
`outputTokens` from the AI SDK's `usage` (no content). After a sweep's jobs are
done, `[spam] sweep done` sums them per account and adds `cacheHitRate` (cache
read ÷ all input tokens). `scripts/spam-eval.ts` prints the totals, the hit
rate, how many calls read the cache and a cost estimate from `SPAM_MODEL_PRICES`
in `config.ts`. Mostly `cacheWriteTokens` and no reads means the prefix changes
between calls; zero for both means it is below the model's minimum. The first
calls of an eval run with `--concurrency` > 1 all write, because none of them can
read an entry that is not written yet.

## Trusted senders

Concept: briefs/spam/trusted-sender-concept.md (user decisions of 2026-10-24:
20 mails / 30 days / 2 % canary, no curated service list, household-wide
profiles). Trust belongs to one sender address, is earned by history, needs
authentication and holds only while a mail matches the sender's pattern.

**Profile** (`senderProfile.ts`, shard table `spam_sender_profiles`, one row
per account and sender address): number of mails, first/last mail, last "Als
Spam", mails in Junk folders, how many passed SPF or DKIM aligned with the From
domain, DKIM domains, a histogram of To+Cc counts, how often the mailbox was
addressed directly, Reply-To domains, link root domains (at most 150, then
"overflow"), masked links, attachment types, German/English by stop words,
subject prefixes (`[tag]`, text before `:` or the first word, digits as `#`),
lexicon categories, List-Id/List-Unsubscribe/Auto-Submitted and Message-ID
domains. Rows of Sent, Drafts and Trash never count; Junk rows only count as
junk. A mail after more than 180 days of silence starts the history over.

**Alignment**: only the identity a method authenticated counts — DKIM
`header.d` (else the domain of `header.i`), SPF `smtp.mailfrom`. Selectors
(`header.s`), `smtp.helo`, comments and any other `x.y=` token never align. A
domain is aligned when it is the organisational domain of the From domain or a
subdomain of it; `getRootDomain` knows multi-label public suffixes
(`lib/publicSuffixes.ts`: co.uk, com.au …), so `attacker.co.uk` is not aligned
with `bank.co.uk`. No Authentication-Results counts as not aligned.

**Time**: first and last mail are arrival times — the date of the top-most
`Received` header, which the receiving server stamps (the sender can only add
headers below it). The sender's `Date` header (also what `dateValue` stores)
never counts. Without a Received stamp the server takes the check time; the
backfill and the eval take `dateValue`, which only affects rows without a stored
source (they have no authentication results either, so they cannot make a
sender trusted). Arrival times in the future are capped at now.

**Household view**: the profiles of the same address in all mailboxes are
merged (counts and patterns add up, earliest first mail, latest "Als Spam";
mailboxes silent for 180 days contribute only their "Als Spam").

**Trusted** when the merged profile has at least 20 mails over at least 30
days, at least 95 % aligned authentication, no "Als Spam" ever, a mail within
the last 180 days and at most 5 % of its mail in Junk folders.

**Anomaly gate** (`anomaly.ts`, one pure function per rule; any hit sends the
mail to the model):

| Rule | Fires when |
|---|---|
| Recipients | To+Cc > max(5, 3 × the sender's 95th percentile); mailbox only in Bcc although ≥ 90 % of the history addressed it directly; ≥ 3 different outside recipient circles from the sender within an hour |
| Reply-To | first Reply-To (other than From) of this sender; a new root domain other than the From domain |
| Authentication | no aligned SPF/DKIM pass on this mail; SPF fail/softfail; no Authentication-Results; DKIM domain new or missing although ≥ 50 % of the history was signed |
| Links | IP links (loopback/private excluded); new shortener or file-share domains; any new link root domain (unless the profile overflowed); link text naming another domain when < 20 % of the history does |
| Attachments | html/zip/rar/7z/iso/img/lnk/js/vbs/macro Office/svg/executables always; PDF when < 5 % of the history had attachments or with payment words in the subject |
| Content | credential/payment/urgency words the sender uses in < 20 % of its mail; changed bank details always; language switch against ≥ 90 % of ≥ 10 recognised mails; subject outside the fixed prefixes (top 3 cover ≥ 90 %) |
| Service marks | List-Id/Auto-Submitted missing although ≥ 95 % had them; Message-ID domain new although one domain covers ≥ 95 % |
| Server verdict | `X-Spam-Flag: YES` or SpamAssassin score ≥ 3 |

The model gets one hint line: `Vertrauter Absender (23 Mails seit 2026-03,
DKIM github.com); Abweichung: …`, explained in the cached rule catalogue, and
the stricter threshold 0.9. Static rules keep their precedence: a static allow
or a safe deny decides before the profile.

**Skip**: `spamVerdict = "ham"`, `spamReasons = ["trusted:profile (23 Mails seit
2026-03, DKIM github.com)"]`. **Canary**: 2 % of the skips (FNV-1a hash of the
message id) still go to the model, without any trust hint; their reasons start
with `trusted:canary (…)`. When the model does not say ham the server logs
`[spam] canary mismatch` (account, message id, verdict, confidence; no content).

**Learning and revocation**: each saved check with the result ham adds the mail
to the mailbox's profile (spam and unsure results never do) (once per message, as `spamCheckedAt` is set once). "Als
Spam" by a user (`POST …/messages/:id/spam`) sets the profile's `lastUserSpamAt`
(a household-wide revocation through the merge) and resets the sender's INBOX
rows of the last 7 days in every mailbox that were skipped as trusted; they are
queued for a new check. Moves by `scripts/spam-apply.ts` do not revoke.

**Admin**: Verwaltung → Spam-Erkennung shows one read-only line "Vertraute
Absender: n ohne Modell übersprungen, n Stichproben, davon n abweichend"
(totals; per mailbox in the tooltip and in `GET /api/admin/spam-settings` →
`trust`), counted from the stored `spamReasons`.

**Backfill**: existing rows enter the profiles once with
`scripts/spam-profiles-backfill.ts` (one pass per shard, only the first 64 KB of
each source for the header block and attachment names; about 40 s for 87,000
rows on the dev data). Stored "Als Spam" decisions (`spam_examples`, label
spam) become `lastUserSpamAt`, so they revoke trust household-wide like new ones.
`--data <dir> [--out profiles.json]` is the default dry run: read-only
(`mode=ro`), it prints the plan per account. `--data <dir> --write` replaces
each account's profiles over the app's DB layer in one transaction, keeping
stored "Als Spam" times. The data dir always comes from `--data` (never from
`NOCTUA_DATA_DIR`/.env.local), `--help` prints the usage, unknown options are
errors, and shards without the spam schema are refused (the deployed app
creates it under the runbook). Run it once with `--write` after the deploy of
this build. Without the backfill only mail checked from then on builds
profiles, and nobody is trusted for weeks.

**Eval** (`spam-eval --trust-profiles [file]`): the file holds every counted
mail's facts per sender (version 2; older files are rejected). A mail is judged
as of its arrival with the household profile of the mails that arrived before
it — never with itself or later mail — so the "first seen" rules fire as they
would have on arrival.

## Learning from decisions

- "Als Spam" (`POST …/messages/:id/spam`, editor+) stores a spam example.
- "Kein Spam" (`POST …/messages/:id/not-spam`, editor+) stores a ham example and
  marks the moved message as ham.
- "Kein Spam" on a "Verdächtig" mark (`POST …/messages/:id/not-suspicious`,
  manager+) keeps the message in place, clears the mark and stores a ham example.

Examples live in the shard table `spam_examples` (sender, root domain, subject,
280-character unquoted snippet, label, source, user, time). The latest decision
per sender and subject replaces older ones; at most 2,000 per account are kept,
plus each sender's latest decision when it is "Kein Spam" (it carries the
sender's allowlist entry, so the cap never drops it). A "Kein Spam" allowlists
the sender only when its author is a manager of the mailbox at check time;
editors' marks (buttons or moves out of Junk) teach the model as examples.

### Lernen beim Verschieben

Folder moves teach the same way as the buttons (`lib/mail/spam/moveLearning.ts`,
`learnFromMessageMove`): a move whose destination is the account's Junk folder
(`findJunkFolder` / `isSpamFolder`, so `INBOX.Spam` and the like count too)
stores a spam example with source `move-junk` and revokes the sender's trust
like "Als Spam"; a move out of Junk to a folder that is neither Junk nor Trash
stores a ham example with source `move-from-junk` and clears the "Verdächtig"
mark like "Kein Spam". Junk → Trash and moves between two non-Junk folders
record nothing. The helper runs once per message after the IMAP move and the
local relocation succeeded — in the move queue behind `POST …/messages/move`
(move dialog, drag & drop, keyboard, whole-thread and bulk moves, undo) and in
the archive route — with the acting user; a rolled-back move teaches nothing.
Roles follow the move routes (editor+), so viewers cannot teach by moving.
System moves never pass through it: the classifier's auto-move, the move of
`scripts/spam-apply.ts` and sync relocations store their own example or none,
and the explicit spam/not-spam routes keep their own recording — each message
gets one example per decision. A repeated call for the same move replaces the
sender+subject entry instead of adding one.

## Storage and migration

Additive, following the `senderKey` pattern (doc/HTML-MAIL-PRIVACY.md):

- account shard `messages`: nullable `spamVerdict TEXT`, `spamConfidence REAL`,
  `spamReasons TEXT` (JSON array), `spamCheckedAt INTEGER`, plus the partial
  index `idx_messages_account_spam (accountId, spamVerdict) WHERE spamVerdict IS NOT NULL`;
- account shard tables `spam_examples` (three indexes) and
  `spam_sender_profiles` (primary key accountId + senderKey). Both are
  account-scoped, so they get the v3 writer guards; on an existing v3 shard
  missing tables and their guards are created in one immediate transaction
  (`ensureSpamRuntimeSchema` in `lib/db/schema.ts`). `PRAGMA user_version` and
  the shard v2 key/guard contract are unchanged; the guard inventory grows from
  27 to 29 tables (87 triggers);
- master table `spam_settings (scope, settings, updatedAt, updatedByUserId)`:
  scope `global` or `account:<accountId>` (rows under the bare account id
  from earlier builds are still read and move to the prefixed key on the next
  save). Every save writes an admin-log entry `spam_settings.update` with the
  previous and the new settings (target mailbox for per-mailbox saves).

Existing rows start with NULL and are never backfilled; only mail newer than
three days at the first sweep is checked.

**Deploy:** this is a shard schema change. Follow the stopped-backup procedure of
doc/FTS-V3-MIGRATION.md §1–2 (stop all database clients, create and verify a
complete stopped backup) before the first start of this build, and verify
afterwards that every shard opens (`shardWriterGuardsInstalled`) and has the
`spam_examples` and `spam_sender_profiles` tables. Rollback is the stopped-snapshot restore of §6.

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
and unknown `builtin:*` values are ignored. `header` rules (`"Name: regex"`)
see only Authentication-Results (the receiving server's block), the first
X-Spam-* of each name, List-Id, List-Unsubscribe, Reply-To and Message-ID;
rules on other header names never match.

## Evaluation

Read-only (SQLite `mode=ro`), never writes to the data dir. It reads the WAL
of a live data dir, so it can run while the service writes; a long run only
delays the service's WAL checkpoints:

```sh
bun scripts/spam-eval.ts --data /path/to/noctua-data \
  --sample briefs/spam/eval-sample.json --rules briefs/spam/static-rules.json
```

With `ANTHROPIC_API_KEY` set it calls the model for every undecided message
(~1,300 calls for the full sample; `--limit N` and `--concurrency N` help);
without it only the allowlist and static rules run. `--limit N` takes a seeded
random sample of N items, so spam and ham keep their share of the full sample;
`--limit 100 --stratified` takes N/2 spam and N/2 ham. The output lists precision, recall, decision sources, false positives
and spam passed by the allowlist by subject and sender only. Ham that the server already flagged (`serverSpamFlag`)
is reported separately from plain false positives. The static rules were derived
from the same corpus, so their precision there is optimistic.

`--trust-profiles [profiles.json]` builds the household sender profiles from
the data dir first (read-only, about 40 s for 87,000 rows; with a file it is
read from there when it exists, otherwise built and written there) and applies
trusted senders with the anomaly gate before the model. Trust is judged as of
each mail's own date, as the server would have at its arrival; the profiles
cover the whole history, including mail newer than the evaluated one. The
output adds a line with trusted skips, canary checks and mismatches, trusted
mails with anomalies, the anomaly rules that fired and which of those mails
were marked. Each skip is written to `--out` with `source: "trusted:profile"`
and `decision: "ham"`. The scripts open `<data>/db/accounts/<id>.db` first;
the absolute `dbPath` in `main.db` is used only when that file is missing
(a copied data dir keeps the original's paths).

`--out <file.json>` additionally writes every evaluated item (`accountId`, `id`,
`label`, `decision` spam/ham/unsure, `source`, `confidence`, `subject`,
`fromEmail`, `mailboxPath`, `serverSpamFlag`) for `scripts/spam-apply.ts`. The
file names subjects and senders: keep it outside the data dir and the repository.

## Bestehenden Spam aus dem Posteingang in den Spam-Ordner verschieben

`scripts/spam-apply.ts` moves the INBOX messages the eval marked as spam
(defaults `--label ham --decision spam`) to each account's Junk folder, one
after another, through the same code path as "Als Spam" (Junk folder
resolution, `$NotJunk` cleanup on IMAP, move + local relocation, flag cleanup)
and stores the same spam example. Rows that no longer exist or are no longer in
the INBOX are skipped. It prints one line per message (subject — sender —
result) and a summary. Run it on the server from the app directory (Bun loads
`.env.local`); the real run uses the app's DB layer with its write retries and
may run while the service is running. Shards without the spam schema are
refused (deploy the spam build first, see Deploy above).

```sh
# 1. Eval with output file (read-only)
bun scripts/spam-eval.ts --data /path/to/noctua-data \
  --sample briefs/spam/eval-sample.json --rules briefs/spam/static-rules.json \
  --out /tmp/spam-eval-result.json
# 2. Preview: databases opened read-only, nothing is moved
bun scripts/spam-apply.ts --in /tmp/spam-eval-result.json --data /path/to/noctua-data --dry-run
# 3. Move (optionally one mailbox: --account <accountId>)
bun scripts/spam-apply.ts --in /tmp/spam-eval-result.json --data /path/to/noctua-data
```

Wrongly moved mail must be moved back in Noctua — with „Kein Spam“ or by moving
it out of Junk (move dialog, drag and drop; see "Lernen beim Verschieben") —
not with another mail client: only moves made in Noctua store the ham example
the filter learns from.
