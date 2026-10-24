#!/bin/bash
# usage: build-from.sh <variant>  -- copies .tmp/variants/<variant> over the tree, builds, restores the head files
set -e
cd /home/monkey/code/noctua-mail/repo/wt-switch-tree
V=.tmp/variants
trap 'cp -r $V/head/. . ; git status --short' EXIT
cp -r $V/$1/. .
.tmp/build-variant.sh $1
