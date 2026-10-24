#!/bin/bash
# usage: measure-variant.sh <variant-label>
cd /home/monkey/code/noctua-mail/wt-perf-mailbox-switch/.tmp/e2e/h
G=/home/monkey/code/noctua-mail/wt-perf-mailbox-switch/.tmp/gate.sh
R=/home/monkey/code/noctua-mail/wt-perf-mailbox-switch/.tmp/e2e/results
$G $R/$1-cold.log node measure.mjs --series $1-cold --mode cold --reps 10 --pairs small:large,large:small,small:folders
$G $R/$1-warm.log node measure.mjs --series $1-warm --mode warm --reps 10 --pairs small:large,medium:large,small:folders,folders:large
echo DONE-$1
