#!/bin/bash
# usage: mkbuild.sh <name>  -- production build of the worktree into .tmp/build-<name>
cd /home/monkey/code/noctua-mail/wt-perf-switch-2; export TMPDIR=$PWD/.tmp
(rm -rf .next && nice -n 10 bun run build) > .tmp/build-$1.log 2>&1 || { echo build failed; tail -20 .tmp/build-$1.log; exit 1; }
P=.tmp/build-$1; rm -rf $P; cp -r .next/standalone $P && cp -r public/. $P/public/ && mkdir -p $P/.next && cp -r .next/static $P/.next/static && (cd $P && APP_ENV_LABEL=SPIKE ENV_FILE=/nonexistent bun ../../build-scripts/generateRuntimeConfig.ts >/dev/null) && echo built $P $(git rev-parse --short HEAD)
