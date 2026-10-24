# perf-mailbox-switch / server (spike C harness, outside git)

Report: `../../perf-mailbox-switch-server.md` (§10 has the commands and the file table). All data synthetic; no secrets
(the only credential-like strings are the IMAP fixture's synthetic `demo` login in the fixture code path, not stored here).

results/:
- `1-base.json` … `4-proto.json` (+ `.log`): paired per-route runs (run-pair.sh). 3/4 is the clean pair (load 7–9).
- `switch-647359b-load13-21.json`: first full run at host load 13–21 (noisy, not used for the headline numbers).
- `anatomy.json` (no topics), `anatomy-topics2-{base,proto}.json` (normalized hashes), `anatomy-topics-*.json` (first run, raw hashes differ only by random topic ids).
- `listsql.json` (11k statements + EXPLAIN), `sqlvariants.json` (equivalence-checked rewrites).
- `load-{base,proto}.json` (6 phases; proto stopped in `all`), `load2-{base,proto}.json` (`all` + `quiet-2` re-run with thrown-error capture), `load2-*.exhausted.log` (the retry exhaustion excerpts).
- `cpu-profile-threads-loop.md` (base, no topics), `cpu-profile-topics-proto.md` (prototype, with topics).
