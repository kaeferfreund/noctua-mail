# HTML mail privacy and stored sender addresses

Remote images remain blocked until the reader loads them once or grants a
per-user permission for the sender mailbox. Sender CSS cannot fetch remote
resources, including after image opt-in. The reader and standalone HTML route
use only the explicitly stored canonical `messages.senderKey`. Rows without a
key are unknown senders, regardless of the stored From display string.
Unknown senders can use Load once but cannot
match or save an Always load permission.

The reader sanitizes a message for both modes in one call
(`sanitizeHtmlForDisplayPair`): the markup is normalized once, CSS filter
results are memoized for that call only, and the allow pass is skipped when the
block pass rewrote no remote image source. The two outputs are then identical
and no "remote content blocked" banner shows, exactly as with two separate
passes. Any future mode-dependent sanitizer logic must report through the same
rewrite hook. `lib/html/sanitize.pair.test.ts` compares both modes byte for
byte with a frozen copy of the earlier sanitizer.

IMAP ingestion now serializes decoded envelope names and mailbox local parts
with the shared RFC 5322 address helpers. This applies to full and lightweight
sync, header fallback, single-message sync, Sent-copy readback, drafts,
cross-account copy, watcher sync, resync, and the poll/stream message summaries.
Quoted local-part whitespace and escaped characters remain part of the mailbox
identity; sender permission keys retain the existing case-insensitive and IDN
normalization policy.

The additive account-shard migration adds nullable `messages.senderKey TEXT`
and `messages.sourceSha256 TEXT`
without itself changing `PRAGMA user_version`. The current shard format is v3
with composite ownership, stable FTS identities and v3 writer guards (see STORAGE.md).
Existing rows start with NULL: no identity is recovered from legacy display
strings, which may have lost quotes, spaces or special characters.
Opening a message (including thread readers and standalone HTML) lazily fills
the key from the real From header only when its exact final-row-id source
file matches the SHA-256 ownership digest recorded by the fixed ingestion
writer in the same immediate transaction that assigned that row id. An exact
filename alone is insufficient: unmarked legacy caches may have been
overwritten by another copy with the same Message-ID. They stay unkeyed until
authoritative resync/re-ingestion refreshes the source and ownership digest.
Resync/re-ingestion also writes the key from the parsed envelope/header.
A new-message-only sync does not refresh existing rows. Lazy backfill avoids
scanning every retained source at startup. For rows ingested before the key was
stored, the operator tool `scripts/backfill-sender-keys.ts` (dry run by
default, `--write` to stamp) fills `senderKey` and `sourceSha256` from the
exact-id source only when that file matches the row's recorded byte size,
Message-ID and From mailbox (`checkLegacySourceOwnership`); a copy with the
same Message-ID that overwrote the file under the legacy writer fails these
checks and the row stays unknown.
`--resync` handles those remaining rows: it checks each folder and UID
read-only on IMAP and, with `--write`, re-ingests the rows whose UID still
holds the stored Message-ID through the reader's resync path. Rows whose UID
is gone or now holds another message are reported and stay unknown. A From
header without a single mailbox leaves `senderKey` NULL with a digest set,
like a fresh sync. Every row without a key shows "Sender unknown" next to the
disabled Always load button. SMTPUTF8 local parts remain UTF-8, while IDN
domains are canonicalized to punycode for permission keys.

Fragment links in the reader scroll to an ID or legacy named anchor inside the
mail document. A missing or malformed target is a no-op. External links continue
to open in a new tab with noopener,noreferrer.
