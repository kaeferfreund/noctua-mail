#!/bin/bash
# usage: mkbuild-src.sh <srcdir> <name>  -- production build of a source copy into .tmp/build-<name>
W=/home/monkey/code/noctua-mail/wt-perf-switch-2; cd $1; export TMPDIR=$W/.tmp
(rm -rf .next && nice -n 10 bun run build) > $W/.tmp/build-$2.log 2>&1 || { echo build failed; tail -20 $W/.tmp/build-$2.log; exit 1; }
P=$W/.tmp/build-$2; rm -rf $P; cp -r .next/standalone $P && cp -r public/. $P/public/ && mkdir -p $P/.next && cp -r .next/static $P/.next/static && (cd $P && APP_ENV_LABEL=SPIKE ENV_FILE=/nonexistent bun $W/build-scripts/generateRuntimeConfig.ts >/dev/null) && echo built $P
