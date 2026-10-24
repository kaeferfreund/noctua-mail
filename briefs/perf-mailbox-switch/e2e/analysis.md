
## Series `baseline-r2` (warm)

- started 2026-10-23T15:50:03.992Z; uptime before: `15:50:03 up 1 day,  1:52,  1 user,  load average: 4.09, 7.55, 10.06`; after: `15:51:51 up 1 day,  1:54,  1 user,  load average: 7.45, 7.49, 9.75`

| group | n | highlight p50/p90 | folders p50/p90 | first rows p50/p90 | settled p50/p90 | reqs p50 | long tasks p50 (count / ms) | timeouts |
|---|---|---|---|---|---|---|---|---|
| warm-first small→large | 1 | 147 / 147 | 339 / 339 | **725** / 725 | **1625** / 1625 | 37 | 9 / 1038 | 0 |
| warm large→small | 10 | 110 / 156 | 239 / 250 | **370** / 387 | **487** / 572 | 21 | 2 / 149 | 0 |
| warm small→large | 10 | 114 / 135 | 184 / 200 | **493** / 510 | **831** / 852 | 21 | 5 / 541 | 0 |
| warm-first medium→large | 1 | 131 / 131 | 220 / 220 | **613** / 613 | **1349** / 1349 | 37 | 8 / 943 | 0 |
| warm large→medium | 10 | 117 / 129 | 232 / 242 | **520** / 592 | **771** / 816 | 21 | 4 / 442 | 0 |
| warm medium→large | 10 | 114 / 136 | 196 / 230 | **516** / 650 | **849** / 1013 | 21 | 5 / 560 | 0 |

### Requests per switch — warm large→small (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 7 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 48 | 0 | 109 | 112 | 334 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 49 | 0 | 107 | 111 | 860926 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 74 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 89 | 0 | 84 | 86 | 1035 | 200 |
| `GET /api/auth/me` | 2 | 93 | 11 | 29 | 72 | 3028 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 100 | 0 | 75 | 78 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 100 | 22 | 55 | 78 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 102 | 60 | 34 | 93 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 103 | 71 | 12 | 84 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 104 | 72 | 19 | 92 | 201 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 139 | 43 | 25 | 72 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 139 | 52 | 15 | 70 | 35 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 223 | 0 | 14 | 16 | 326 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 224 | 0 | 13 | 16 | 45643 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 252 | 0 | 12 | stream | – | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 4 | 381 | 5 | 16 | 56 | 383 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 394 | 1 | 20 | 26 | 83 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→9 · /auth/me 11→22 · folders 89→175 · threads 224→240 (consistency 223→236) · first rows 370 · imap/stream open 252 · settled 491
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 861260
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 2, median total 149 ms, median max 81 ms; long-task ms before first rows: 148; DOM mutation records 251 in 12 frames

### Requests per switch — warm small→large (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 9 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 46 | 0 | 12 | 14 | 326 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 47 | 0 | 14 | 16 | 45643 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 69 | 0 | 14 | stream | – | 200 |
| `GET /api/accounts/{acct}/folders` | 1 | 86 | 0 | 5 | 7 | 1043 | 200 |
| `GET /api/auth/me` | 2 | 95 | 0 | 13 | 16 | 3028 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 98 | 0 | 6 | 8 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 99 | 0 | 7 | 9 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 101 | 0 | 16 | 20 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 102 | 4 | 14 | 21 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 103 | 4 | 16 | 22 | 201 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 168 | 0 | 106 | 108 | 334 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 169 | 0 | 103 | 108 | 860926 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 194 | 0 | 113 | stream | – | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 211 | 0 | 76 | 77 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 212 | 0 | 76 | 79 | 35 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 620 | 1 | 60 | 67 | 83 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 694 | 1 | 14 | 45 | 383 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→11 · /auth/me 14→26 · folders 86→93 · threads 169→278 (consistency 168→278) · first rows 497 · imap/stream open 194 · settled 833
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 45969
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 5, median total 541 ms, median max 212 ms; long-task ms before first rows: 259; DOM mutation records 251 in 10 frames

### Requests per switch — warm large→medium (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 7 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 50 | 0 | 108 | 110 | 334 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 51 | 0 | 105 | 110 | 860926 | 200 |
| `GET /api/auth/me` | 2 | 60 | 24 | 25 | 54 | 3029 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 74 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 88 | 0 | 83 | 85 | 1051 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 102 | 0 | 73 | 76 | 508 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 103 | 22 | 54 | 78 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 105 | 59 | 31 | 93 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 106 | 69 | 11 | 83 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 107 | 70 | 19 | 91 | 201 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 136 | 43 | 24 | 71 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 136 | 51 | 15 | 68 | 35 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 214 | 0 | 60 | 62 | 335 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 216 | 0 | 59 | 63 | 867878 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 244 | 0 | 47 | stream | – | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 570 | 6 | 18 | 72 | 383 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 588 | 1 | 30 | 37 | 83 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→9 · /auth/me 11→22 · folders 88→175 · threads 216→279 (consistency 214→273) · first rows 525 · imap/stream open 244 · settled 782
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 861260
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 4, median total 442 ms, median max 224 ms; long-task ms before first rows: 303; DOM mutation records 266 in 12 frames

### Requests per switch — warm medium→large (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 8 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 47 | 0 | 62 | 64 | 335 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 48 | 0 | 58 | 62 | 867878 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 70 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 86 | 0 | 33 | 35 | 1043 | 200 |
| `GET /api/auth/me` | 2 | 95 | 4 | 23 | 30 | 3028 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 98 | 0 | 23 | 26 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 99 | 11 | 26 | 37 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 101 | 17 | 13 | 33 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 102 | 21 | 10 | 32 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 103 | 20 | 25 | 48 | 201 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 184 | 0 | 108 | 111 | 334 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 185 | 0 | 105 | 110 | 860926 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 211 | 0 | 112 | stream | – | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 240 | 0 | 61 | 64 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 240 | 0 | 62 | 66 | 35 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 632 | 1 | 62 | 65 | 83 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→9 · /auth/me 12→23 · folders 86→123 · threads 185→294 (consistency 184→294) · first rows 519 · imap/stream open 211 · settled 858
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 868213
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 5, median total 560 ms, median max 219 ms; long-task ms before first rows: 276; DOM mutation records 263 in 11 frames

## Series `baseline-r3-lat0` (warm)

- started 2026-10-23T16:07:07.877Z; uptime before: `16:07:07 up 1 day,  2:09,  1 user,  load average: 17.65, 16.46, 14.00`; after: `16:08:03 up 1 day,  2:10,  1 user,  load average: 15.86, 16.20, 14.05`

| group | n | highlight p50/p90 | folders p50/p90 | first rows p50/p90 | settled p50/p90 | reqs p50 | long tasks p50 (count / ms) | timeouts |
|---|---|---|---|---|---|---|---|---|
| warm-first small→large | 1 | 316 / 316 | 394 / 394 | **795** / 795 | **2113** / 2113 | 38 | 9 / 1128 | 0 |
| warm large→small | 10 | 137 / 223 | 259 / 362 | **398** / 496 | **514** / 577 | 21 | 3 / 193 | 0 |
| warm small→large | 10 | 137 / 224 | 221 / 297 | **562** / 665 | **915** / 995 | 21 | 6 / 613 | 0 |

### Requests per switch — warm large→small (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 17 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 64 | 0 | 114 | 116 | 334 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 66 | 0 | 111 | 117 | 860926 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 95 | – | – | stream | – |  |
| `GET /api/auth/me` | 2 | 98 | 28 | 33 | 95 | 3028 | 200 |
| `GET /api/accounts/{acct}/folders` | 1 | 109 | 0 | 86 | 88 | 1035 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 121 | 0 | 77 | 80 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 122 | 19 | 57 | 82 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 124 | 62 | 50 | 115 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 125 | 72 | 14 | 92 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 127 | 73 | 37 | 122 | 201 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 159 | 44 | 43 | 91 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 160 | 53 | 21 | 85 | 35 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 239 | 0 | 18 | 22 | 326 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 241 | 1 | 16 | 22 | 45643 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 273 | 0 | 13 | stream | – | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 425 | 1 | 21 | 26 | 83 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 480 | 3 | 21 | 68 | 383 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→19 · /auth/me 23→49 · folders 109→199 · threads 241→261 (consistency 239→259) · first rows 401 · imap/stream open 273 · settled 531
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 861260
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 3, median total 193 ms, median max 84 ms; long-task ms before first rows: 193; DOM mutation records 248 in 12 frames

### Requests per switch — warm small→large (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 25 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 71 | 0 | 13 | 16 | 326 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 72 | 0 | 16 | 22 | 45643 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 95 | 0 | 14 | stream | – | 200 |
| `GET /api/auth/me` | 2 | 111 | 0 | 25 | 27 | 3028 | 200 |
| `GET /api/accounts/{acct}/folders` | 1 | 113 | 0 | 6 | 8 | 1043 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 125 | 0 | 8 | 10 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 127 | 0 | 9 | 14 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 129 | 0 | 29 | 31 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 132 | 5 | 30 | 35 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 133 | 8 | 25 | 34 | 201 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 211 | 0 | 112 | 115 | 334 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 212 | 0 | 109 | 115 | 860926 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 238 | 0 | 124 | stream | – | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 270 | 0 | 67 | 70 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 271 | 0 | 68 | 71 | 35 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 676 | 1 | 67 | 72 | 83 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→27 · /auth/me 32→49 · folders 113→122 · threads 212→324 (consistency 211→323) · first rows 578 · imap/stream open 238 · settled 943
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 45969
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 6, median total 613 ms, median max 230 ms; long-task ms before first rows: 309; DOM mutation records 259 in 12 frames

