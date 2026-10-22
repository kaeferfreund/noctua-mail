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
artifacts=$(realpath -e -- "${NOCTUA_ARTIFACT_ROOT:-$checkout}")
[[ -z ${NOCTUA_ARTIFACT_ROOT:-} || $OPS_SCRATCH == 1 ]] || fail 'Alternate artifacts are supported only for synthetic scratch runs.'
# Never open an env file; reject even ignored files and secret-bearing copied output.
[[ -z $(find "$artifacts/.next/standalone" "$artifacts/.next/static" "$artifacts/public" -name '.env*' -print -quit) ]] || fail 'Remove all .env* files from packaged artifact trees.'
for entry in .next/standalone/server.js .next/standalone/scripts/runSyncJob.ts .next/standalone/tsconfig.json public/runtime-config.js .next/static; do
    [[ -e $artifacts/$entry ]] || fail "Missing build artifact: $entry"
done
[[ -f $evidence.artifacts.sha256 ]] || fail 'Missing EVIDENCE_FILE.artifacts.sha256; see README.'
# The checksum list is operator-reviewed data, not shell code. Validate complete coverage below.
python3 "$SCRIPT_DIR/verify-artifacts.py" "$artifacts" "$evidence.artifacts.sha256"
release="$OPS_ROOT/releases/$sha"
[[ ! -e $release && ! -L $release ]] || fail 'Release already exists; never overwrite it.'
if [[ $mode == --dry-run ]]; then
    printf 'DRY RUN: assemble verified %s at %s; no files or services changed.\n' "$sha" "$release"
    exit 0
fi
need_root
operation_lock
stage=$(mktemp -d "$OPS_ROOT/releases/.assemble.XXXXXXXX")
trap 'printf "Incomplete assembly retained privately at %s\n" "$stage" >&2' ERR
cp -a "$artifacts/.next/standalone/." "$stage/"
# As deploy-dev.sh: replace .next/static and public in the flat standalone root.
rm -rf -- "$stage/.next/static" "$stage/public" "$stage/.next/cache"
mkdir -p "$stage/.next/static" "$stage/public"
cp -a "$artifacts/.next/static/." "$stage/.next/static/"
cp -a "$artifacts/public/." "$stage/public/"
ln -s "$OPS_CACHE" "$stage/.next/cache"
printf '%s\n' "$sha" > "$stage/REVISION"
printf '%s\n' '1.4.4' > "$stage/BUN_VERSION"
cp "$evidence" "$stage/RELEASE_EVIDENCE"
cp "$evidence.artifacts.sha256" "$stage/BUILD_ARTIFACTS.sha256"
if [[ $OPS_SCRATCH == 0 ]]; then chown -hR root:root "$stage"; fi
chmod -R a+rX,go-w "$stage"
# Bind the assembled layout separately; BUILD_ARTIFACTS covers source-tree paths.
python3 "$SCRIPT_DIR/verify-artifacts.py" --write-release "$stage" "$stage/RELEASE_ARTIFACTS.sha256"
mv -T "$stage" "$release"
trap - ERR
printf 'Assembled %s; not activated.\n' "$release"
