# Spike B harness: mailbox switch, client path

Base: `647359b` (dev preview, round 9.1). Brief: `../../perf-mailbox-switch-client.md`.

| File | What it is |
| --- | --- |
| `switchRequests.spike.dom.test.tsx` | Full `MailClient` mount (happy-dom). Only `fetch`, `EventSource` and `requestIdleCallback` are replaced. Responses are released in **waves**: the harness waits until the client is quiet (no new request for 260 ms, which covers the 160 ms count debounce and idle work), then releases every pending response at once. A request first seen after wave N depends on N round trips. It records every request per wave, stale requests for the old mailbox, `EventSource` opens, React `Profiler` commits, and per-wave DOM probes (active row, visible list rows, topic names, virtual-folder count badges). |
| `useAccountController.proto.spike.ts` | Prototype of design D1: a parallel, atomic switch with no `/auth/me`. Swapped in with `SPIKE_PROTO=1` via `mock.module`, so no tracked file changes. `useAccountController.proto.diff` is the diff against `647359b`. |
| `useAccountController.switch.spike.dom.test.tsx` | Draft tests for D1 (8 cases). All pass on the prototype; all 6 core cases fail on `647359b`. |
| `trace-base.json` | Baseline trace: boot, then A→B, B→A, A→B. |
| `trace-proto.json` | The same run against the D1 prototype. |
| `trace-hold-stale.json` | Baseline with the stale old-mailbox list request held (`SPIKE_HOLD_STALE=1`), to show head-of-line blocking. |
| `trace-deeplink-{base,proto}.json` | Boot with `?accountId=account-b&messageId=…` (`SPIKE_DEEPLINK=1`). |

## Run (from a worktree at the base commit)

```sh
cp briefs/perf-mailbox-switch/client/*.spike.* app/components/mailclient/
mkdir -p /tmp/spike-switch-client
nice -n 10 bun test --config=bunfig.dom.toml app/components/mailclient/switchRequests.spike.dom.test.tsx               # baseline
SPIKE_PROTO=1 SPIKE_OUT=/tmp/spike-switch-client/trace-proto.json nice -n 10 bun test --config=bunfig.dom.toml app/components/mailclient/switchRequests.spike.dom.test.tsx
SPIKE_HOLD_STALE=1 SPIKE_OUT=/tmp/spike-switch-client/hold.json nice -n 10 bun test --config=bunfig.dom.toml app/components/mailclient/switchRequests.spike.dom.test.tsx
SPIKE_DEEPLINK=1 SPIKE_OUT=/tmp/spike-switch-client/deeplink.json nice -n 10 bun test --config=bunfig.dom.toml app/components/mailclient/switchRequests.spike.dom.test.tsx
nice -n 10 bun test --config=bunfig.dom.toml app/components/mailclient/useAccountController.switch.spike.dom.test.tsx  # D1 spec on the prototype
# delete the copied *.spike.* files afterwards
```

## Limits

- Wave counts measure dependency depth (round trips), not milliseconds. Real latency is per-hop server time plus RTT; spikes A and C supply those numbers.
- Fixtures: 2 synthetic mailboxes with 4 folders each, a 2-message list, and an empty calendar, members, aliases and identities. The fan-out does not depend on data size; per-request cost does.
- Requests that are aborted client-side (for example the first round of virtual counts) are still counted: a browser has already sent them, and the server still does the work.
