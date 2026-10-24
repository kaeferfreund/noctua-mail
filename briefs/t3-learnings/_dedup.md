# T3 Code learnings — deduplicated (orchestrator, 2026-10-23 ~19:45 UTC)

Sources: rendering.md (R#), data-loading.md (D#), mobile-navigation.md (M#). Reference stage 34dd18e.

| Cluster | Ideas | Proposal |
|---|---|---|
| N Deep-link navigation: one history owner with existing mobile Back hooks, phased cold-link resolution, semantic scroll anchors, one parse/serialize module (Copy link, SW notification) | M1 M2 M3 M9, R7 R10 | passed to running feat-deep-links (steer 19:35) |
| Q Quick UI perf: draft "saved x s ago" clock re-renders MailClient every second → leaf label; virtual list re-measures on pane reveal (phone Back) not only window resize; reader cards get per-message props + memo (one card changes → one card renders) | R1, M5/R6, R3 | **package A** (one Opus task, self-check + measurement) |
| L Long conversations: /thread/related returns headers only + bounded window around the selected message, bodies on expand via local detail route; IMAP resync only when content is really missing; abort/own superseded detail reads | D1 D2 D3 D4 D8, R8 (virtualize reader later) | **package B** (measure first on 200-message synthetic thread; API + reader; one review) |
| E Equal pushes/refetches keep references (folder stream, collab summaries, refreshed rows) | R4, D6 | backlog I (extend) |
| S Expanded suggestion group renders all rows (virtualizer bounds sections only) | R2 | backlog (measure real group sizes first) |
| C Body cache budget by bytes, release hidden heavy reader content on phones | M6, D5 | after go-live |
| W Warm per-destination snapshots without showing old content | M4 | after go-live (overlaps switch work) |
| F Folder tree virtualization above threshold | R9 | overlaps V1 folder-tree branch; only if V1 numbers show need |
| X Reconnect replay, keyset paging, conversation-local find | D7 D8 D9 | after go-live / only on evidence |
| — skeletons/animations | M8 | keep current lightweight feedback; nothing to do |