## Series `cold` (cold)

- started 2026-10-23T15:26:38.252Z; uptime before: `15:26:38 up 1 day,  1:28,  1 user,  load average: 7.99, 8.53, 7.76`; after: `15:33:54 up 1 day,  1:36,  1 user,  load average: 12.51, 14.20, 11.04`

| group | n | highlight p50/p90 | folders p50/p90 | first rows p50/p90 | settled p50/p90 | reqs p50 | long tasks p50 (count / ms) | timeouts |
|---|---|---|---|---|---|---|---|---|
| cold small→large | 10 | 162 / 190 | 262 / 296 | **700** / 852 | **1658** / 2065 | 37 | 9 / 1290 | 0 |
| cold large→small | 10 | 210 / 351 | 396 / 502 | **676** / 840 | **1571** / 2331 | 38 | 8 / 708 | 0 |
| cold medium→large | 10 | 138 / 326 | 284 / 519 | **662** / 1472 | **1442** / 2553 | 37 | 8 / 1024 | 0 |
| cold large→medium | 10 | 158 / 253 | 309 / 443 | **811** / 1032 | **1959** / 2376 | 38 | 10 / 1344 | 0 |
| cold small→folders | 10 | 237 / 341 | 566 / 699 | **1141** / 1453 | **2172** / 2923 | 37 | 11 / 1737 | 0 |
| cold folders→large | 10 | 344 / 435 | 425 / 536 | **781** / 995 | **1569** / 2690 | 37 | 10 / 1190 | 0 |

### Requests per switch — cold small→large (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 3 | 0 | 9 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 62 | 0 | 15 | 18 | 326 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 63 | 0 | 14 | 18 | 45643 | 200 |
| `GET /api/auth/me` | 2 | 76 | 0 | 15 | 21 | 3028 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 94 | 0 | 24 | stream | – | 200 |
| `GET /api/accounts/{acct}/folders` | 1 | 124 | 0 | 8 | 11 | 1043 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 140 | 0 | 9 | 12 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 141 | 0 | 13 | 16 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 148 | 1 | 27 | 32 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 148 | 7 | 23 | 32 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 149 | 9 | 19 | 33 | 201 | 200 |
| `GET /api/accounts/{acct}/reminders` | 1 | 165 | 2 | 13 | 19 | 33 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 241 | 0 | 125 | 127 | 334 | 200 |
| `POST /api/accounts/{acct}/sync` | 1 | 269 | 0 | 126 | 128 | 87 | 202 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 284 | 0 | 228 | stream | – | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 323 | 1 | 72 | 76 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 323 | 53 | 41 | 99 | 35 | 200 |
| `GET /api/accounts/{acct}/threads` | 2 | 662 | 0 | 121 | 131 | 860931 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 8 | 861 | 1 | 22 | 47 | 383 | 200 |
| `GET /api/accounts/{acct}/sync/status` | 1 | 1020 | 5 | 15 | 35 | 577 | 200 |
| `GET /api/accounts/{acct}/messages` | 8 | 1146 | 1 | 71 | 80 | 83 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2
- `GET /api/accounts/{acct:large}/threads?page=…&pageSize=…&groupBy=…&threadDateSource=…&folderId=…` — 10/10 runs, ×2
- `GET /api/accounts/{acct:large}/messages?page=…&pageSize=…&groupBy=…&searchScope=…&badges=…&excludeFolderIds=…` — 10/10 runs, ×8
- `GET /api/accounts/{acct:large}/sender-icon?from=…&fromEmail=…` — 10/10 runs, ×8

Critical path (medians, ms from click): switch-account 3→12 · /auth/me 16→31 · folders 124→141 · threads 241→377 (consistency 241→363) · first rows 751 · imap/stream open 284 · settled 1797
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 45969
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: ["202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync"]
Long tasks: median count 9, median total 1290 ms, median max 349 ms; long-task ms before first rows: 491; DOM mutation records 285 in 13 frames

### Requests per switch — cold large→small (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 3 | 0 | 17 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 97 | 0 | 160 | 163 | 334 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 101 | 0 | 142 | 164 | 860931 | 200 |
| `GET /api/auth/me` | 2 | 136 | 13 | 28 | 62 | 3028 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 155 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 178 | 0 | 109 | 115 | 1035 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 200 | 1 | 75 | 98 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 200 | 42 | 49 | 102 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 203 | 78 | 45 | 131 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 205 | 77 | 27 | 111 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 206 | 87 | 41 | 142 | 201 | 200 |
| `GET /api/accounts/{acct}/reminders` | 1 | 225 | 62 | 35 | 111 | 33 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 367 | 1 | 21 | 29 | 326 | 200 |
| `POST /api/accounts/{acct}/sync` | 1 | 400 | 0 | 25 | 30 | 87 | 202 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 422 | 0 | 65 | stream | – | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 429 | 47 | 15 | 65 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 430 | 54 | 14 | 69 | 35 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 8 | 814 | 2 | 30 | 89 | 383 | 200 |
| `GET /api/accounts/{acct}/threads` | 2 | 835 | 0 | 18 | 26 | 45643 | 200 |
| `GET /api/accounts/{acct}/messages` | 8 | 910 | 1 | 41 | 59 | 83 | 200 |
| `GET /api/accounts/{acct}/sync/status` | 2 | 1139 | 0 | 26 | 33 | 529 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2
- `GET /api/accounts/{acct:small}/threads?page=…&pageSize=…&groupBy=…&threadDateSource=…&folderId=…` — 10/10 runs, ×2
- `GET /api/accounts/{acct:small}/sender-icon?from=…&fromEmail=…` — 10/10 runs, ×8
- `GET /api/accounts/{acct:small}/sync/status?jobId=…` — 10/10 runs, ×2
- `GET /api/accounts/{acct:small}/messages?page=…&pageSize=…&groupBy=…&searchScope=…&badges=…&excludeFolderIds=…` — 10/10 runs, ×8

Critical path (medians, ms from click): switch-account 3→21 · /auth/me 27→43 · folders 178→303 · threads 406→468 (consistency 367→397) · first rows 719 · imap/stream open 422 · settled 1624
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 861265
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: ["202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync"]
Long tasks: median count 8, median total 708 ms, median max 181 ms; long-task ms before first rows: 409; DOM mutation records 298 in 17 frames

### Requests per switch — cold medium→large (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 3 | 0 | 11 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 61 | 0 | 68 | 72 | 335 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 62 | 0 | 69 | 79 | 867880 | 200 |
| `GET /api/auth/me` | 2 | 83 | 1 | 25 | 29 | 3028 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 90 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 107 | 0 | 33 | 36 | 1043 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 124 | 0 | 22 | 27 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 124 | 5 | 22 | 44 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 126 | 17 | 38 | 55 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 126 | 22 | 23 | 52 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 132 | 18 | 22 | 53 | 201 | 200 |
| `GET /api/accounts/{acct}/reminders` | 1 | 145 | 21 | 18 | 37 | 33 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 254 | 0 | 111 | 114 | 334 | 200 |
| `POST /api/accounts/{acct}/sync` | 1 | 290 | 0 | 127 | 129 | 87 | 202 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 304 | 0 | 164 | stream | – | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 341 | 1 | 64 | 108 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 341 | 59 | 31 | 110 | 35 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 8 | 725 | 1 | 18 | 37 | 383 | 200 |
| `GET /api/accounts/{acct}/threads` | 2 | 758 | 0 | 111 | 114 | 860931 | 200 |
| `GET /api/accounts/{acct}/messages` | 8 | 911 | 1 | 69 | 76 | 83 | 200 |
| `GET /api/accounts/{acct}/sync/status` | 1 | 916 | 9 | 61 | 77 | 577 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2
- `GET /api/accounts/{acct:large}/messages?page=…&pageSize=…&groupBy=…&searchScope=…&badges=…&excludeFolderIds=…` — 10/10 runs, ×8
- `GET /api/accounts/{acct:large}/threads?page=…&pageSize=…&groupBy=…&threadDateSource=…&folderId=…` — 10/10 runs, ×2
- `GET /api/accounts/{acct:large}/sender-icon?from=…&fromEmail=…` — 10/10 runs, ×8
- `GET /api/accounts/{acct:large}/sync/status?jobId=…` — 1/10 runs, ×2

Critical path (medians, ms from click): switch-account 3→14 · /auth/me 16→33 · folders 107→168 · threads 254→385 (consistency 254→385) · first rows 690 · imap/stream open 304 · settled 1516
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 868215
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: ["202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync"]
Long tasks: median count 8, median total 1024 ms, median max 307 ms; long-task ms before first rows: 440; DOM mutation records 294 in 14 frames

