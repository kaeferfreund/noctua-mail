# HTML mail privacy and stored sender addresses

Remote images remain blocked until the reader loads them once or grants a
per-user permission for the sender mailbox. Sender CSS cannot fetch remote
resources, including after image opt-in. The reader and standalone HTML route
use only the explicitly stored canonical `messages.senderKey`. Rows without a
key are unknown senders, regardless of the stored From display string.
Unknown senders can use Load once but cannot
match or save an Always load permission.

IMAP ingestion now serializes decoded envelope names and mailbox local parts
with the shared RFC 5322 address helpers. This applies to full and lightweight
sync, header fallback, single-message sync, Sent-copy readback, drafts,
cross-account copy, watcher sync, resync, and the poll/stream message summaries.
Quoted local-part whitespace and escaped characters remain part of the mailbox
identity; sender permission keys retain the existing case-insensitive and IDN
normalization policy.

The additive account-shard migration adds nullable `messages.senderKey TEXT`
and `messages.sourceSha256 TEXT`
without changing `PRAGMA user_version` or the shard v2 key/guard contract.
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
A new-message-only sync does not refresh existing rows. No bulk backfill CLI is
included: lazy backfill avoids scanning every retained source at startup.
Rows without an owned source stay unknown until resynced; the reader explains
why their Always load button is disabled. SMTPUTF8 local parts remain UTF-8, while IDN
domains are canonicalized to punycode for permission keys.

Fragment links in the reader scroll to an ID or legacy named anchor inside the
mail document. A missing or malformed target is a no-op. External links continue
to open in a new tab with noopener,noreferrer.
