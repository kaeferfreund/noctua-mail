#!/bin/bash
# Independent fix-round-5 verification of ca1fb45. Never loads .env.local.
set -euo pipefail
review_root=/home/monkey/code/noctua-mail/wt-review-auth
probe_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
bun_binary=$(readlink -f -- "$(command -v bun)")
mkdir -p "$review_root/.tmp"
stage=$(mktemp -d "$review_root/.tmp/security-controls.XXXXXXXX")
cleanup() { rm -rf -- "$stage"; rmdir -- "$review_root/.tmp" 2>/dev/null || true; }
trap cleanup EXIT
mkdir -p "$stage/source"
nice -n 10 git -C "$review_root" archive ca1fb45362b5444c6d362347c01ad8bb5eb66d8f | nice -n 10 tar -x -C "$stage/source"
mkdir "$stage/source/node_modules"
if [[ "${1:-test}" != check ]]; then cp -- "$probe_dir/additional.test.ts" "$stage/source/additional.test.ts"; fi
python3 - "$stage/source" <<'PORTS'
from pathlib import Path
import sys
for name in ['tests/teamAuthSecurityControls.test.ts', 'lib/authLifetimeLock.test.ts']:
    p=Path(sys.argv[1])/name
    p.write_text(p.read_text().replace(':3785', ':3786'))
PORTS
if [[ $# -eq 0 ]]; then
  set -- test --timeout 20000 tests/teamAuthSecurityControls.test.ts lib/teamAuthSlice5.test.ts app/api/admin/users/route.test.ts lib/db/authPolicy.test.ts lib/authLifetimeLock.test.ts additional.test.ts lib/db/users.test.ts
fi
nice -n 10 timeout --signal=TERM --kill-after=3 300 prlimit --cpu=240 --as=17179869184 --nproc=2048 --nofile=512 --fsize=67108864 --core=0 \
  bwrap --unshare-all --die-with-parent --new-session --cap-drop ALL --clearenv \
  --ro-bind /usr /usr --ro-bind /lib /lib --symlink usr/bin /bin \
  --ro-bind "$bun_binary" /tool/bun --ro-bind "$stage/source" /app \
  --ro-bind "$review_root/node_modules" /app/node_modules --proc /proc --dev /dev \
  --size 536870912 --tmpfs /scratch --setenv PATH /tool:/usr/bin \
  --setenv HOME /scratch/home --setenv TMPDIR /scratch/tmp --setenv XDG_CACHE_HOME /scratch/cache \
  --setenv BUN_RUNTIME_TRANSPILER_CACHE_PATH 0 --setenv JSC_useJIT false \
  --setenv JSC_useGigacage false --setenv JSC_useWebAssembly false --setenv BETTER_AUTH_TELEMETRY 0 \
  --chdir /app /bin/bash -c 'mkdir -p /scratch/home /scratch/tmp /scratch/cache; exec /tool/bun --no-env-file "$@"' review-sandbox "$@"
