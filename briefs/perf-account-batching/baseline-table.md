Tree 0ac6cfa, Bun 1.4.4, 9 warm runs after 1 warm-up, median. Load 1/5/15 start [8.26, 9.02, 6.42] end [7.76, 8.91, 6.4].

| Scenario | Entry point | Variant | Mailboxes | Compiles | Cached hits | Executed | Tx | ms (median) | ms min–max | Result |
|---|---|---|---:|---:|---:|---:|---:|---:|---|---|
| `accessible/1` | listAccessibleAccountsForUser | normal | 1 | 4 | 2 | 6 | 0 | 0.71 | 0.58–0.99 | {"rows": 1} |
| `summary-lib/1` | getUserMailboxSummary(all) | normal | 1 | 9 | 7 | 16 | 1 | 1.51 | 1.43–1.74 | {"rows": 1} |
| `summary-route/1` | GET /api/me/mailboxes/summary | normal | 1 | 16 | 9 | 25 | 2 | 3.29 | 3.18–3.58 | {"status": 200, "bytes": 271} |
| `scoped-lib/1` | getUserMailboxSummary(scope=1) | normal | 1 | 9 | 7 | 16 | 1 | 1.39 | 1.28–1.57 | {"rows": 1} |
| `scoped-event/1` | SSE mailbox-summary event (scope=1) | normal | 1 | 9 | 9 | 18 | 2 | 2.59 | 2.57–2.78 | {"delivered": true} |
| `me/1` | GET /api/auth/me | normal | 1 | 16 | 4 | 20 | 0 | 6.25 | 5.61–7.19 | {"status": 200, "bytes": 1156} |
| `accessible/2` | listAccessibleAccountsForUser | normal | 2 | 7 | 4 | 11 | 0 | 0.83 | 0.78–0.89 | {"rows": 2} |
| `summary-lib/2` | getUserMailboxSummary(all) | normal | 2 | 17 | 14 | 31 | 1 | 2.38 | 2.26–2.60 | {"rows": 2} |
| `summary-route/2` | GET /api/me/mailboxes/summary | normal | 2 | 24 | 17 | 41 | 2 | 4.09 | 3.98–11.69 | {"status": 200, "bytes": 513} |
| `scoped-lib/2` | getUserMailboxSummary(scope=1) | normal | 2 | 12 | 9 | 21 | 1 | 1.56 | 1.49–1.68 | {"rows": 1} |
| `scoped-event/2` | SSE mailbox-summary event (scope=1) | normal | 2 | 12 | 11 | 23 | 2 | 2.79 | 2.73–3.46 | {"delivered": true} |
| `me/2` | GET /api/auth/me | normal | 2 | 19 | 7 | 26 | 0 | 5.89 | 5.70–8.09 | {"status": 200, "bytes": 1865} |
| `accessible/12` | listAccessibleAccountsForUser | normal | 12 | 37 | 24 | 61 | 0 | 3.35 | 3.27–3.58 | {"rows": 12} |
| `summary-lib/12` | getUserMailboxSummary(all) | normal | 12 | 97 | 84 | 181 | 1 | 11.83 | 11.37–12.26 | {"rows": 12} |
| `summary-route/12` | GET /api/me/mailboxes/summary | normal | 12 | 104 | 97 | 201 | 2 | 13.70 | 12.99–21.91 | {"status": 200, "bytes": 2813} |
| `scoped-lib/12` | getUserMailboxSummary(scope=1) | normal | 12 | 42 | 29 | 71 | 1 | 3.91 | 3.78–4.72 | {"rows": 1} |
| `scoped-event/12` | SSE mailbox-summary event (scope=1) | normal | 12 | 42 | 31 | 73 | 2 | 5.24 | 5.01–5.78 | {"delivered": true} |
| `me/12` | GET /api/auth/me | normal | 12 | 49 | 37 | 86 | 0 | 10.10 | 8.86–19.95 | {"status": 200, "bytes": 8485} |
| `accessible/12-disabled` | listAccessibleAccountsForUser | disabled | 11 | 1 | 22 | 23 | 0 | 0.98 | 0.94–1.06 | {"rows": 0} |
| `summary-lib/12-disabled` | getUserMailboxSummary(all) | disabled | 11 | 1 | 22 | 23 | 1 | 1.01 | 0.96–1.11 | {"rows": 0} |
| `summary-route/12-disabled` | GET /api/me/mailboxes/summary | disabled | 11 | 3 | 0 | 3 | 0 | 1.33 | 1.25–1.64 | {"status": 401, "bytes": 37} |
| `scoped-lib/12-disabled` | getUserMailboxSummary(scope=1) | disabled | 11 | 1 | 22 | 23 | 1 | 1.02 | 0.96–1.08 | {"rows": 0} |
| `scoped-event/12-disabled` | SSE mailbox-summary event (scope=1) | disabled | 11 | 3 | 0 | 3 | 0 | 1.36 | 1.20–1.74 | {"status": "stream-denied"} |
| `me/12-disabled` | GET /api/auth/me | disabled | 11 | 3 | 0 | 3 | 0 | 1.25 | 1.15–1.36 | {"status": 401, "bytes": 37} |
| `accessible/12-revoked` | listAccessibleAccountsForUser | revoked-mid-read | 11 | 31 | 22 | 53 | 0 | 5.31 | 5.05–5.98 | {"rows": 10} |
| `summary-lib/12-revoked` | getUserMailboxSummary(all) | revoked-mid-read | 11 | 100 | 77 | 177 | 1 | 13.56 | 13.07–15.07 | {"rows": 10} |
| `summary-route/12-revoked` | GET /api/me/mailboxes/summary | revoked-mid-read | 11 | 107 | 88 | 195 | 2 | 15.95 | 14.63–24.59 | {"status": 200, "bytes": 2329} |
| `scoped-lib/12-revoked` | getUserMailboxSummary(scope=1) | revoked-mid-read | 11 | 40 | 27 | 67 | 1 | 6.23 | 5.93–8.34 | {"rows": 0} |
| `scoped-event/12-revoked` | SSE mailbox-summary event (scope=1) | revoked-mid-read | 11 | 40 | 27 | 67 | 1 | 7.81 | 7.13–8.68 | {"delivered": false} |
| `me/12-revoked` | GET /api/auth/me | revoked-mid-read | 11 | 46 | 42 | 88 | 0 | 13.48 | 12.58–15.40 | {"status": 200, "bytes": 6780} |
| `scoped-event/2-foreign-mailbox` | SSE mailbox-summary event (scope=1) | foreign mailbox | 2 | 7 | 4 | 11 | 1 | 2.14 | 2.09–3.36 | {"delivered": false} |
| `scoped-event/11-foreign-mailbox` | SSE mailbox-summary event (scope=1) | foreign mailbox | 11 | 34 | 22 | 56 | 1 | 4.64 | 4.54–5.02 | {"delivered": false} |
| `event-fanout/4-streams` | SSE fan-out, 1 event x 4 open streams | normal | 1+2+12+11 | 98 | 73 | 171 | 7 | 12.56 | 11.78–13.44 | {"delivered": false} |
| `me/12-mfa-restricted` | GET /api/auth/me | mfa-restricted | 11 | 8 | 0 | 8 | 0 | 1.73 | 1.52–1.91 | {"status": 200, "bytes": 373} |
| `summary-route/12-mfa-restricted` | GET /api/me/mailboxes/summary | mfa-restricted | 11 | 7 | 0 | 7 | 0 | 1.36 | 1.33–1.44 | {"status": 403, "bytes": 70} |
| `accessible/12-mfa-restricted` | listAccessibleAccountsForUser | mfa-restricted | 11 | 34 | 22 | 56 | 0 | 3.31 | 3.12–3.48 | {"rows": 11} |
| `members/syn-acct-00` | listAccountMembers | owner only (0 links) | 1 | 3 | 0 | 3 | 0 | 0.19 | 0.17–0.24 | {"rows": 1} |
| `members/syn-acct-05` | listAccountMembers | 5 links incl. disabled member | 1 | 3 | 0 | 3 | 0 | 0.21 | 0.19–0.24 | {"rows": 11} |
| `members/syn-acct-06` | listAccountMembers | 6 links incl. disabled member | 1 | 3 | 0 | 3 | 0 | 0.21 | 0.19–0.27 | {"rows": 11} |
| `members/syn-acct-01-revoked` | listAccountMembers | revoked-mid-read | 1 | 3 | 0 | 3 | 0 | 2.79 | 1.93–3.14 | {"rows": 5} |
