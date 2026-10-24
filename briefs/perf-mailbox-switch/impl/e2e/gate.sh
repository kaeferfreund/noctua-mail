#!/bin/bash
# usage: gate.sh <logfile> <command...>  -- waits until the 1-min load is <= 12, then runs the command under nice.
log=$1; shift
while :; do l=$(cut -d' ' -f1 /proc/loadavg); if awk "BEGIN{exit !($l <= 12)}"; then break; fi; echo "$(date -u +%T) load $l > 12, waiting" >> $log.wait; sleep 30; done
echo "$(date -u +%T) start load $l: $*" > $log
TMPDIR=/home/monkey/code/noctua-mail/wt-perf-mailbox-switch/.tmp/tmp nice -n 10 "$@" >> $log 2>&1
echo "EXIT $? $(date -u +%T)" >> $log
