#!/bin/bash
# Runs all Spike A series sequentially. Logs to /tmp/spike-switch-e2e/results/*.log
set -u
cd /tmp/spike-switch-e2e/h
R=/tmp/spike-switch-e2e/results; mkdir -p $R
run() { local name=$1; shift; echo "== $name $(date -u +%T) $(uptime)" | tee -a $R/series.log; nice -n 10 node measure.mjs --series $name "$@" > $R/$name.log 2>&1; echo "   exit $? $(date -u +%T)" | tee -a $R/series.log; }
rm -f /tmp/spike-switch-e2e/inject.flag
run cold --mode cold --reps 10 --pairs small:large,large:small,medium:large,large:medium,small:folders,folders:large
run warm --mode warm --reps 10 --pairs small:large,medium:large,small:folders,folders:large
touch /tmp/spike-switch-e2e/inject.flag
run contention-watcher --mode warm --reps 10 --pairs small:large,medium:large
rm -f /tmp/spike-switch-e2e/inject.flag
run contention-second-tab --mode warm --reps 10 --pairs small:large,medium:large --second-tab
echo "ALL DONE $(date -u +%T)" | tee -a $R/series.log
