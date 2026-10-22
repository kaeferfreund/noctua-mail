#!/usr/bin/env bash
# Purpose: code-only rollback to reviewed previous link; runbook §3.3; REVIEW BEFORE USE.
# Usage: rollback.sh [--dry-run|--execute] [--confirm-schema-compatible] [--confirm-no-other-writers]
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../lib/operations.sh
source "$SCRIPT_DIR/../lib/operations.sh"
mode=--dry-run
compatible=0
writers=0
for arg in "$@"; do
    case $arg in
        --dry-run|--execute) mode=$arg ;;
        --confirm-schema-compatible) compatible=1 ;;
        --confirm-no-other-writers) writers=1 ;;
        *) fail 'Unknown argument; see header usage.' ;;
    esac
done
[[ -L $OPS_ROOT/previous ]] || fail 'No previous release; first deployment needs manual recovery.'
target=$(realpath -e "$OPS_ROOT/previous")
[[ $(release_path "$(basename "$target")") == "$target" ]] || fail 'Invalid previous release.'
check_evidence "$target/RELEASE_EVIDENCE" "$(basename "$target")"
python3 "$SCRIPT_DIR/verify-artifacts.py" --release "$target" "$target/RELEASE_ARTIFACTS.sha256"
if [[ $mode == --dry-run ]]; then
    printf 'DRY RUN: back up current state, then switch current to %s, ONLY if schema/keys/runtime are compatible.\n' "$target"
    exit 0
fi
[[ $compatible == 1 && $writers == 1 ]] || fail 'Schema/key compatibility and no other writers must be explicitly confirmed; otherwise perform paired restore.'
need_root
operation_lock
[[ $("$OPS_BUN" --version) == $(cat "$target/BUN_VERSION") ]] || fail 'Select the matching Bun binary before rollback.'
"$SCRIPT_DIR/../backup/restic-backup.sh" --execute --pre-deploy --confirm-no-other-writers
switch_link "$target" current
if ! service_control start noctua.service || ! healthcheck; then
    service_control stop noctua.service
    fail 'Rollback health failed; app stopped. Keep the saved state and review paired restore.'
fi
printf 'Rolled back to %s; previous retained as recovery anchor.\n' "$target"
