#!/bin/bash
# usage: start-server.sh <logname> <variant>  -> prints PID of bun server
. /home/monkey/code/noctua-mail/repo/wt-switch-tree/.tmp/e2e/env.sh
cd /home/monkey/code/noctua-mail/repo/wt-switch-tree/.tmp/standalone-${2:?variant}
PORT=3950 HOSTNAME=127.0.0.1 nohup nice -n 10 bun --bun server.js > /home/monkey/code/noctua-mail/repo/wt-switch-tree/.tmp/e2e/server-$1.log 2>&1 &
echo $!
