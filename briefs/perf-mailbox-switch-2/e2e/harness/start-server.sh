#!/bin/bash
# usage: start-server.sh <logname> <standalone-dir>  -> prints PID of bun server
. /home/monkey/code/noctua-mail/wt-perf-switch-2/.tmp/e2e/env.sh
cd "$2"
PORT=3920 HOSTNAME=127.0.0.1 nohup nice -n 10 bun --bun server.js > /home/monkey/code/noctua-mail/wt-perf-switch-2/.tmp/e2e/server-$1.log 2>&1 &
echo $!