### Requests per switch — cold large→medium (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 3 | 0 | 11 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 67 | 0 | 132 | 136 | 334 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 68 | 0 | 126 | 133 | 860931 | 200 |
| `GET /api/auth/me` | 2 | 82 | 17 | 23 | 48 | 3029 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 103 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 122 | 0 | 82 | 84 | 1051 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 140 | 1 | 63 | 68 | 508 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 141 | 31 | 37 | 71 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 143 | 52 | 35 | 96 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 145 | 60 | 12 | 86 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 146 | 64 | 26 | 94 | 201 | 200 |
| `GET /api/accounts/{acct}/reminders` | 1 | 167 | 45 | 28 | 79 | 33 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 290 | 0 | 67 | 70 | 335 | 200 |
| `POST /api/accounts/{acct}/sync` | 1 | 319 | 0 | 62 | 66 | 87 | 202 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 333 | 0 | 80 | stream | – | 200 |
| `GET /api/accounts/{acct}/threads` | 2 | 724 | 0 | 67 | 78 | 867880 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 8 | 852 | 1 | 24 | 47 | 383 | 200 |
| `GET /api/accounts/{acct}/sync/status` | 2 | 1081 | 0 | 23 | 29 | 581 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 1113 | 1 | 11 | 30 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 1113 | 1 | 12 | 35 | 35 | 200 |
| `GET /api/accounts/{acct}/messages` | 8 | 1267 | 1 | 34 | 38 | 83 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2
- `GET /api/accounts/{acct:medium}/threads?page=…&pageSize=…&groupBy=…&threadDateSource=…&folderId=…` — 10/10 runs, ×2
- `GET /api/accounts/{acct:medium}/messages?page=…&pageSize=…&groupBy=…&searchScope=…&badges=…&excludeFolderIds=…` — 10/10 runs, ×8
- `GET /api/accounts/{acct:medium}/sync/status?jobId=…` — 8/10 runs, ×2
- `GET /api/accounts/{acct:medium}/sender-icon?from=…&fromEmail=…` — 10/10 runs, ×8

Critical path (medians, ms from click): switch-account 3→14 · /auth/me 18→32 · folders 122→222 · threads 291→367 (consistency 290→354) · first rows 811 · imap/stream open 333 · settled 1987
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 861265
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: ["202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync"]
Long tasks: median count 10, median total 1344 ms, median max 358 ms; long-task ms before first rows: 506; DOM mutation records 313 in 17 frames

### Requests per switch — cold small→folders (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 3 | 0 | 15 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 104 | 0 | 17 | 21 | 326 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 114 | 0 | 27 | 35 | 45643 | 200 |
| `GET /api/auth/me` | 2 | 123 | 0 | 24 | 31 | 3030 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 164 | 0 | 22 | stream | – | 200 |
| `GET /api/accounts/{acct}/folders` | 1 | 201 | 0 | 9 | 11 | 8984 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 218 | 0 | 13 | 17 | 508 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 219 | 1 | 17 | 21 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 222 | 1 | 51 | 58 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 224 | 9 | 21 | 37 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 224 | 17 | 28 | 54 | 201 | 200 |
| `GET /api/accounts/{acct}/reminders` | 1 | 249 | 3 | 20 | 42 | 33 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 486 | 0 | 22 | 30 | 332 | 200 |
| `POST /api/accounts/{acct}/sync` | 1 | 570 | 0 | 17 | 19 | 87 | 202 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 614 | 0 | 38 | stream | – | 200 |
| `GET /api/accounts/{acct}/threads` | 2 | 823 | 0 | 36 | 43 | 348520 | 200 |
| `GET /api/accounts/{acct}/messages` | 8 | 1175 | 1 | 48 | 55 | 83 | 200 |
| `GET /api/accounts/{acct}/sync/status` | 1 | 1250 | 4 | 15 | 48 | 585 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 8 | 1266 | 1 | 26 | 61 | 383 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 1811 | 0 | 13 | 20 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 1812 | 1 | 16 | 31 | 35 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2
- `GET /api/accounts/{acct:folders}/threads?page=…&pageSize=…&groupBy=…&threadDateSource=…&folderId=…` — 10/10 runs, ×2
- `GET /api/accounts/{acct:folders}/messages?page=…&pageSize=…&groupBy=…&searchScope=…&badges=…&excludeFolderIds=…` — 10/10 runs, ×8
- `GET /api/accounts/{acct:folders}/sender-icon?from=…&fromEmail=…` — 10/10 runs, ×8
- `GET /api/accounts/{acct:folders}/sync/status?jobId=…` — 2/10 runs, ×2

Critical path (medians, ms from click): switch-account 3→19 · /auth/me 25→51 · folders 201→223 · threads 493→548 (consistency 486→514) · first rows 1202 · imap/stream open 614 · settled 2248
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 45969
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: ["202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync"]
Long tasks: median count 11, median total 1737 ms, median max 348 ms; long-task ms before first rows: 909; DOM mutation records 288 in 15 frames

### Requests per switch — cold folders→large (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 3 | 0 | 8 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 135 | 0 | 32 | 34 | 332 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 136 | 0 | 30 | 33 | 348520 | 200 |
| `GET /api/auth/me` | 2 | 182 | 0 | 14 | 17 | 3028 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 194 | 0 | 17 | stream | – | 200 |
| `GET /api/accounts/{acct}/folders` | 1 | 310 | 0 | 6 | 8 | 1043 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 330 | 0 | 6 | 8 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 331 | 0 | 6 | 9 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 333 | 0 | 17 | 20 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 334 | 3 | 16 | 22 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 336 | 4 | 17 | 24 | 201 | 200 |
| `GET /api/accounts/{acct}/reminders` | 1 | 352 | 0 | 7 | 9 | 33 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 413 | 0 | 112 | 114 | 334 | 200 |
| `POST /api/accounts/{acct}/sync` | 1 | 435 | 0 | 109 | 112 | 87 | 202 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 446 | 0 | 136 | stream | – | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 468 | 1 | 58 | 83 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 469 | 58 | 29 | 95 | 35 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 8 | 846 | 1 | 20 | 40 | 383 | 200 |
| `GET /api/accounts/{acct}/threads` | 2 | 854 | 0 | 105 | 109 | 860931 | 200 |
| `GET /api/accounts/{acct}/sync/status` | 1 | 1010 | 12 | 64 | 80 | 577 | 200 |
| `GET /api/accounts/{acct}/messages` | 8 | 1310 | 1 | 65 | 70 | 83 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2
- `GET /api/accounts/{acct:large}/threads?page=…&pageSize=…&groupBy=…&threadDateSource=…&folderId=…` — 10/10 runs, ×2
- `GET /api/accounts/{acct:large}/sender-icon?from=…&fromEmail=…` — 10/10 runs, ×8
- `GET /api/accounts/{acct:large}/messages?page=…&pageSize=…&groupBy=…&searchScope=…&badges=…&excludeFolderIds=…` — 10/10 runs, ×8

Critical path (medians, ms from click): switch-account 3→11 · /auth/me 14→27 · folders 310→321 · threads 415→538 (consistency 413→542) · first rows 805 · imap/stream open 446 · settled 1589
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 348852
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: ["202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync"]
Long tasks: median count 10, median total 1190 ms, median max 258 ms; long-task ms before first rows: 588; DOM mutation records 292 in 13 frames

## Series `contention-second-tab` (warm, second tab)

- started 2026-10-23T15:54:06.691Z; uptime before: `15:54:06 up 1 day,  1:56,  1 user,  load average: 16.28, 10.18, 10.39`; after: `15:56:07 up 1 day,  1:58,  1 user,  load average: 10.91, 11.28, 10.85`

| group | n | highlight p50/p90 | folders p50/p90 | first rows p50/p90 | settled p50/p90 | reqs p50 | long tasks p50 (count / ms) | timeouts |
|---|---|---|---|---|---|---|---|---|
| warm-first small→large | 1 | 2248 / 2248 | 2976 / 2976 | **3633** / 3633 | **4938** / 4938 | 40 | 9 / 1247 | 0 |
| warm large→small | 10 | 148 / 219 | 293 / 492 | **461** / 753 | **645** / 897 | 21 | 3 / 271 | 0 |
| warm small→large | 10 | 156 / 201 | 249 / 352 | **642** / 773 | **992** / 1120 | 21 | 6 / 720 | 0 |
| warm-first medium→large | 1 | 168 / 168 | 274 / 274 | **807** / 807 | **1703** / 1703 | 35 | 10 / 1272 | 0 |
| warm large→medium | 10 | 118 / 140 | 236 / 280 | **528** / 611 | **721** / 875 | 21 | 4 / 430 | 0 |
| warm medium→large | 10 | 119 / 159 | 198 / 313 | **532** / 613 | **880** / 991 | 21 | 6 / 612 | 0 |

