#!/bin/bash
W=/home/monkey/code/noctua-mail/repo/wt-switch-server/.tmp
for r in 1 2; do
  $W/harness/runbench.sh $W/base base$r
  $W/harness/runbench.sh $W/final final$r
done
echo done
