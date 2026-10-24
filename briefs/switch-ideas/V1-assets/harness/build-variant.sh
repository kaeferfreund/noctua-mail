#!/bin/bash
# usage: build-variant.sh <label>  -> .tmp/standalone-<label> from the current working tree
set -e
cd /home/monkey/code/noctua-mail/repo/wt-switch-tree
V=$1
rm -rf .next
TMPDIR=$PWD/.tmp/tmp nice -n 15 bun run build
rm -rf .tmp/standalone-$V && cp -r .next/standalone .tmp/standalone-$V
cp -r public/. .tmp/standalone-$V/public/ && cp -r .next/static .tmp/standalone-$V/.next/static
(cd .tmp/standalone-$V && APP_ENV_LABEL=SPIKE ENV_FILE=/nonexistent bun ../../build-scripts/generateRuntimeConfig.ts)
echo BUILD-$V-OK
