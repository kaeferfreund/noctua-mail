#!/bin/bash
# usage: swap-server.sh <logname> <standalone-dir>
S=/home/monkey/code/noctua-mail/wt-perf-switch-2/.tmp/e2e
. $S/secret.sh
old=$(cat $S/server.pid 2>/dev/null); if [ -n "$old" ] && kill -0 $old 2>/dev/null; then kill $old; for i in $(seq 50); do kill -0 $old 2>/dev/null || break; sleep 0.2; done; fi
pid=$($S/start-server.sh $1 $2); echo $pid > $S/server.pid
for i in $(seq 60); do curl -s -o /dev/null http://127.0.0.1:3920/ && break; sleep 0.5; done
echo started $pid
