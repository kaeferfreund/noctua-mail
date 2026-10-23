#!/usr/bin/env bash
# Trial driver: runs each step sequentially, gated on 1-min load < 10.
cd /home/monkey/code/noctua-mail/wt-test-parallel || exit 1
export TMPDIR=$PWD/.tmp/parallel/tmp
L=$PWD/.tmp/parallel/logs
S=$L/summary.tsv
[ -f "$S" ] || printf 'step\tstart\tload_before\twall_s\texit\tload_after\tload_max_during\n' > "$S"
wait_load() {
  while :; do
    l=$(cut -d' ' -f1 /proc/loadavg)
    awk -v l="$l" 'BEGIN{exit !(l<10)}' && return
    echo "$(date -u +%T) load $l >= 10, waiting" >> "$L/driver.log"; sleep 60
  done
}
run() {
  name=$1; shift
  wait_load
  lb=$(cut -d' ' -f1-3 /proc/loadavg)
  ss -ltnH > "$L/$name.ports-before" 2>/dev/null
  ( while :; do echo "$(date -u +%T) $(cut -d' ' -f1-3 /proc/loadavg)"; sleep 15; done ) > "$L/$name.load" &
  sp=$!
  st=$(date -u +%FT%TZ); t0=$(date +%s.%N)
  nice -n 10 "$@" > "$L/$name.log" 2>&1; ec=$?
  t1=$(date +%s.%N)
  kill $sp 2>/dev/null; wait $sp 2>/dev/null
  la=$(cut -d' ' -f1-3 /proc/loadavg)
  lm=$(awk '{print $2}' "$L/$name.load" | sort -n | tail -1)
  ss -ltnH > "$L/$name.ports-after" 2>/dev/null
  find . -maxdepth 1 -newer "$L/$name.ports-before" ! -name . ! -name .tmp > "$L/$name.new-toplevel"
  git status --porcelain --ignored | grep -v -E '^!! (node_modules/|\.tmp/|\.env\.local)' > "$L/$name.gitstatus"
  printf '%s\t%s\t%s\t%.1f\t%s\t%s\t%s\n' "$name" "$st" "$lb" "$(awk -v a=$t0 -v b=$t1 'BEGIN{print b-a}')" "$ec" "$la" "$lm" >> "$S"
}
for step in "$@"; do
  case $step in
    probe1|probe2|probe3) run $step bun run test:parallel-probe ;;
    sp1337) run $step bun run test:stress-parallel -- --seed=1337 ;;
    sp4242) run $step bun run test:stress-parallel -- --seed=4242 ;;
    sp9001) run $step bun run test:stress-parallel -- --seed=9001 ;;
    serial-stress) run $step bun run test:stress ;;
  esac
done
echo "$(date -u +%T) DONE $*" >> "$L/driver.log"