### Requests per switch — warm large→small (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 10 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 64 | 0 | 133 | 137 | 334 | 200 |
| `GET /api/auth/me` | 2 | 66 | 27 | 16 | 51 | 3028 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 66 | 0 | 126 | 131 | 837858 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 100 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 114 | 41 | 55 | 94 | 1036 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 128 | 66 | 19 | 88 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 130 | 68 | 17 | 90 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 133 | 84 | 9 | 99 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 135 | 86 | 25 | 116 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 138 | 93 | 15 | 113 | 201 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 169 | 70 | 11 | 81 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 170 | 77 | 6 | 85 | 35 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 274 | 0 | 17 | 23 | 326 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 276 | 0 | 17 | 21 | 58201 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 316 | 0 | 14 | stream | – | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 420 | 14 | 22 | 41 | 83 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 545 | 16 | 13 | 59 | 383 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→12 · /auth/me 14→31 · folders 114→217 · threads 276→304 (consistency 274→300) · first rows 464 · imap/stream open 316 · settled 646
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 838192
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 3, median total 271 ms, median max 104 ms; long-task ms before first rows: 225; DOM mutation records 257 in 12 frames

### Requests per switch — warm small→large (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 10 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 58 | 0 | 14 | 17 | 326 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 64 | 0 | 15 | 19 | 58201 | 200 |
| `GET /api/auth/me` | 2 | 71 | 0 | 12 | 19 | 3028 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 90 | 0 | 15 | stream | – | 200 |
| `GET /api/accounts/{acct}/folders` | 1 | 125 | 0 | 7 | 10 | 1043 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 138 | 0 | 7 | 11 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 141 | 1 | 12 | 16 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 144 | 11 | 15 | 30 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 148 | 14 | 11 | 36 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 148 | 21 | 12 | 39 | 201 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 232 | 0 | 132 | 138 | 334 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 234 | 0 | 126 | 133 | 837858 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 264 | 0 | 166 | stream | – | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 293 | 67 | 11 | 79 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 293 | 69 | 10 | 83 | 35 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 544 | 30 | 45 | 87 | 83 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→12 · /auth/me 15→29 · folders 125→135 · threads 234→368 (consistency 232→376) · first rows 648 · imap/stream open 264 · settled 1027
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 58527
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 6, median total 720 ms, median max 254 ms; long-task ms before first rows: 396; DOM mutation records 259 in 11 frames

### Requests per switch — warm large→medium (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 7 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 49 | 0 | 110 | 113 | 334 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 50 | 0 | 107 | 113 | 837858 | 200 |
| `GET /api/auth/me` | 2 | 55 | 24 | 15 | 45 | 3029 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 75 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 90 | 33 | 49 | 82 | 1052 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 101 | 59 | 14 | 76 | 508 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 102 | 60 | 14 | 77 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 104 | 72 | 5 | 80 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 105 | 73 | 16 | 93 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 106 | 76 | 9 | 90 | 201 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 137 | 53 | 10 | 65 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 137 | 56 | 5 | 63 | 35 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 226 | 0 | 60 | 63 | 335 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 227 | 0 | 58 | 63 | 844690 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 257 | 0 | 43 | stream | – | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 579 | 8 | 18 | 32 | 83 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 588 | 9 | 7 | 19 | 383 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→9 · /auth/me 11→23 · folders 90→172 · threads 227→291 (consistency 226→290) · first rows 534 · imap/stream open 257 · settled 741
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 838192
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 4, median total 430 ms, median max 209 ms; long-task ms before first rows: 262; DOM mutation records 258 in 12 frames

### Requests per switch — warm medium→large (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 8 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 47 | 0 | 60 | 63 | 335 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 50 | 0 | 60 | 65 | 844690 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 74 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 89 | 23 | 9 | 34 | 1043 | 200 |
| `GET /api/auth/me` | 2 | 95 | 8 | 13 | 33 | 3028 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 102 | 13 | 11 | 26 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 103 | 18 | 10 | 32 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 104 | 23 | 16 | 42 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 106 | 31 | 15 | 44 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 107 | 34 | 7 | 45 | 201 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 181 | 0 | 108 | 111 | 334 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 182 | 0 | 105 | 110 | 837858 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 209 | 0 | 109 | stream | – | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 250 | 40 | 8 | 52 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 250 | 41 | 8 | 53 | 35 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 617 | 9 | 8 | 25 | 383 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 653 | 14 | 42 | 68 | 83 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→10 · /auth/me 12→22 · folders 89→122 · threads 182→295 (consistency 181→294) · first rows 533 · imap/stream open 209 · settled 884
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 845025
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 6, median total 612 ms, median max 216 ms; long-task ms before first rows: 322; DOM mutation records 263 in 12 frames

Second tab requests during series: {"requests":76,"byUrl":[["/",1],["/_next/static/chunks/1qnukglkrr6qq.css",1],["/_next/static/chunks/2twzebe-8t9z9.css",1],["/_next/static/chunks/26z4oftymbd7h.css",1],["/_next/static/chunks/2899fwebm025l.css",1],["/_next/static/chunks/23t2tiomi9o4q.css",1],["/_next/static/chunks/0dl9bx9nkrt61.js",1],["/_next/static/chunks/242x7dx0zu3hf.js",1],["/_next/static/chunks/0rqvshlk9e35x.js",1],["/_next/static/chunks/3hviqi_w3a33b.js",1],["/_next/static/chunks/{id}.js",1],["/_next/static/chunks/0f9u2168-mrz_.js",1],["/_next/static/chunks/1_9_o3iok6nqq.js",1],["/_next/static/chunks/1y5fvokl9hn96.js",1],["/_next/static/chunks/0s13142r8aud-.js",1],["/_next/static/chunks/1c9hg-1kr02or.js",1],["/_next/static/chunks/445ffaz30-vke.js",1],["/_next/static/chunks/43nigtyu141-5.js",1],["/_next/static/chunks/1mx1wqpmp9sa6.js",1],["/_next/static/chunks/0ynuetlf27uep.js",1],["/_next/static/chunks/0c1rmzadj3-d-.js",1],["/_next/static/chunks/3kmzblaysritu.js",1],["/_next/static/chunks/0bomfrlk_0g89.js",1],["/_next/static/chunks/013iha29f-oio.js",1],["/_next/static/chunks/0bir3sz1sr3tl.js",1],["/_next/static/chunks/1ex-5c_bsj67l.js",1],["/_next/static/chunks/1mju_4t9jdi3n.js",1],["/_next/static/chunks/220mbfve_wopq.js",1],["/_next/static/chunks/0fj88rja5znz9.js",1],["/_next/static/chunks/0a-rekt06v0sv.js",1],["/runtime-config.js",1],["/fonts/InterVariable-latin.woff2",1],["/api/auth/me",2],["/api/version",2],["/_next/static/chunks/3ncwvv6inmk03.js",1],["/_next/static/chunks/1fhe0epcmg-x5.js",1],["/api/accounts/{acct:small}/folders",1],["/api/accounts/{acct:small}/topics",1],["/api/accounts/{acct:small}/calendar/events?startMs=…&endMs=…",2],["/api/accounts/{acct:small}/members",1],["/api/me/events",1],["/icons/logo.svg",1],["/api/accounts/{acct:small}/reminders",1],["/api/me/mailboxes/summary",1],["/api/accounts/{acct:small}/messages?page=…&pageSize=…&groupBy=…&searchScope=…&badges=…&excludeFolderIds=…",12],["/api/accounts/{acct:small}/folders/{acct:small}%3AINBOX/consistency",1],["/api/accounts/{acct:small}/threads?page=…&pageSize=…&groupBy=…&threadDateSource=…&folderId=…",2],["/api/accounts/{acct:small}/sync",1],["/api/accounts/{acct:small}/imap/stream?activeFolderId=…",1],["/api/accounts/{acct:small}/sender-icon?from=…&fromEmail=…",6],["/api/accounts/{acct:small}/sync/status?jobId=…",2],["/api/accounts/{acct:small}/topics/stats",1],["/api/accounts/{acct:small}/recipient-aliases",1],["/_next/static/chunks/3m_ldxh1wv4al.js",1],["/_next/static/chunks/3mlxfz6ul-we2.js",1]]}

## Series `contention-watcher` (warm)

- started 2026-10-23T15:51:51.805Z; uptime before: `15:51:51 up 1 day,  1:54,  1 user,  load average: 7.45, 7.49, 9.75`; after: `15:54:05 up 1 day,  1:56,  1 user,  load average: 16.28, 10.18, 10.39`

| group | n | highlight p50/p90 | folders p50/p90 | first rows p50/p90 | settled p50/p90 | reqs p50 | long tasks p50 (count / ms) | timeouts |
|---|---|---|---|---|---|---|---|---|
| warm-first small→large | 1 | 172 / 172 | 269 / 269 | **656** / 656 | **4456** / 4456 | 49 | 17 / 2132 | 0 |
| warm large→small | 10 | 116 / 146 | 237 / 270 | **377** / 450 | **508** / 1081 | 24 | 3 / 198 | 0 |
| warm small→large | 10 | 128 / 181 | 201 / 283 | **527** / 660 | **1072** / 1864 | 27 | 7 / 773 | 0 |
| warm-first medium→large | 1 | 253 / 253 | 332 / 332 | **697** / 697 | **2010** / 2010 | 38 | 9 / 1154 | 0 |
| warm large→medium | 10 | 135 / 217 | 257 / 433 | **592** / 1002 | **853** / 1966 | 25 | 5 / 504 | 0 |
| warm medium→large | 10 | 140 / 205 | 238 / 352 | **580** / 852 | **1055** / 2617 | 21 | 7 / 791 | 0 |

