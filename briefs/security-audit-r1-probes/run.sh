#!/bin/bash
# Read-only audit runner. No host network or real environment.
# Default: 26 integration/runtime probes. Run stream.test.ts separately because it mocks the IMAP transport.
# Do not select repository fixtures with ephemeral listeners; permitted ports are 3824/3825 only.
set -euo pipefail
checkout=/home/monkey/code/noctua-mail/wt-audit
probes=/home/monkey/code/noctua-mail/briefs/security-audit-r1-probes
bun_binary=$(readlink -f -- "$(command -v bun)")
mkdir -p "$checkout/.tmp"
stage=$(mktemp -d "$checkout/.tmp/security-controls.XXXXXXXX")
trap 'rm -rf -- "$stage"' EXIT
mkdir -p "$stage/source"
git -C "$checkout" archive HEAD | tar -x -C "$stage/source"
mkdir "$stage/source/audit-probes"
cp "$probes"/*.test.ts "$stage/source/audit-probes/"
mkdir "$stage/source/node_modules"
if [[ $# -eq 0 ]]; then
  set -- test --timeout 20000 audit-probes/integration.test.ts audit-probes/runtime.test.ts
fi
nice -n 10 timeout --signal=TERM --kill-after=3 240 prlimit --cpu=180 --as=17179869184 --nproc=2048 --nofile=512 --fsize=67108864 --core=0 \
  bwrap --unshare-all --die-with-parent --new-session --cap-drop ALL --clearenv \
  --ro-bind /usr /usr --ro-bind /lib /lib --symlink usr/bin /bin \
  --ro-bind "$bun_binary" /tool/bun --ro-bind "$stage/source" /app \
  --ro-bind "$checkout/node_modules" /app/node_modules --proc /proc --dev /dev \
  --size 536870912 --tmpfs /scratch --setenv PATH /tool:/usr/bin \
  --setenv HOME /scratch/home --setenv TMPDIR /scratch/tmp --setenv XDG_CACHE_HOME /scratch/cache \
  --setenv BUN_RUNTIME_TRANSPILER_CACHE_PATH 0 --setenv JSC_useJIT false \
  --setenv JSC_useGigacage false --setenv JSC_useWebAssembly false --setenv BETTER_AUTH_TELEMETRY 0 \
  --chdir /app /bin/bash -c 'mkdir -p /scratch/home /scratch/tmp /scratch/cache; exec /tool/bun --no-env-file "$@"' review-sandbox "$@"
