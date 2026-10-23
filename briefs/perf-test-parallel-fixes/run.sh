#!/bin/bash
# Gate re-run for perf/test-parallel-fixes (018452b). Outputs go to /tmp/pfix-gates.
W=/home/monkey/code/noctua-mail/wt-test-parallel-fixes
SHARED=/home/monkey/code/noctua-mail/noctua-data
OUT=/tmp/pfix-gates
export TMPDIR=$OUT/tmp
mkdir -p "$TMPDIR"
cd "$W" || exit 1
touch $OUT/marker
cnt() { ls -d "$TMPDIR"/mywebmail-test-db-* 2>/dev/null | wc -l; }
sinks() { ls -d "$TMPDIR"/boundary-smtp-* "$TMPDIR"/sender-smtp-* /tmp/boundary-smtp-* /tmp/sender-smtp-* 2>/dev/null | wc -l; }
# fd poller: any process with cwd in the worktree holding an fd under the shared data dir
( while [ ! -f $OUT/stop ]; do
    for p in /proc/[0-9]*; do
      [ "$(readlink $p/cwd 2>/dev/null)" = "$W" ] || continue
      ls -l $p/fd 2>/dev/null | grep -F "$SHARED/" | sed "s|^|$(date -u +%T) pid=${p#/proc/} |"
    done
    sleep 0.5
  done > $OUT/shared-fd-hits.txt ) &
POLL=$!
echo "start $(date -u +%T) load=$(cut -d' ' -f1 /proc/loadavg) dirs=$(cnt) sinks=$(sinks) undefined=$(ls -d $W/undefined 2>/dev/null | wc -l)" > $OUT/summary.txt
for seed in 1337 4242 9001; do
  b=$(cnt); t0=$(date +%s); l0=$(cut -d' ' -f1 /proc/loadavg)
  nice -n 10 bun run test:stress-parallel -- --seed=$seed > $OUT/stress-$seed.log 2>&1; rc=$?
  t1=$(date +%s)
  echo "stress seed=$seed rc=$rc wall=$((t1-t0))s load_start=$l0 load_end=$(cut -d' ' -f1 /proc/loadavg) dirs_before=$b dirs_after=$(cnt) sinks=$(sinks) $(grep -E '^ *[0-9]+ (pass|fail)' $OUT/stress-$seed.log | tr -s ' \n' ' ')" >> $OUT/summary.txt
done
b=$(cnt); t0=$(date +%s)
nice -n 10 bun run test:ci > $OUT/testci.log 2>&1; rc=$?
t1=$(date +%s)
echo "test:ci rc=$rc wall=$((t1-t0))s dirs_before=$b dirs_after=$(cnt) sinks=$(sinks) $(grep -E '^ *[0-9]+ (pass|fail)' $OUT/testci.log | tr -s ' \n' ' ')" >> $OUT/summary.txt
touch $OUT/stop; wait $POLL
echo "shared-dir fd hits: $(wc -l < $OUT/shared-fd-hits.txt); shared files newer than marker: $(find $SHARED -newer $OUT/marker 2>/dev/null | wc -l); undefined dir: $(ls -d $W/undefined 2>/dev/null | wc -l)" >> $OUT/summary.txt
echo "done $(date -u +%T)" >> $OUT/summary.txt
