# Round 5 contention evidence

`load.ts.txt` and `dbProbe.ts.txt` are the round-4 review's preserved synthetic
load harness and instrumentation. The `.txt` suffix keeps these archive templates
out of production TypeScript and test discovery. `measure.py` installs them only
in disposable archives under this checkout's `.tmp`.

Run from `wt-sender-2`, after installing dependencies:

```sh
nice -n 10 python3 doc/sender-identities-r5/measure.py
```

The runner refuses to overwrite existing archives. It measures exact `9424150`
and `d5ae17b` trees plus the current production files, interleaves two runs per
variant, uses `TMPDIR=$PWD/.tmp`, records source hashes, and leaves its full raw
logs and per-process timing samples in `.tmp`. Preserve results before removing
that scratch directory. Do not run verification gates concurrently with load.

Each measurement uses a 60-second common window, 11,000 synthetic local rows,
a real synthetic IMAP fixture on ephemeral loopback ports, two persistent sync
subprocesses with production queue/reserve/release APIs, the production watcher
and ordinary watcher subprocesses, one injected message per second, continuous
production draft saves, and an independent zero-timeout auth timestamp writer
at 50 ms. No Next HTTP server is involved. The enclosing Python process runs at
nice 10 and its timed command at nice 19, matching the r4 review protocol.

Worker completion/failure counts describe the two direct sync loops. Watcher
workers with DB activity and completed watcher cycles are separate metrics.
Retries and exhaustions aggregate all instrumented processes, including worker
startup. Hold sums count explicit outer immediate/manual transactions only;
autocommit writers, including the timestamp updater, are excluded. A transaction
crossing the measurement cutoff can produce a one-operation count difference.

The r4 revocation/COMMIT-failure probes are permanent in
`lib/outboundWrite.revocation.test.ts`. They allow a variable number of short
handshake retries while retaining every denial and rollback assertion. The
COMMIT probe additionally observes the published replacement files before
failure and checks restoration before the next authorization preparation.
`lib/outboundWrite.test.ts` checks planning, FTS identity/collision preservation,
master exclusion through shard commit, lock order, and unchanged coarse shard
retry handling. Existing `lib/outboundAuthorization.routes.test.ts` and its
`verifyOutboundAuthorization.ts` child fixture retain the r3 queued-microtask,
same-continuation and calendar-contention probes.


The final policy uses short retries first for guarded shard-to-master handshakes.
For master-only lease operations it preserves the original coarse pacing and
uses short acquisition recovery only immediately before exhaustion, within the
same 2160 ms wall budget. Callback/DML/COMMIT errors do not enter that recovery
path. This avoids the increased auth contention measured when every lease
collision was retried aggressively. Healthy child PID bindings and scheduler
renewals still take their authoritative writer lock, with no redundant UPDATE.

`acceptance.json` contains the two-run means, individual paired decisions,
start/end load averages and loaded hold distributions. Auth BUSY passes on the
two-run mean; the first individual pair is five events above baseline.
`integration.json` and `merge-tree.txt` record the code candidate's conflict with
stage `11dc3c5` and the three FTS resolution blocks plus the dangling planning
callback that must be removed when retaining v3's indexed identity writer.

`validation.json` records final gate outcomes and the original failed stress
history. `validation-logs.json.gz` preserves the gate output, including targeted
repetitions after fixing the two raw fixture master-write races. Those fixtures
now await the existing bounded coarse retry before testing the new state; their
assertions and timeouts are unchanged. Production source hashes in
`measurements.json` continue to identify the measured implementation.
