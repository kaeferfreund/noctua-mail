#!/bin/bash
set -euo pipefail
for ((attempt=0;attempt<480;attempt++)); do
  if ! kill -0 1005115 2>/dev/null; then break; fi
  sleep 2
done
if kill -0 1005115 2>/dev/null; then exit 99; fi
/tmp/perf-guards/run.sh /tmp/perf-guards/watcher.ts > /tmp/perf-guards/watcher.log 2>&1
/tmp/perf-guards/run.sh /tmp/perf-guards/anatomy.ts > /tmp/perf-guards/anatomy.log 2>&1
/tmp/perf-guards/run.sh /tmp/perf-guards/rawprod.ts > /tmp/perf-guards/rawprod.log 2>&1
/tmp/perf-guards/run.sh /tmp/perf-guards/probes.ts > /tmp/perf-guards/probes.log 2>&1
/tmp/perf-guards/run.sh /tmp/perf-guards/crash.ts > /tmp/perf-guards/crash.log 2>&1
/tmp/perf-guards/run.sh /tmp/perf-guards/flags.ts > /tmp/perf-guards/flags.log 2>&1
/tmp/perf-guards/run.sh /tmp/perf-guards/legacy-sites.ts > /tmp/perf-guards/legacy-sites.log 2>&1
printf 'done\n' > /tmp/perf-guards/remaining.done
