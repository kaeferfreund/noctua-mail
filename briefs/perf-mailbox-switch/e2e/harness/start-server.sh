#!/bin/bash
# usage: start-server.sh <logname>  -> prints PID of bun server
. /tmp/spike-switch-e2e/env.sh
cd /home/monkey/code/noctua-mail/wt-spike-switch-e2e/.next/standalone
PORT=3905 HOSTNAME=127.0.0.1 nohup nice -n 10 bun --bun server.js > /tmp/spike-switch-e2e/server-$1.log 2>&1 &
echo $!
