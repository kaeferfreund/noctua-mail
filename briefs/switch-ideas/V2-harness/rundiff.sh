#!/bin/bash
# rundiff.sh <checkout-dir> <label> [topics 0|1]
set -u
W=/home/monkey/code/noctua-mail/repo/wt-switch-server/.tmp
dir=$1; label=$2; t=${3:-1}
(cd "$dir" && SWITCH_ROOT=$dir SWITCH_TOPICS=$t SWITCH_FIXTURE_ONLY=syn-s0,syn-m0,syn-l0 TMPDIR=$W/data/tmp nice -n 15 bun --tsconfig-override tsconfig.json $W/harness/v2diff.ts $W/results/diff-$label.json 2>&1 | grep -v '^\[\|dataDir\|dbPath\|^}' > $W/results/diff-$label.log)
echo "diff-$label exit $?"
