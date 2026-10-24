#!/bin/bash
# Re-runs: proto contention 'all'+'quiet-2' with thrown-error capture; normalized-hash topics anatomy base/proto.
set -u
W=/home/monkey/code/noctua-mail/wt-spike-switch-server; D=/home/monkey/code/noctua-mail/data/noctua-data-spike-switch-server
H=/tmp/spike-switch-server; out=$H/rest; mkdir -p $out $D/tmp
gate() { for i in $(seq 1 20); do l=$(cut -d' ' -f1 /proc/loadavg); awk "BEGIN{exit !($l < 10)}" && return; echo "wait $i load $l"; sleep 30; done; }
for spec in "load proto" "load base" "anatomy base" "anatomy proto"; do
  set -- $spec; kind=$1; label=$2; dir=$W; [ "$label" = proto ] && dir=$W/.tmp/proto
  gate; echo "run $kind $label start $(cat /proc/loadavg) $(date -u +%FT%TZ)"
  if [ $kind = anatomy ]; then
    (cd $dir && SWITCH_TOPICS=1 SWITCH_FIXTURE_ONLY=syn-m0,syn-l0 SWITCH_ROOT=$dir TMPDIR=$D/tmp timeout 1200 nice -n 10 bun --tsconfig-override tsconfig.json $H/anatomy.ts $out/anatomy-topics2-$label.json > $out/anatomy-topics2-$label.full.log 2>&1)
  else
    (cd $dir && SWITCH_PHASES=all,quiet-2 SWITCH_ROOT=$dir TMPDIR=$D/tmp timeout 900 nice -n 10 bun --tsconfig-override tsconfig.json $H/switch-load.ts $out/load2-$label.json > $out/load2-$label.full.log 2>&1)
  fi
  echo "run $kind $label exit $? end $(cat /proc/loadavg) $(date -u +%FT%TZ)"
done
echo ALL-DONE