### Requests per switch — warm large→small (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 7 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 46 | 0 | 111 | 113 | 334 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 48 | 0 | 107 | 112 | 854521 | 200 |
| `GET /api/auth/me` | 2 | 63 | 8 | 24 | 59 | 3028 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 71 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 86 | 0 | 86 | 88 | 1035 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 100 | 0 | 74 | 77 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 100 | 19 | 55 | 78 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 102 | 57 | 33 | 92 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 103 | 71 | 11 | 86 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 104 | 73 | 19 | 94 | 201 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 138 | 41 | 24 | 67 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 138 | 48 | 14 | 64 | 35 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 222 | 0 | 7 | 10 | 326 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 227 | 0 | 13 | 15 | 48571 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 252 | 0 | 14 | stream | – | 200 |
| `GET /api/accounts/{acct}/sync/status [OLD acct]` | 1 | 261 | 80 | 33 | 115 | 824 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 419 | 1 | 22 | 31 | 83 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 424 | 1 | 15 | 43 | 383 | 200 |
| `POST /api/accounts/{acct}/sync` | 0 | 783 | 0 | 10 | 12 | 87 | 202 |
| `GET /api/accounts/{acct}/sync/status` | 0 | 875 | 0 | 8 | 10 | 313 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2
- `GET /api/accounts/{acct:small}/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=focused&excludeFolderIds={acct:small}%3AJunk%2C{acct:small}%3ASent` — 2/10 runs, ×2.5
- `GET /api/accounts/{acct:small}/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=todo&excludeFolderIds={acct:small}%3AJunk%2C{acct:small}%3ASent%2C` — 2/10 runs, ×2.5
- `GET /api/accounts/{acct:small}/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=calendar&excludeFolderIds={acct:small}%3AJunk%2C{acct:small}%3ASen` — 2/10 runs, ×2.5
- `GET /api/accounts/{acct:small}/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=calendar%2Cunread&excludeFolderIds={acct:small}%3AJunk%2C{acct:sma` — 2/10 runs, ×2.5
- `GET /api/accounts/{acct:small}/threads?page=1&pageSize=300&groupBy=date&threadDateSource=latestReceivedDateValue&folderId={acct:small}%3AINBOX` — 1/10 runs, ×2
- `GET /api/accounts/{acct:small}/sync/status?jobId=1f79584c-d006-4644-8208-664f3aff2ec9` — 1/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→9 · /auth/me 12→21 · folders 86→177 · threads 223→238 (consistency 222→235) · first rows 377 · imap/stream open 252 · settled 511
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream, GET /api/accounts/{acct}/sync/status; median old bytes 854855
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: ["202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync"]
Long tasks: median count 3, median total 198 ms, median max 91 ms; long-task ms before first rows: 196; DOM mutation records 253 in 12 frames

### Requests per switch — warm small→large (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 8 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 48 | 0 | 7 | 9 | 326 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 51 | 0 | 13 | 15 | 49052 | 200 |
| `GET /api/auth/me` | 2 | 64 | 0 | 14 | 17 | 3028 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 79 | 0 | 12 | stream | – | 200 |
| `GET /api/accounts/{acct}/messages [OLD acct]` | 0 | 88 | – | – | – | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 102 | 0 | 6 | 8 | 1043 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 117 | 0 | 7 | 10 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 118 | 0 | 8 | 11 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 121 | 0 | 24 | 27 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 123 | 5 | 21 | 32 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 124 | 4 | 22 | 31 | 201 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 226 | 0 | 111 | 115 | 334 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 228 | 0 | 114 | 118 | 854521 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 235 | 0 | 120 | stream | – | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 274 | 0 | 71 | 75 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 275 | 0 | 78 | 81 | 35 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 4 | 562 | 1 | 15 | 32 | 383 | 200 |
| `POST /api/accounts/{acct}/sync` | 0 | 680 | 0 | 10 | 13 | 88 | 202 |
| `GET /api/accounts/{acct}/messages` | 4 | 739 | 1 | 69 | 81 | 83 | 200 |
| `GET /api/version` | 1 | 764 | 5 | 54 | 60 | 45 | 200 |
| `GET /api/accounts/{acct}/sync/status [OLD acct]` | 0 | 838 | 0 | 7 | 11 | 818 | 200 |
| `GET /api/accounts/{acct}/sync/status` | 0 | 994 | 0 | 7 | 10 | 805 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2
- `POST /api/accounts/{acct:large}/folders/{acct:large}%3AINBOX/consistency` — 2/10 runs, ×2
- `GET /api/accounts/{acct:large}/threads?page=1&pageSize=300&groupBy=date&threadDateSource=latestReceivedDateValue&folderId={acct:large}%3AINBOX` — 2/10 runs, ×2
- `GET /api/accounts/{acct:large}/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=focused&excludeFolderIds={acct:large}%3AJunk%2C{acct:large}%3ASent` — 2/10 runs, ×3
- `GET /api/accounts/{acct:large}/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=todo&excludeFolderIds={acct:large}%3AJunk%2C{acct:large}%3ASent%2C` — 2/10 runs, ×3
- `GET /api/accounts/{acct:large}/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=calendar&excludeFolderIds={acct:large}%3AJunk%2C{acct:large}%3ASen` — 2/10 runs, ×3
- `GET /api/accounts/{acct:large}/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=calendar%2Cunread&excludeFolderIds={acct:large}%3AJunk%2C{acct:lar` — 2/10 runs, ×3
- `GET /api/accounts/{acct:large}/sync/status?jobId=44299c6f-d984-43d9-bf98-dfc1a746c2fa` — 1/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→10 · /auth/me 12→24 · folders 102→125 · threads 204→324 (consistency 202→323) · first rows 553 · imap/stream open 235 · settled 1078
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream, GET /api/accounts/{acct}/sync/status, GET /api/accounts/{acct}/messages; median old bytes 49624
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: ["202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync"]
Long tasks: median count 7, median total 773 ms, median max 231 ms; long-task ms before first rows: 346; DOM mutation records 260 in 12 frames

### Requests per switch — warm large→medium (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 9 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 52 | 0 | 116 | 120 | 334 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 56 | 0 | 114 | 121 | 841725 | 200 |
| `GET /api/auth/me` | 2 | 77 | 21 | 25 | 56 | 3029 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 83 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 101 | 0 | 94 | 97 | 1052 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 115 | 1 | 82 | 88 | 508 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 117 | 22 | 60 | 88 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 120 | 64 | 37 | 106 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 121 | 75 | 16 | 95 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 123 | 79 | 29 | 114 | 201 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 162 | 48 | 31 | 87 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 164 | 55 | 17 | 80 | 35 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 240 | 0 | 64 | 67 | 335 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 252 | 0 | 63 | 68 | 848569 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 282 | 0 | 48 | stream | – | 200 |
| `POST /api/accounts/{acct}/sync` | 0 | 348 | 0 | 23 | 25 | 87 | 202 |
| `GET /api/accounts/{acct}/sync/status [OLD acct]` | 1 | 601 | 0 | 218 | 220 | 826 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 610 | 5 | 22 | 60 | 383 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 621 | 1 | 39 | 49 | 83 | 200 |
| `GET /api/version` | 0.5 | 1022 | 0 | 2 | 4 | 45 | 200 |
| `GET /api/accounts/{acct}/sync/status` | 0 | 2029 | 0 | 9 | 11 | 509 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2
- `POST /api/accounts/{acct:medium}/folders/{acct:medium}%3AINBOX/consistency` — 1/10 runs, ×2
- `GET /api/accounts/{acct:medium}/threads?page=1&pageSize=300&groupBy=date&threadDateSource=latestReceivedDateValue&folderId={acct:medium}%3AINBOX` — 1/10 runs, ×2
- `GET /api/accounts/{acct:medium}/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=focused&excludeFolderIds={acct:medium}%3AJunk%2C{acct:medium}%3AS` — 2/10 runs, ×2.5
- `GET /api/accounts/{acct:medium}/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=todo&excludeFolderIds={acct:medium}%3AJunk%2C{acct:medium}%3ASent` — 2/10 runs, ×2.5
- `GET /api/accounts/{acct:medium}/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=calendar&excludeFolderIds={acct:medium}%3AJunk%2C{acct:medium}%3A` — 2/10 runs, ×2.5
- `GET /api/accounts/{acct:medium}/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=calendar%2Cunread&excludeFolderIds={acct:medium}%3AJunk%2C{acct:m` — 2/10 runs, ×2.5
- `GET /api/accounts/{acct:medium}/sync/status?jobId=50dd2fc6-6420-475c-833f-e673f191cec7` — 1/10 runs, ×3

Critical path (medians, ms from click): switch-account 1→11 · /auth/me 14→29 · folders 101→193 · threads 247→317 (consistency 240→313) · first rows 596 · imap/stream open 282 · settled 859
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream, GET /api/accounts/{acct}/sync/status; median old bytes 842059
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: ["202 /api/accounts/{acct}/sync"]
Long tasks: median count 5, median total 504 ms, median max 243 ms; long-task ms before first rows: 364; DOM mutation records 264 in 13 frames

