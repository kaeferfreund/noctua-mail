#!/bin/bash
set -u
W=/home/monkey/code/noctua-mail/wt-perf-account-batching; B=/home/monkey/code/noctua-mail/briefs/perf-account-batching
for sha in "$@"; do
  d=$W/.tmp/c-$sha; rm -rf "$d"; mkdir -p "$d"
  git -C $W archive $sha | tar -x -C "$d"; ln -s $W/node_modules "$d/node_modules"; cp $W/.env.local "$d/" 2>/dev/null
  echo "== $sha load $(cut -d' ' -f1-3 /proc/loadavg)"
  (cd "$d" && TMPDIR=$W/.tmp/tmp nice -n 10 bun --tsconfig-override tsconfig.json $B/sqlcount.ts $W/.tmp/sqlcount-$sha.json > $W/.tmp/sqlcount-$sha.log 2>&1; echo "exit $?")
  rm -rf "$d"
done
echo ALLDONE
