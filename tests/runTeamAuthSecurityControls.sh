#!/bin/bash
# Adapted reviewer runner: current worktree, rejecting S1/S2 probes, allowed ports only.
set -euo pipefail
checkout=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
bun_binary=$(readlink -f -- "$(command -v bun)")
mkdir -p "$checkout/.tmp"
stage=$(mktemp -d "$checkout/.tmp/security-controls.XXXXXXXX")
trap 'rm -rf -- "$stage"' EXIT
mkdir -p "$stage/source"
python3 - "$checkout" "$stage/source" <<'PY'
import pathlib, shutil, subprocess, sys
root, target = map(pathlib.Path, sys.argv[1:])
for name in subprocess.check_output(['git', '-C', str(root), 'ls-files', '--cached', '--others', '--exclude-standard', '-z']).decode().split('\0'):
    if not name: continue
    source = root / name
    if not source.is_file(): continue
    destination = target / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
PY
mkdir "$stage/source/node_modules"
if [[ $# -eq 0 ]]; then
  set -- test --timeout 20000 tests/teamAuthSecurityControls.test.ts lib/teamAuthSlice5.test.ts app/api/admin/users/route.test.ts lib/db/authPolicy.test.ts lib/authLifetimeLock.test.ts
fi
# SWC's native loader rejects group-writable cache ancestors. Keep the sandbox
# home/cache private even when the host uses a group-writable umask.
nice -n 10 timeout --signal=TERM --kill-after=3 240 prlimit --cpu=180 --as=17179869184 --nproc=2048 --nofile=512 --fsize=67108864 --core=0 \
  bwrap --unshare-all --die-with-parent --new-session --cap-drop ALL --clearenv \
  --ro-bind /usr /usr --ro-bind /lib /lib --symlink usr/bin /bin \
  --ro-bind "$bun_binary" /tool/bun --ro-bind "$stage/source" /app \
  --ro-bind "$checkout/node_modules" /app/node_modules --proc /proc --dev /dev \
  --size 536870912 --tmpfs /scratch --setenv PATH /tool:/usr/bin \
  --setenv HOME /scratch/home --setenv TMPDIR /scratch/tmp --setenv XDG_CACHE_HOME /scratch/cache \
  --setenv BUN_RUNTIME_TRANSPILER_CACHE_PATH 0 --setenv JSC_useJIT false \
  --setenv JSC_useGigacage false --setenv JSC_useWebAssembly false --setenv BETTER_AUTH_TELEMETRY 0 \
  --chdir /app /bin/bash -c 'umask 077; mkdir -p /scratch/home /scratch/tmp /scratch/cache; exec /tool/bun --no-env-file "$@"' review-sandbox "$@"