### Requests per switch — warm medium→large (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 9 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 56 | 0 | 60 | 62 | 335 | 200 |
| `GET /api/auth/me` | 2 | 59 | 4 | 23 | 31 | 3028 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 62 | 0 | 82 | 86 | 848569 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 96 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 111 | 0 | 52 | 59 | 1043 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 124 | 0 | 43 | 52 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 125 | 9 | 38 | 55 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 127 | 26 | 40 | 75 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 128 | 42 | 24 | 73 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 129 | 48 | 25 | 75 | 201 | 200 |
| `GET /api/accounts/{acct}/messages [OLD acct]` | 0 | 217 | – | – | – | – |  |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 246 | 0 | 69 | 74 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 246 | 0 | 72 | 77 | 35 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 250 | 0 | 122 | 125 | 334 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 253 | 0 | 121 | 127 | 841725 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 254 | 0 | 157 | stream | – | 200 |
| `POST /api/accounts/{acct}/sync` | 0 | 663 | 45 | 36 | 85 | 88 | 202 |
| `GET /api/accounts/{acct}/messages` | 4 | 705 | 1 | 74 | 93 | 83 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 6 | 890 | 1 | 31 | 42 | 383 | 200 |
| `GET /api/accounts/{acct}/sync/status` | 0 | 1633 | 0 | 23 | 26 | 662 | 200 |
| `GET /api/accounts/{acct}/sync/status [OLD acct]` | 0 | 1877 | 0 | 24 | 34 | 678 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2
- `POST /api/accounts/{acct:large}/folders/{acct:large}%3AINBOX/consistency` — 2/10 runs, ×2
- `GET /api/accounts/{acct:large}/threads?page=1&pageSize=300&groupBy=date&threadDateSource=latestReceivedDateValue&folderId={acct:large}%3AINBOX` — 2/10 runs, ×2
- `GET /api/accounts/{acct:large}/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=focused&excludeFolderIds={acct:large}%3AJunk%2C{acct:large}%3ASent` — 3/10 runs, ×3
- `GET /api/accounts/{acct:large}/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=todo&excludeFolderIds={acct:large}%3AJunk%2C{acct:large}%3ASent%2C` — 3/10 runs, ×3
- `GET /api/accounts/{acct:large}/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=calendar&excludeFolderIds={acct:large}%3AJunk%2C{acct:large}%3ASen` — 3/10 runs, ×3
- `GET /api/accounts/{acct:large}/messages?page=1&pageSize=1&groupBy=date&searchScope=all&badges=calendar%2Cunread&excludeFolderIds={acct:large}%3AJunk%2C{acct:lar` — 3/10 runs, ×3
- `GET /api/accounts/{acct:medium}/sync/status?jobId=167650bd-ccae-4c10-8d88-b999a0728489` — 1/10 runs, ×2
- `GET /api/accounts/{acct:large}/sync/status?jobId=5eb393ba-240b-4ae2-aaa3-c9dbb847cd07` — 1/10 runs, ×2
- `GET /api/accounts/{acct:large}/sync/status?jobId=1bcae3af-0e67-4ed3-b1e9-f82eefb26921` — 1/10 runs, ×2
- `GET /api/accounts/{acct:medium}/sync/status?jobId=cffce900-bb44-4d68-928f-926e326fb5e4` — 1/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→11 · /auth/me 16→31 · folders 111→169 · threads 224→348 (consistency 220→350) · first rows 589 · imap/stream open 254 · settled 1159
Old-account requests after click: median 3 per switch; templates: GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream, GET /api/accounts/{acct}/messages, GET /api/accounts/{acct}/sync/status, POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency; median old bytes 849416
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: ["202 /api/accounts/{acct}/sync","202 /api/accounts/{acct}/sync"]
Long tasks: median count 7, median total 791 ms, median max 259 ms; long-task ms before first rows: 369; DOM mutation records 263 in 12 frames

## Series `imap-latency-50` (warm)

- started 2026-10-23T16:01:42.434Z; uptime before: `16:01:42 up 1 day,  2:03,  1 user,  load average: 21.44, 15.98, 12.89`; after: `16:03:48 up 1 day,  2:05,  1 user,  load average: 15.63, 16.29, 13.44`

| group | n | highlight p50/p90 | folders p50/p90 | first rows p50/p90 | settled p50/p90 | reqs p50 | long tasks p50 (count / ms) | timeouts |
|---|---|---|---|---|---|---|---|---|
| warm-first small→large | 1 | 188 / 188 | 298 / 298 | **974** / 974 | **3241** / 3241 | 39 | 13 / 1767 | 0 |
| warm large→small | 10 | 153 / 240 | 318 / 425 | **495** / 635 | **916** / 1060 | 21 | 4 / 322 | 0 |
| warm small→large | 10 | 165 / 212 | 262 / 349 | **697** / 851 | **1160** / 1460 | 21 | 6 / 784 | 0 |
| warm-first small→folders | 1 | 183 / 183 | 454 / 454 | **925** / 925 | **2066** / 2066 | 38 | 11 / 1586 | 0 |
| warm folders→small | 10 | 291 / 437 | 385 / 502 | **525** / 665 | **931** / 1070 | 21 | 3 / 341 | 0 |
| warm small→folders | 10 | 144 / 219 | 336 / 433 | **691** / 818 | **1218** / 1572 | 21 | 7 / 901 | 0 |

### Requests per switch — warm large→small (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 2 | 0 | 16 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 67 | 0 | 150 | 153 | 334 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 70 | 0 | 144 | 154 | 860926 | 200 |
| `GET /api/auth/me` | 2 | 78 | 33 | 36 | 74 | 3028 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 102 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 118 | 0 | 110 | 113 | 1035 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 139 | 1 | 103 | 111 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 140 | 29 | 72 | 116 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 142 | 81 | 57 | 145 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 143 | 96 | 19 | 125 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 145 | 101 | 37 | 146 | 201 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 182 | 51 | 41 | 102 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 182 | 63 | 27 | 94 | 35 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 301 | 1 | 66 | 73 | 326 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 302 | 1 | 22 | 28 | 45643 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 343 | 0 | 524 | stream | – | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 523 | 1 | 43 | 54 | 83 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 544 | 18 | 32 | 123 | 383 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 2→18 · /auth/me 20→49 · folders 118→240 · threads 302→346 (consistency 301→383) · first rows 509 · imap/stream open 343 · settled 921
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 861260
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 4, median total 322 ms, median max 102 ms; long-task ms before first rows: 257; DOM mutation records 257 in 13 frames

### Requests per switch — warm small→large (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 17 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 70 | 0 | 62 | 65 | 326 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 75 | 0 | 16 | 20 | 45643 | 200 |
| `GET /api/auth/me` | 2 | 107 | 0 | 25 | 33 | 3028 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 111 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 130 | 0 | 7 | 10 | 1043 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 144 | 0 | 14 | 17 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 146 | 0 | 19 | 24 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 148 | 1 | 35 | 39 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 150 | 9 | 35 | 54 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 151 | 16 | 29 | 49 | 201 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 238 | 0 | 150 | 153 | 334 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 243 | 0 | 140 | 151 | 860926 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 278 | 0 | 694 | stream | – | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 337 | 0 | 72 | 84 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 340 | 0 | 86 | 96 | 35 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 387 | 17 | 86 | 107 | 83 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 845 | 2 | 29 | 49 | 383 | 200 |
| `GET /api/version` | 1 | 913 | 0 | 6 | 9 | 45 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→19 · /auth/me 23→44 · folders 130→139 · threads 243→401 (consistency 238→398) · first rows 699 · imap/stream open 278 · settled 1177
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 45969
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 6, median total 784 ms, median max 286 ms; long-task ms before first rows: 409; DOM mutation records 257 in 12 frames

### Requests per switch — warm folders→small (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 13 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 131 | 0 | 68 | 72 | 332 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 133 | 0 | 42 | 48 | 348520 | 200 |
| `GET /api/auth/me` | 2 | 199 | 0 | 25 | 30 | 3028 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 211 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 268 | 0 | 5 | 9 | 1035 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 289 | 0 | 9 | 13 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 290 | 0 | 13 | 16 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 293 | 0 | 31 | 36 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 295 | 7 | 29 | 40 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 297 | 9 | 24 | 39 | 201 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 388 | 0 | 61 | 64 | 326 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 390 | 0 | 15 | 18 | 45643 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 429 | 0 | 488 | stream | – | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 544 | 6 | 20 | 31 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 545 | 12 | 17 | 33 | 35 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 566 | 2 | 20 | 73 | 383 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 588 | 1 | 24 | 37 | 83 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→16 · /auth/me 20→38 · folders 268→276 · threads 390→413 (consistency 388→456) · first rows 563 · imap/stream open 429 · settled 971
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 348852
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 3, median total 341 ms, median max 177 ms; long-task ms before first rows: 340; DOM mutation records 253 in 12 frames

