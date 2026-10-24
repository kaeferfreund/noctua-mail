#!/bin/bash
# usage: ab.sh <mode> <pairs> <reps> name:build [name:build ...]  -- sequential series, one server per series
S=/home/monkey/code/noctua-mail/wt-perf-switch-2/.tmp/e2e; mode=$1; pairs=$2; reps=$3; shift 3
for nb in "$@"; do n=${nb%%:*}; b=${nb#*:}
  $S/swap-server.sh $n /home/monkey/code/noctua-mail/wt-perf-switch-2/.tmp/build-$b >/dev/null
  sleep 3
  echo "== $n ($b) $mode"; $S/series.sh $n $mode $pairs $reps 2>&1 | grep -E "^(warm|cold):"
done
