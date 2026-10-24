#!/bin/bash
# runbench.sh <checkout-dir> <label>  -> results/<label>-notopics.json, results/<label>-topics.json
set -u
W=/home/monkey/code/noctua-mail/repo/wt-switch-server/.tmp
dir=$1; label=$2
for t in 0 1; do
  name=$label-$([ $t = 1 ] && echo topics || echo notopics)
  (cd "$dir" && SWITCH_ROOT=$dir SWITCH_TOPICS=$t SWITCH_FIXTURE_ONLY=syn-m0,syn-l0 TMPDIR=$W/data/tmp nice -n 15 bun --tsconfig-override tsconfig.json $W/harness/v2bench.ts $W/results/$name.json 2>&1 | grep -v '^\[\|dataDir\|dbPath\|^}' > $W/results/$name.log)
  echo "$name exit $?"
done
