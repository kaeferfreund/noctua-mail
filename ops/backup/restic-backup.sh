#!/usr/bin/env bash
# Purpose: stopped WAL-safe application snapshot + off-box restic; runbook §6.1–6.3; REVIEW BEFORE USE.
# Usage: restic-backup.sh [--dry-run|--execute] [--pre-deploy] --confirm-no-other-writers [--initial-release SHA]
# Requires root, reviewed /etc/noctua/backup-reviewed, exported restic env and private SSH setup.
set -euo pipefail
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=../lib/operations.sh
source "$SCRIPT_DIR/../lib/operations.sh"
mode=--dry-run
predeploy=0
writers=0
initial=
while (($#)); do
    case $1 in
        --dry-run|--execute) mode=$1 ;;
        --pre-deploy) predeploy=1 ;;
        --confirm-no-other-writers) writers=1 ;;
        --initial-release) shift; [[ $# -gt 0 ]] || fail 'Missing initial SHA.'; initial=$1; check_sha "$initial" ;;
        *) fail 'Unknown argument; see header usage.' ;;
    esac
    shift
done
if [[ $mode == --dry-run ]]; then
    printf '%s\n' 'DRY RUN: lock; stop app/Caddy; check all shard paths and SQLite; archive full stopped data/config/TLS/release/Bun; resume original services; restic backup/check; retention dry-run. No secrets read, services changed or connections made.'
    exit 0
fi
need_root
[[ $writers == 1 && -f /etc/noctua/backup-reviewed ]] || fail 'Review backup setup and confirm no CLI/import/auth writers.'
[[ ${RESTIC_REPOSITORY:-} == sftp:* && -n ${RESTIC_PASSWORD_FILE:-} ]] || fail 'Export SFTP RESTIC_REPOSITORY and RESTIC_PASSWORD_FILE privately (no inline secrets).'
[[ -f $RESTIC_PASSWORD_FILE && $(stat -c '%a:%u' "$RESTIC_PASSWORD_FILE") == 600:0 ]] || fail 'Restic password file must be root-owned 0600.'
operation_lock
umask 077
release=
if [[ -L /srv/noctua/current ]]; then
    [[ -z $initial ]] || fail 'Initial-release option is only for an empty installation.'
    release=$(realpath -e /srv/noctua/current)
    [[ $(release_path "$(basename "$release")") == "$release" ]] || fail 'Invalid current release.'
else
    [[ -n $initial && ! -e /srv/noctua/current ]] || fail 'No current release; explicit initial release required.'
    release=$(release_path "$initial")
    [[ -d /srv/noctua/data && -z $(find /srv/noctua/data -mindepth 1 -print -quit) ]] || fail 'Initial installation requires an empty data directory.'
fi
[[ -f /srv/noctua/env/noctua.env && $(stat -c '%a:%u' /srv/noctua/env/noctua.env) == 600:0 ]] || fail 'Runtime environment must be root-owned 0600.'
for required in /srv/noctua/data /srv/noctua/env /etc/noctua /etc/caddy /var/lib/caddy /etc/systemd/system/noctua.service /etc/systemd/system/caddy.service.d /opt/noctua/bin/bun /opt/noctua/ops; do
    [[ -e $required ]] || fail "Missing required backup path: $required"
done
[[ $(/opt/noctua/bin/bun --version) == $(cat "$release/BUN_VERSION") ]] || fail 'Snapshot runtime and release version differ.'
stage=$(mktemp -d "/srv/noctua/backups/$(date -u +%Y%m%dT%H%M%SZ).XXXXXXXX")
app_active=0
proxy_active=0
systemctl is-active --quiet noctua.service && app_active=1
systemctl is-active --quiet caddy.service && proxy_active=1
resume() {
    local failed=0
    if [[ $app_active == 1 ]]; then systemctl start noctua.service || failed=1; fi
    if [[ $proxy_active == 1 ]]; then systemctl start caddy.service || failed=1; fi
    return "$failed"
}
cleanup() {
    local status=$?
    trap - EXIT
    resume || status=1
    if ((status != 0)); then printf 'Backup failed; incomplete private stage retained at %s\n' "$stage" >&2; fi
    exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
systemctl stop noctua.service
systemctl stop caddy.service
if systemctl is-active --quiet noctua-fullsync.service; then fail 'Full-sync writer still active.'; fi
# Fullsync check is supplemental; operator must also exclude manual writers and auth CLI jobs.
python3 "$SCRIPT_DIR/db-manifest.py" capture /srv/noctua/data "$stage/DB_MANIFEST.json" "$release"
# WAL-safe method from §6.2: all writers stopped, whole data tree including any WAL/SHM sidecars.
tar -C /srv/noctua -czf "$stage/data.tgz" data
tar -C / -czf "$stage/config-tls.tgz" \
    srv/noctua/env etc/noctua etc/caddy var/lib/caddy \
    etc/systemd/system/noctua.service etc/systemd/system/caddy.service.d opt/noctua/ops
printf '%s\n' "$release" > "$stage/RELEASE_PATH"
cp "$release/REVISION" "$release/BUN_VERSION" "$stage/"
tar -C /srv/noctua/releases -czf "$stage/release.tgz" "$(basename "$release")"
cp /opt/noctua/bin/bun "$stage/bun"
(cd "$stage" && sha256sum data.tgz config-tls.tgz release.tgz bun DB_MANIFEST.json REVISION BUN_VERSION RELEASE_PATH > SHA256SUMS)
# Resume Caddy now. Pre-deploy leaves app stopped until successful upload/check and activation.
if [[ $proxy_active == 1 ]]; then systemctl start caddy.service; proxy_active=0; fi
if [[ $predeploy == 0 && $app_active == 1 ]]; then systemctl start noctua.service; app_active=0; fi
# Prevent an upload failure during pre-deploy from restarting a partially activated release:
# backup itself has not changed current, so EXIT safely resumes the original app on failure.
restic backup --tag noctua-app --tag verified-policy-v1 "$stage"
restic check
# Retention is PREVIEW ONLY until a successful full restore is signed off; no automatic deletion.
restic forget --tag noctua-app --group-by host,tags --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --dry-run
printf 'Off-box backup and repository check completed at %s\n' "$(date -u +%FT%TZ)" > "$stage/OFFBOX_SUCCESS"
if [[ $predeploy == 1 ]]; then app_active=0; fi
trap - EXIT INT TERM
printf 'Backup complete; private stage: %s\n' "$stage"
