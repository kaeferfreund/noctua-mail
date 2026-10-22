Synthetic IMAP/SMTP fixture copied from scripts/dev-fixture in team-inbox c1652ec.
Keeping it here makes the send acceptance tests independent of sibling checkouts.
The only test extensions are optional connection counting and omission of APPENDUID
in imap-server.ts. APPEND failures are injected by overriding this synthetic store's
append method; SMTP always uses the real sink and delivers into INBOX.
