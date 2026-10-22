#!/usr/bin/env bash
# Purpose: gate and assemble an already verified flat standalone build; runbook §3.1–3.2; REVIEW BEFORE USE.
# Usage: build-release.sh [--dry-run|--execute] CHECKOUT FULL_SHA EVIDENCE_FILE
# No install/test/build commands are run here; see README for the separate build/evidence procedure.
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../lib/operations.sh
source "$SCRIPT_DIR/../lib/operations.sh"
mode=--dry-run
if [[ ${1:-} == --dry-run || ${1:-} == --execute ]]; then mode=$1; shift; fi
[[ $# == 3 ]] || fail 'Usage: build-release.sh [--dry-run|--execute] CHECKOUT FULL_SHA EVIDENCE_FILE'
checkout=$(realpath -e -- "$1")
sha=$2
evidence=$(realpath -e -- "$3")
check_sha "$sha"
[[ $(git -C "$checkout" rev-parse HEAD) == "$sha" ]] || fail 'Checkout SHA mismatch.'
[[ -z $(git -C "$checkout" status --porcelain) ]] || fail 'Build checkout must be clean.'
check_evidence "$evidence" "$sha"
# Never open an env file; reject even ignored files and secret-bearing copied output.
[[ -z $(find "$checkout" -path "$checkout/node_modules" -prune -o -name '.env*' -print -quit) ]] || fail 'Remove all .env* files from the clean build checkout.'
for entry in .next/standalone/server.js .next/standalone/scripts/runSyncJob.ts .next/standalone/tsconfig.json public/runtime-config.js .next/static; do
    [[ -e $checkout/$entry ]] || fail "Missing build artifact: $entry"
done
[[ -f $evidence.artifacts.sha256 ]] || fail 'Missing EVIDENCE_FILE.artifacts.sha256; see README.'
# The checksum list is operator-reviewed data, not shell code. Validate complete coverage below.
python3 "$SCRIPT_DIR/verify-artifacts.py" "$checkout" "$evidence.artifacts.sha256"
release="/srv/noctua/releases/$sha"
[[ ! -e $release && ! -L $release ]] || fail 'Release already exists; never overwrite it.'
if [[ $mode == --dry-run ]]; then
    printf 'DRY RUN: assemble verified %s at %s; no files or services changed.\n' "$sha" "$release"
    exit 0
fi
need_root
operation_lock
stage=$(mktemp -d /srv/noctua/releases/.assemble.XXXXXXXX)
trap 'printf "Incomplete assembly retained privately at %s\n" "$stage" >&2' ERR
cp -a "$checkout/.next/standalone/." "$stage/"
# As deploy-dev.sh: replace .next/static and public in the flat standalone root.
rm -rf -- "$stage/.next/static" "$stage/public" "$stage/.next/cache"
mkdir -p "$stage/.next/static" "$stage/public"
cp -a "$checkout/.next/static/." "$stage/.next/static/"
cp -a "$checkout/public/." "$stage/public/"
ln -s /var/cache/noctua "$stage/.next/cache"
printf '%s\n' "$sha" > "$stage/REVISION"
printf '%s\n' '1.4.4' > "$stage/BUN_VERSION"
cp "$evidence" "$stage/RELEASE_EVIDENCE"
cp "$evidence.artifacts.sha256" "$stage/BUILD_ARTIFACTS.sha256"
chown -hR root:root "$stage"
chmod -R a+rX,go-w "$stage"
mv -T "$stage" "$release"
trap - ERR
printf 'Assembled %s; not activated.\n' "$release"