### Requests per switch — warm small→folders (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 2 | 0 | 12 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 63 | 0 | 65 | 70 | 326 | 200 |
| `GET /api/auth/me` | 2 | 64 | 0 | 18 | 22 | 3030 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 66 | 0 | 17 | 20 | 45643 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 98 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 111 | 0 | 6 | 9 | 8984 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 125 | 0 | 8 | 10 | 508 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 127 | 0 | 14 | 17 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 130 | 3 | 27 | 32 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 132 | 10 | 20 | 39 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 133 | 11 | 20 | 33 | 201 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 281 | 0 | 60 | 63 | 332 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 282 | 0 | 34 | 41 | 348520 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 372 | 0 | 502 | stream | – | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 449 | 1 | 34 | 38 | 83 | 200 |
| `GET /api/version` | 1 | 756 | 0 | 5 | 10 | 45 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 965 | 0 | 8 | 13 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 968 | 0 | 7 | 16 | 35 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 2→14 · /auth/me 22→39 · folders 111→122 · threads 282→323 (consistency 281→344) · first rows 696 · imap/stream open 372 · settled 1239
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 45969
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 7, median total 901 ms, median max 242 ms; long-task ms before first rows: 525; DOM mutation records 260 in 12 frames

## Series `imap-latency-50b` (warm)

- started 2026-10-23T16:04:06.974Z; uptime before: `16:04:06 up 1 day,  2:06,  1 user,  load average: 12.86, 15.62, 13.28`; after: `16:05:05 up 1 day,  2:07,  1 user,  load average: 14.45, 15.41, 13.34`

| group | n | highlight p50/p90 | folders p50/p90 | first rows p50/p90 | settled p50/p90 | reqs p50 | long tasks p50 (count / ms) | timeouts |
|---|---|---|---|---|---|---|---|---|
| warm-first small→large | 1 | 138 / 138 | 230 / 230 | **634** / 634 | **1735** / 1735 | 38 | 9 / 1139 | 0 |
| warm large→small | 10 | 136 / 182 | 291 / 338 | **433** / 509 | **828** / 928 | 21 | 4 / 256 | 0 |
| warm small→large | 10 | 165 / 238 | 250 / 348 | **645** / 967 | **1075** / 1402 | 21 | 7 / 805 | 0 |

### Requests per switch — warm large→small (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 13 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 56 | 0 | 139 | 147 | 334 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 57 | 0 | 134 | 142 | 860926 | 200 |
| `GET /api/auth/me` | 2 | 78 | 30 | 30 | 68 | 3028 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 87 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 106 | 0 | 94 | 97 | 1035 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 115 | 1 | 83 | 87 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 117 | 25 | 63 | 90 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 120 | 68 | 42 | 121 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 122 | 78 | 15 | 97 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 124 | 79 | 26 | 113 | 201 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 160 | 40 | 36 | 83 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 162 | 49 | 16 | 79 | 35 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 271 | 0 | 58 | 61 | 326 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 274 | 0 | 13 | 18 | 45643 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 307 | 0 | 485 | stream | – | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 443 | 12 | 15 | 58 | 383 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 459 | 1 | 24 | 33 | 83 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→14 · /auth/me 17→30 · folders 106→220 · threads 274→291 (consistency 271→332) · first rows 441 · imap/stream open 307 · settled 829
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 861260
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 4, median total 256 ms, median max 90 ms; long-task ms before first rows: 222; DOM mutation records 254 in 13 frames

### Requests per switch — warm small→large (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 2 | 0 | 14 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 60 | 0 | 68 | 73 | 326 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 61 | 0 | 17 | 21 | 45643 | 200 |
| `GET /api/auth/me` | 2 | 87 | 0 | 20 | 25 | 3028 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 91 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 118 | 0 | 10 | 12 | 1043 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 138 | 0 | 12 | 18 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 139 | 1 | 18 | 24 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 143 | 2 | 42 | 55 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 147 | 11 | 41 | 61 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 153 | 13 | 37 | 59 | 201 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 227 | 0 | 140 | 148 | 334 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 229 | 0 | 127 | 137 | 860926 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 271 | 0 | 666 | stream | – | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 299 | 0 | 91 | 94 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 301 | 0 | 93 | 98 | 35 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 515 | 3 | 71 | 84 | 83 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 2→17 · /auth/me 20→36 · folders 118→141 · threads 229→359 (consistency 227→378) · first rows 651 · imap/stream open 271 · settled 1167
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 45969
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 7, median total 805 ms, median max 272 ms; long-task ms before first rows: 427; DOM mutation records 257 in 12 frames

## Series `warm` (warm)

- started 2026-10-23T15:33:55.251Z; uptime before: `15:33:55 up 1 day,  1:36,  1 user,  load average: 12.51, 14.20, 11.04`; after: `15:37:59 up 1 day,  1:40,  1 user,  load average: 10.23, 13.02, 11.35`

| group | n | highlight p50/p90 | folders p50/p90 | first rows p50/p90 | settled p50/p90 | reqs p50 | long tasks p50 (count / ms) | timeouts |
|---|---|---|---|---|---|---|---|---|
| warm-first small→large | 1 | 153 / 153 | 229 / 229 | **582** / 582 | **1353** / 1353 | 37 | 8 / 945 | 0 |
| warm large→small | 10 | 121 / 291 | 233 / 535 | **378** / 774 | **504** / 1126 | 21 | 3 / 200 | 0 |
| warm small→large | 10 | 142 / 166 | 215 / 287 | **552** / 770 | **1003** / 1401 | 21 | 6 / 722 | 0 |
| warm-first medium→large | 1 | 246 / 246 | 382 / 382 | **968** / 968 | **2678** / 2678 | 38 | 10 / 1646 | 0 |
| warm large→medium | 10 | 194 / 269 | 355 / 435 | **711** / 895 | **1062** / 1276 | 21 | 5 / 756 | 0 |
| warm medium→large | 10 | 183 / 240 | 289 / 377 | **667** / 1008 | **1088** / 1436 | 21 | 6 / 855 | 0 |
| warm-first small→folders | 1 | 333 / 333 | 727 / 727 | **1409** / 1409 | **2578** / 2578 | 37 | 11 / 2028 | 0 |
| warm folders→small | 10 | 322 / 415 | 396 / 523 | **538** / 688 | **738** / 1020 | 21 | 4 / 327 | 0 |
| warm small→folders | 10 | 144 / 610 | 341 / 938 | **735** / 1378 | **1147** / 1905 | 21 | 7 / 891 | 0 |
| warm-first folders→large | 1 | 346 / 346 | 422 / 422 | **788** / 788 | **1586** / 1586 | 37 | 10 / 1174 | 0 |
| warm large→folders | 10 | 112 / 143 | 334 / 353 | **729** / 832 | **876** / 962 | 21 | 5 / 552 | 0 |
| warm folders→large | 10 | 306 / 339 | 380 / 418 | **716** / 763 | **1157** / 1252 | 21 | 7 / 828 | 0 |

### Requests per switch — warm large→small (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 9 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 53 | 0 | 123 | 126 | 334 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 54 | 0 | 120 | 125 | 860931 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 80 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 94 | 0 | 85 | 87 | 1035 | 200 |
| `GET /api/auth/me` | 2 | 100 | 27 | 26 | 81 | 3028 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 106 | 0 | 75 | 80 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 107 | 22 | 49 | 81 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 108 | 65 | 29 | 95 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 109 | 73 | 9 | 89 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 111 | 73 | 20 | 98 | 201 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 140 | 38 | 23 | 62 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 140 | 44 | 14 | 60 | 35 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 229 | 0 | 14 | 17 | 326 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 231 | 0 | 11 | 16 | 45643 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 263 | 0 | 10 | stream | – | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 421 | 2 | 14 | 38 | 383 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 429 | 1 | 23 | 28 | 83 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→11 · /auth/me 14→31 · folders 94→188 · threads 231→246 (consistency 229→246) · first rows 392 · imap/stream open 263 · settled 507
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 861265
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 3, median total 200 ms, median max 88 ms; long-task ms before first rows: 198; DOM mutation records 251 in 12 frames

### Requests per switch — warm small→large (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 8 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 51 | 0 | 11 | 15 | 326 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 52 | 0 | 15 | 18 | 45643 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 77 | 0 | 12 | stream | – | 200 |
| `GET /api/accounts/{acct}/folders` | 1 | 107 | 0 | 6 | 8 | 1043 | 200 |
| `GET /api/auth/me` | 2 | 112 | 0 | 14 | 17 | 3028 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 120 | 0 | 6 | 9 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 122 | 0 | 11 | 13 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 125 | 0 | 17 | 25 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 126 | 4 | 17 | 29 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 130 | 6 | 17 | 27 | 201 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 200 | 0 | 111 | 113 | 334 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 201 | 0 | 109 | 115 | 860931 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 229 | 0 | 122 | stream | – | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 258 | 0 | 76 | 80 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 259 | 0 | 78 | 81 | 35 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 670 | 1 | 68 | 72 | 83 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 8 | 1430 | 1 | 57 | 110 | 383 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→10 · /auth/me 12→22 · folders 107→116 · threads 201→318 (consistency 200→306) · first rows 569 · imap/stream open 229 · settled 1011
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 45969
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 6, median total 722 ms, median max 242 ms; long-task ms before first rows: 352; DOM mutation records 259 in 12 frames

