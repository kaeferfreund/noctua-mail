#!/bin/bash
# Final base (7425f75 = stage a504783 + e40b131) vs head (c03efbc) e2e: ABBA, warm then cold.
S=/home/monkey/code/noctua-mail/wt-perf-switch-2/.tmp/e2e
$S/ab.sh warm small:large,large:small 10 fw1-base:base2 fw1-head:final fw2-head:final fw2-base:base2
$S/ab.sh cold small:large,large:small 8 fc1-base:base2 fc1-head:final fc2-head:final fc2-base:base2
echo FINAL-DONE
