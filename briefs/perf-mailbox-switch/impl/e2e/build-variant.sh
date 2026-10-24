#!/bin/bash
# usage: build-variant.sh base|head  -> .tmp/standalone-<variant> (base = the 5 production files at e70c30b)
set -e
cd /home/monkey/code/noctua-mail/wt-perf-mailbox-switch
V=$1
FILES="app/components/mailclient/useAccountController.ts app/components/mailclient/useMessageData.ts app/components/mailclient/useTopics.ts app/components/mailclient/useSearchState.ts app/components/mailclient/composition/ComposeOrchestrator.tsx"
if [ "$V" = base ]; then git checkout e70c30b -- $FILES; fi
trap 'git checkout HEAD -- '"$FILES"'; git status --short' EXIT
rm -rf .next
TMPDIR=$PWD/.tmp/tmp nice -n 10 bun run build
rm -rf .tmp/standalone-$V && cp -r .next/standalone .tmp/standalone-$V
cp -r public/. .tmp/standalone-$V/public/ && cp -r .next/static .tmp/standalone-$V/.next/static
(cd .tmp/standalone-$V && APP_ENV_LABEL=SPIKE ENV_FILE=/nonexistent bun ../../build-scripts/generateRuntimeConfig.ts)
echo BUILD-$V-OK