### Requests per switch — warm large→medium (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 2 | 0 | 13 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 74 | 0 | 172 | 175 | 334 | 200 |
| `GET /api/auth/me` | 2 | 75 | 24 | 26 | 85 | 3029 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 80 | 0 | 158 | 166 | 860931 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 124 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 143 | 0 | 99 | 103 | 1051 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 160 | 1 | 85 | 94 | 508 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 164 | 38 | 65 | 96 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 166 | 66 | 48 | 128 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 169 | 82 | 16 | 106 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 175 | 82 | 24 | 124 | 201 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 248 | 54 | 25 | 86 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 248 | 63 | 15 | 85 | 35 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 347 | 0 | 68 | 74 | 335 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 348 | 0 | 80 | 87 | 867880 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 391 | 0 | 65 | stream | – | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 774 | 1 | 47 | 54 | 83 | 200 |
| `GET /api/version` | 1 | 1039 | 0 | 4 | 13 | 45 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 2→15 · /auth/me 22→44 · folders 143→283 · threads 348→423 (consistency 347→422) · first rows 740 · imap/stream open 391 · settled 1083
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 861265
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 5, median total 756 ms, median max 292 ms; long-task ms before first rows: 452; DOM mutation records 263 in 12 frames

### Requests per switch — warm medium→large (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 2 | 0 | 16 | – | – | 200 |
| `GET /api/auth/me` | 2 | 70 | 1 | 20 | 28 | 3028 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 79 | 0 | 52 | 57 | 335 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 85 | 0 | 79 | 91 | 867880 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 124 | 0 | 62 | stream | – | 200 |
| `GET /api/accounts/{acct}/folders` | 1 | 149 | 0 | 43 | 50 | 1043 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 165 | 0 | 34 | 40 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 167 | 16 | 22 | 46 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 170 | 28 | 26 | 56 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 171 | 30 | 22 | 60 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 174 | 33 | 27 | 61 | 201 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 281 | 0 | 152 | 157 | 334 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 283 | 0 | 142 | 154 | 860931 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 318 | 0 | 239 | stream | – | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 339 | 0 | 77 | 88 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 340 | 0 | 79 | 91 | 35 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 443 | 11 | 74 | 89 | 83 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 739 | 2 | 13 | 25 | 383 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 2→19 · /auth/me 22→48 · folders 149→196 · threads 283→427 (consistency 281→427) · first rows 741 · imap/stream open 318 · settled 1206
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 868215
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 6, median total 855 ms, median max 308 ms; long-task ms before first rows: 462; DOM mutation records 260 in 11 frames

### Requests per switch — warm folders→small (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 9 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 124 | 0 | 35 | 38 | 332 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 127 | 0 | 35 | 39 | 348520 | 200 |
| `GET /api/auth/me` | 2 | 193 | 0 | 14 | 17 | 3028 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 194 | 0 | 21 | stream | – | 200 |
| `GET /api/accounts/{acct}/folders` | 1 | 297 | 0 | 4 | 7 | 1035 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 314 | 0 | 6 | 9 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 315 | 0 | 10 | 13 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 317 | 0 | 22 | 25 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 318 | 5 | 16 | 24 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 319 | 7 | 19 | 28 | 201 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 387 | 0 | 12 | 15 | 326 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 388 | 0 | 12 | 16 | 45643 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 415 | 0 | 11 | stream | – | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 566 | 1 | 23 | 30 | 83 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 598 | 2 | 16 | 23 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 598 | 4 | 12 | 20 | 35 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 653 | 11 | 20 | 81 | 383 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→12 · /auth/me 16→27 · folders 297→304 · threads 388→406 (consistency 387→399) · first rows 542 · imap/stream open 415 · settled 740
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 348852
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 4, median total 327 ms, median max 165 ms; long-task ms before first rows: 326; DOM mutation records 262 in 13 frames

### Requests per switch — warm small→folders (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 2 | 0 | 20 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 61 | 0 | 17 | 20 | 326 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 65 | 0 | 15 | 22 | 45643 | 200 |
| `GET /api/auth/me` | 2 | 97 | 0 | 20 | 25 | 3030 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 104 | 0 | 13 | stream | – | 200 |
| `GET /api/accounts/{acct}/folders` | 1 | 120 | 0 | 5 | 8 | 8984 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 133 | 0 | 10 | 13 | 508 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 137 | 0 | 13 | 16 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 138 | 1 | 30 | 35 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 139 | 6 | 25 | 36 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 140 | 10 | 23 | 36 | 201 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 289 | 0 | 27 | 30 | 332 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 291 | 0 | 34 | 39 | 348520 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 383 | 0 | 15 | stream | – | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 489 | 1 | 37 | 41 | 83 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 912 | 0 | 9 | 12 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 913 | 0 | 9 | 13 | 35 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 1126 | 2 | 21 | 69 | 383 | 200 |
| `GET /api/version` | 1 | 1134 | 0 | 2 | 4 | 45 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 2→22 · /auth/me 25→39 · folders 120→126 · threads 291→340 (consistency 289→336) · first rows 735 · imap/stream open 383 · settled 1153
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 45969
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 7, median total 891 ms, median max 241 ms; long-task ms before first rows: 529; DOM mutation records 260 in 12 frames

### Requests per switch — warm large→folders (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 8 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 48 | 0 | 110 | 113 | 334 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 49 | 0 | 107 | 112 | 860931 | 200 |
| `GET /api/auth/me` | 2 | 57 | 24 | 17 | 43 | 3030 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 71 | – | – | stream | – |  |
| `GET /api/accounts/{acct}/folders` | 1 | 86 | 0 | 81 | 83 | 8984 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 98 | 0 | 71 | 74 | 508 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 99 | 21 | 50 | 75 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 101 | 59 | 31 | 92 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 102 | 67 | 10 | 79 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 103 | 69 | 17 | 88 | 201 | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 134 | 42 | 23 | 66 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 135 | 48 | 14 | 64 | 35 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 288 | 0 | 30 | 33 | 332 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 289 | 0 | 28 | 33 | 348520 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 369 | 0 | 11 | stream | – | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 475 | 1 | 26 | 29 | 83 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 896 | 1 | 12 | 23 | 383 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→10 · /auth/me 12→22 · folders 86→171 · threads 289→323 (consistency 288→317) · first rows 735 · imap/stream open 369 · settled 878
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 861265
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 5, median total 552 ms, median max 216 ms; long-task ms before first rows: 452; DOM mutation records 262 in 12 frames

### Requests per switch — warm folders→large (n=10; medians; offsets from click in ms)

| request | per switch | start | stall/queue | TTFB | total | bytes | status |
|---|---|---|---|---|---|---|---|
| `POST /api/auth/switch-account` | 1 | 1 | 0 | 7 | – | – | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency [OLD acct]` | 1 | 115 | 0 | 20 | 22 | 332 | 200 |
| `GET /api/accounts/{acct}/threads [OLD acct]` | 1 | 116 | 0 | 30 | 34 | 348520 | 200 |
| `GET /api/auth/me` | 2 | 156 | 0 | 14 | 17 | 3028 | 200 |
| `GET /api/accounts/{acct}/imap/stream [OLD acct]` (SSE) | 1 | 172 | 0 | 11 | stream | – | 200 |
| `GET /api/accounts/{acct}/folders` | 1 | 274 | 0 | 5 | 7 | 1043 | 200 |
| `GET /api/accounts/{acct}/identities` | 1 | 290 | 0 | 5 | 8 | 503 | 200 |
| `GET /api/accounts/{acct}/prefs` | 1 | 290 | 0 | 7 | 9 | 33 | 200 |
| `GET /api/accounts/{acct}/topics` | 1 | 292 | 0 | 18 | 21 | 34 | 200 |
| `GET /api/accounts/{acct}/calendar/events` | 1 | 293 | 3 | 16 | 22 | 33 | 200 |
| `GET /api/accounts/{acct}/members` | 1 | 294 | 5 | 15 | 21 | 201 | 200 |
| `POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency` | 1 | 363 | 0 | 109 | 111 | 334 | 200 |
| `GET /api/accounts/{acct}/threads` | 1 | 365 | 0 | 106 | 111 | 860931 | 200 |
| `GET /api/accounts/{acct}/imap/stream` (SSE) | 1 | 392 | 0 | 115 | stream | – | 200 |
| `GET /api/accounts/{acct}/topics/stats` | 1 | 408 | 0 | 74 | 76 | 33 | 200 |
| `GET /api/accounts/{acct}/recipient-aliases` | 1 | 409 | 0 | 75 | 77 | 35 | 200 |
| `GET /api/accounts/{acct}/sender-icon` | 0 | 771 | 1 | 13 | 27 | 383 | 200 |
| `GET /api/accounts/{acct}/messages` | 4 | 843 | 1 | 59 | 67 | 83 | 200 |

Exact-URL duplicates within one switch (runs affected / median count):
- `GET /api/auth/me` — 10/10 runs, ×2

Critical path (medians, ms from click): switch-account 1→9 · /auth/me 11→22 · folders 274→281 · threads 365→476 (consistency 363→475) · first rows 718 · imap/stream open 392 · settled 1169
Old-account requests after click: median 3 per switch; templates: POST /api/accounts/{acct}/folders/{acct}%3AINBOX/consistency, GET /api/accounts/{acct}/threads, GET /api/accounts/{acct}/imap/stream; median old bytes 348852
Stream (re)opens per switch: /api/me/events 0, imap/stream 2; non-200 statuses: []
Long tasks: median count 7, median total 828 ms, median max 233 ms; long-task ms before first rows: 434; DOM mutation records 270 in 12 frames
