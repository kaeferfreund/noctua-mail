<!-- Purpose: staged MailPlus → netcup → Noctua migration plan; runbook §4/§7; REVIEW BEFORE USE. -->
# Migration gate and inventory

No migration has been executed. Run the example on a reviewed LAN migration host
with verified NAS TLS access and approved imapsync version. Never expose NAS ports
publicly. imapsync does not import Noctua metadata, labels, ACLs or stable UIDs.
Keep actual user/mailbox inventory privately outside git; rows here are placeholders.

Required answers from runbook §8:

- [ ] **Question 1 (line 1066):** all real mailboxes, aliases/forwarders/catch-alls,
  required sender identities and the two persons' owner/manager/editor/viewer roles.
- [ ] **Question 2 (line 1067):** certified NAS host, owner logins, shared namespace,
  actual folder names/delimiter/encoding, complete historical Sent/archive and sizes.
- [ ] **Question 4 (line 1069):** netcup plan/quotas, concurrent connections/login
  rates, SMTP limits, and verified UIDPLUS/SPECIAL-USE/CAPABILITY for every mailbox.

A mailbox maps once; aliases are not extra IMAP accounts. On personal runs exclude
the exact shared namespace; export each shared mailbox exactly once as its NAS owner.
Do not flatten several sources into one target without a reviewed union/count plan.

| Inventory ID | MailPlus TLS host / owner login | Source root / shared namespace | netcup TLS host / actual login | Real target mailbox / alias relation | Shared export owner / exclusions | Noctua owner / memberships | Size / quota / approval |
|---|---|---|---|---|---|---|---|
| `<mailbox-01>` | `<host> / <login>` | `<namespace>` | `<host> / <login>` | `<actual mailbox>` | `<owner / anchored exclusions>` | `<roles>` | `<bytes / limit / reviewer>` |

| Purpose | Exact MailPlus CLI folder (delimiter/UTF-7 as listed) | Exact netcup target / SPECIAL-USE | Exclusion or separate Legacy plan | Approval |
|---|---|---|---|---|
| INBOX | `INBOX` | `INBOX` | No pre-POP3-stop INBOX import | `<reviewer>` |
| Sent | `<one real Sent/Gesendet path>` | `<one actual Sent path> / \Sent` | Preserve extra historical Sent under Legacy until reviewed | |
| Drafts | `<actual path>` | `<actual Drafts path>` | | |
| Trash | `<actual path>` | `<actual Trash path>` | | |
| Junk | `<actual path>` | `<actual Junk path>` | | |
| Archive | `<actual path>` | `<actual Archive path>` | | |
| Custom/filter | `<actual selectable path>` | `<actual target>` | Separate `--subfolder2` run only if approved | |
| Shared | `<exact namespace / owner view>` | `<shared real mailbox>` | Exclude from every personal run | |

Use `--f1f2` for reviewed exact paths, never assume translated names. Read the CLI
column of imapsync folder listings, especially modified UTF-7; do not guess from
UI text. \Noselect containers are not messages. Verify TLS/CA on both hosts.

## Ordered procedure

1. Back up MailPlus history/config, netcup's existing messages and Noctua state/keys.
   Check quotas and folder coverage. Source remains unchanged and available as archive.
   Freeze source sending and rules during final migration. No MX/DNS switch is needed.
2. Before **any INBOX import or Noctua account creation**, manually do the last MailPlus
   POP3 fetch, record time and keep/delete behavior, and disable **every per-account
   fetch plus global POP3 fetch**. Observe two old poll intervals and a new test mail
   staying on netcup. New UIDLs can cause duplicate download or deletion if restarted.
   Even dry runs in this conservative example require the signed POP3 gate. Optional
   pre-copies before this gate must exclude `^INBOX$` and use a separate reviewed plan.
3. Store each endpoint password in its own private file mode 0600 (one password line).
   Use `--passfile1` / `--passfile2`, never `--password1/2`, shell variables containing
   passwords, argv literals, recorded terminals or shell xtrace. Log files contain
   private mailbox metadata; keep the migration directory 0700 and logs 0600.
4. Review/edit the example, then run its default `--dry-run`: folder-only dry run
   followed by message dry run. These authenticate and read the servers when later
   invoked; they must not create folders or transfer messages. Capture signed folder
   mapping and counts. The script does not install or configure imapsync.
5. Approve a small representative real import, repeat identically and prove idempotence.
   For the final initial import run `--execute --confirm-import` serially per mailbox;
   script does the immediate second delta. Both passes must exit 0. Verify zero new
   transfers on the quiet-source second run and explain incoming target-only mail.
   No delete/expunge/deduplication flags are allowed; existing target mail is preserved.
6. Read-only count every mapped folder (`EXAMINE`, `UID SEARCH ALL`/`UNDELETED` or a
   read-only client). Compare oldest/newest dates, flags, Message-ID duplicates, samples
   with attachments and Sent. New UIDs/UIDVALIDITY and POP3 UIDLs are expected. Header
   matching and `--addheader` need a representative duplicate/missing-Message-ID trial.
7. Day 1/7: dry-run again, reconcile moved target messages first. Only for explained
   missing content use `--post-cutover-delta` (adds `--noresyncflags`), ideally restricted
   to named missing folders. Otherwise stale source flags can overwrite live target
   read/Answered flags, and moved messages may be reintroduced as duplicates.
8. Create Noctua mailboxes using **final slice-6 routes**, not runbook's obsolete
   `POST /api/accounts` create instruction: it now repairs existing accounts only.
   Invite signup or ownerless admin creation is required; resolve personal ownership
   before creating mailboxes. With app/browser/watchers/importers stopped, full-sync
   every selectable folder per runbook §4.4, require final protocol result and compare
   Noctua rows/visible counts. This Noctua indexing/fullsync is deliberately manual.
   Enable watcher only after all counts pass; complete §7 household acceptance.

| Account / UTC / pass | Source folder → target | Source MESSAGES / UNDELETED | Target before | Copied / present / errors | Target after MESSAGES / UNDELETED | Noctua rows / visible | Oldest/newest, flags, MIME samples, discrepancy / sign-off |
|---|---|---|---|---|---|---|---|
| `<id / time / dry or import or delta>` | `<mapping>` | | | | | | |

No automatic rollback deletes remote messages. On failure stop further runs, retain
private logs/IDs and unchanged source. Before first import only, POP3 can return to
its original configuration. **After import keep POP3 off**; use netcup webmail/IMAP
as fallback. Wrong target imports require narrowly reviewed cleanup after backups,
never blanket INBOX deletion. Preserve MailPlus six months subject to user approval;
start the independent daily Maildir archive before ending MailPlus.
