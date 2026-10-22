# HTML mail privacy and stored sender addresses

Remote images remain blocked until the reader loads them once or grants a
per-user permission for the sender mailbox. Sender CSS cannot fetch remote
resources, including after image opt-in. The reader and standalone HTML route
use the same mailbox key and reject ambiguous or unparseable stored From
strings as an unknown sender. Unknown senders can use Load once but cannot
match or save an Always load permission.

IMAP ingestion now serializes decoded envelope names and mailbox local parts
with the shared RFC 5322 address helpers. This applies to full and lightweight
sync, header fallback, single-message sync, Sent-copy readback, drafts,
cross-account copy, watcher sync, resync, and the poll/stream message summaries.
Quoted local-part whitespace and escaped characters remain part of the mailbox
identity; sender permission keys retain the existing case-insensitive and IDN
normalization policy.

Rows written by the previous envelope formatter may contain unescaped display
names or unquoted local parts. Their ambiguous strings stay blocked even when
another sender has an Always load permission. Re-fetching and resyncing the
message (or running a full folder resync that re-ingests existing messages)
refreshes these stored strings from IMAP. A new-message-only sync does not
refresh existing rows. No one-off database repair or migration is required or
included; the stricter permission lookup protects existing rows immediately.

Fragment links in the reader scroll to an ID or legacy named anchor inside the
mail document. A missing or malformed target is a no-op. External links continue
to open in a new tab with noopener,noreferrer.
