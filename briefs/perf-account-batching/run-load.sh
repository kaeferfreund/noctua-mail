#!/bin/bash
# Usage: run-load.sh CHECKOUT VARIANT SAMPLE   (variant prepared by prepare.py into CHECKOUT/.tmp/VARIANT)
# Waits (30 s polls, max 20 min) for 1-min load < 10, then runs one 60 s sample under nice -n 10.
set -u
checkout=$1; variant=$2; sample=$3; B=$(cd "$(dirname "$0")" && pwd)
out=$checkout/.tmp/load-$sample; rm -rf "$out"; mkdir -p "$B/logs" "$checkout/.tmp/tmp"
for i in $(seq 1 40); do l=$(cut -d' ' -f1 /proc/loadavg); awk "BEGIN{exit !($l < 10)}" && break; echo "wait $i load $l"; sleep 30; done
echo "start load $(cat /proc/loadavg) at $(date -u +%FT%TZ)"
cd "$checkout/.tmp/$variant"
TMPDIR=$checkout/.tmp/tmp REVIEW_OUT=$out REVIEW_DURATION=60000 nice -n 10 timeout 300 bun scripts/reviewLoad.ts > "$B/logs/load-$sample.log" 2>&1
echo "exit $? end load $(cat /proc/loadavg) at $(date -u +%FT%TZ)"
mkdir -p "$B/results/$sample"; cp -r "$out"/main.json "$out"/child-*.json "$out"/started.json "$out"/metrics "$B/results/$sample/" 2>/dev/null
python3 "$B/summarize.py" "$B/results/$sample" > "$B/results/$sample/summary.json" && echo summarized
