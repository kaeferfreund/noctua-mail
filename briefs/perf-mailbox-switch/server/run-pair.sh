#!/bin/bash
# Alternating base/proto runs of switch.ts with a load gate (1-min load < 10, 30 s polls, max 10 min, then runs anyway).
# Usage: run-pair.sh OUTDIR LABEL...   labels: base (= worktree) | proto (= worktree/.tmp/proto)
set -u
W=/home/monkey/code/noctua-mail/wt-spike-switch-server; D=/home/monkey/code/noctua-mail/data/noctua-data-spike-switch-server
H=$(cd "$(dirname "$0")" && pwd); out=$1; shift; mkdir -p "$out" "$D/tmp"
n=0
for label in "$@"; do
  n=$((n+1)); dir=$W; [ "$label" = proto ] && dir=$W/.tmp/proto
  for i in $(seq 1 20); do l=$(cut -d' ' -f1 /proc/loadavg); awk "BEGIN{exit !($l < 10)}" && break; echo "wait $i load $l"; sleep 30; done
  echo "run $n $label start $(cat /proc/loadavg) $(date -u +%FT%TZ)"
  (cd "$dir" && SWITCH_ROOT=$dir TMPDIR=$D/tmp timeout 1800 nice -n 10 bun --tsconfig-override tsconfig.json "$H/switch.ts" "$out/$n-$label.json" 2>&1 | grep -v '^\[\|dataDir\|dbPath\|^}' > "$out/$n-$label.log")
  echo "run $n $label exit $? end $(cat /proc/loadavg) $(date -u +%FT%TZ)"
done
