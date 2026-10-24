#!/bin/bash
# usage: round.sh <label> <variant>  -- restarts the server on <variant>, runs one warm series
E=/home/monkey/code/noctua-mail/repo/wt-switch-tree/.tmp/e2e
cd $E
P=$(cat server.pid); kill $P 2>/dev/null; for i in $(seq 1 30); do kill -0 $P 2>/dev/null || break; sleep 1; done
h/start-server.sh $1 $2 > server.pid
for i in $(seq 1 90); do curl -s -o /dev/null http://127.0.0.1:3950/ && break; sleep 1; done; sleep 25
cd h; TMPDIR=$E/tmp nice -n 10 node measure.mjs --series $1 --mode warm --reps 10 --pairs small:folders,large:folders,small:large --out ../results > ../results/$1.log 2>&1
echo "ROUND $1 exit $? $(date -u +%T)"
