#!/bin/bash
# ABBA rounds: restart the server per variant, gate every series on load <= 12.
E=/home/monkey/code/noctua-mail/wt-perf-mailbox-switch/.tmp/e2e
G=/home/monkey/code/noctua-mail/wt-perf-mailbox-switch/.tmp/gate.sh
cd $E
start() { h/start-server.sh $1 $2 > server.pid; for i in $(seq 1 90); do curl -s -o /dev/null http://127.0.0.1:3917/ && break; sleep 1; done; sleep 25; curl -s -o /dev/null http://127.0.0.1:3917/api/auth/me; }
stop() { P=$(cat server.pid); kill $P; for i in $(seq 1 30); do kill -0 $P 2>/dev/null || break; sleep 1; done; }
n=0
for v in base head head base; do
  n=$((n+1)); label=r$n-$v
  start $label $v
  cd h
  $G $E/results/$label-warm.log node measure.mjs --series $label-warm --mode warm --reps 5 --pairs small:large,medium:large,small:folders,folders:large
  $G $E/results/$label-cold.log node measure.mjs --series $label-cold --mode cold --reps 5 --pairs small:large,large:small,small:folders
  cd ..
  stop
  echo "round $label done $(date -u +%T)"
done
echo ABBA-DONE
