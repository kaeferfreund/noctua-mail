#!/usr/bin/env bash
# Purpose: pre-deploy backup, atomic release activation and health gate; runbook §3.3/§6; REVIEW BEFORE USE.
# Usage: activate-release.sh [--dry-run|--execute] FULL_SHA [--confirm-no-other-writers]
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../lib/operations.sh
source "$SCRIPT_DIR/../lib/operations.sh"
mode=--dry-run
if [[ ${1:-} == --dry-run || ${1:-} == --execute ]]; then mode=$1; shift; fi
[[ $# -ge 1 && $# -le 2 ]] || fail 'Usage: activate-release.sh [--dry-run|--execute] FULL_SHA [--confirm-no-other-writers]'
release=$(release_path "$1")
check_evidence "$release/RELEASE_EVIDENCE" "$1"
python3 "$SCRIPT_DIR/verify-artifacts.py" --release "$release" "$release/RELEASE_ARTIFACTS.sha256"
if [[ $mode == --dry-run ]]; then
    printf 'DRY RUN: stop, back up (scratch=%s), switch current to %s, start, check /api/ba/ok=200 and /api/auth/me=401.\n' "$OPS_SCRATCH" "$release"
    exit 0
fi
[[ ${2:-} == --confirm-no-other-writers ]] || fail 'Confirm maintenance window: no CLI/import/auth writers or timers may run.'
need_root
operation_lock
[[ $("$OPS_BUN" --version) == $(cat "$release/BUN_VERSION") ]] || fail 'Bun version mismatch.'
old=
if [[ -L $OPS_ROOT/current ]]; then
    old=$(realpath -e "$OPS_ROOT/current")
    [[ $old != "$release" ]] || fail 'Requested release is already current.'
    [[ $(release_path "$(basename "$old")") == "$old" ]] || fail 'Current is not a recognized release.'
fi
# backup.env must be loaded by the privileged operator, not printed or sourced here.
backup_args=(--execute --pre-deploy --confirm-no-other-writers)
if [[ -z $old ]]; then backup_args+=(--initial-release "$1"); fi
"$SCRIPT_DIR/../backup/restic-backup.sh" "${backup_args[@]}"
# The backup leaves noctua stopped and only resumes Caddy if it was active.
[[ -z $old ]] || switch_link "$old" previous
switch_link "$release" current
if ! service_control start noctua.service || ! healthcheck; then
    service_control stop noctua.service
    fail 'Activation failed; app stopped. Review schema compatibility and use rollback.sh or paired restore; no automatic code-only rollback.'
fi
printf 'Activated %s; TLS, MFA, roles, mail and device acceptance remain manual.\n' "$release"
