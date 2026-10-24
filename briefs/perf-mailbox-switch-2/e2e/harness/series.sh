#!/bin/bash
# usage: series.sh <series> <mode> <pairs> <reps>  -- waits for 1-min load <= 12, logs uptime
cd "$(dirname "$0")/h"
while :; do l=$(cut -d' ' -f1 /proc/loadavg); awk -v l=$l 'BEGIN{exit !(l<=12)}' && break; sleep 15; done
echo "$1 before: $(uptime)" >> ../results/series.log
nice -n 10 node measure.mjs --series $1 --mode $2 --pairs $3 --reps $4 > ../results/$1.log 2>&1
echo "$1 after: $(uptime)" >> ../results/series.log
node -e 'const r=require(process.argv[1]); for (const [k,v] of Object.entries(r.summary)) console.log(k.padEnd(28), "n", v.n, "first", v.firstRows.p50, "/", v.firstRows.p90, "settled", v.settled.p50, "/", v.settled.p90, "reqs", v.requests, "lt", v.longTaskMs)' ../results/$1.json
