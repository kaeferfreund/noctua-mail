#!/bin/bash
# Topics-present anatomy (base, proto) then the 6-phase contention load (base, proto); load gate per run.
set -u
W=/home/monkey/code/noctua-mail/wt-spike-switch-server; D=/home/monkey/code/noctua-mail/data/noctua-data-spike-switch-server
H=/tmp/spike-switch-server; out=$H/rest; mkdir -p $out $D/tmp
gate() { for i in $(seq 1 20); do l=$(cut -d' ' -f1 /proc/loadavg); awk "BEGIN{exit !($l < 10)}" && return; echo "wait $i load $l"; sleep 30; done; }
for spec in "anatomy base" "anatomy proto" "load base" "load proto"; do
  set -- $spec; kind=$1; label=$2; dir=$W; [ "$label" = proto ] && dir=$W/.tmp/proto
  gate; echo "run $kind $label start $(cat /proc/loadavg) $(date -u +%FT%TZ)"
  if [ $kind = anatomy ]; then
    (cd $dir && SWITCH_TOPICS=1 SWITCH_FIXTURE_ONLY=syn-m0,syn-l0 SWITCH_ROOT=$dir TMPDIR=$D/tmp timeout 1200 nice -n 10 bun --tsconfig-override tsconfig.json $H/anatomy.ts $out/anatomy-topics-$label.json 2>&1 | grep -v '^\[\|dataDir\|dbPath\|^}' > $out/anatomy-topics-$label.log)
  else
    (cd $dir && SWITCH_ROOT=$dir TMPDIR=$D/tmp timeout 1500 nice -n 10 bun --tsconfig-override tsconfig.json $H/switch-load.ts $out/load-$label.json 2>&1 | grep -E '^\[phase\]|^\[imap-probe\]|rror:' > $out/load-$label.log)
  fi
  echo "run $kind $label exit $? end $(cat /proc/loadavg) $(date -u +%FT%TZ)"
done
echo ALL-DONE
