#!/usr/bin/env bash
# Purpose: shared release/backup lock and CLI helpers; runbook §3/§6; REVIEW BEFORE USE.
# Sourced by reviewed scripts; never source a runtime secret file here.
set -euo pipefail
fail() { printf '%s\n' "$*" >&2; exit 1; }
need_root() { [[ $EUID -eq 0 ]] || fail 'Execution requires root; no sudo is invoked by these scripts.'; }
operation_lock() {
    # A child backup inherits fd 9 from activation; do not reopen that lock.
    if [[ $(readlink /proc/self/fd/9 2>/dev/null || true) != /run/lock/noctua-operations.lock ]]; then
        exec 9>/run/lock/noctua-operations.lock
    fi
    flock -n 9 || fail 'Another release/backup operation holds the lock.'
}
check_sha() { [[ $1 =~ ^[0-9a-f]{40}$ ]] || fail 'Expected a full 40-character git SHA.'; }
release_path() {
    check_sha "$1"
    local target="/srv/noctua/releases/$1"
    [[ -d $target && ! -L $target && -f $target/server.js ]] || fail 'Missing flat release.'
    [[ $(cat "$target/REVISION") == "$1" ]] || fail 'Release revision mismatch.'
    printf '%s\n' "$target"
}
check_evidence() {
    local evidence=$1 sha=$2 key
    [[ -f $evidence && ! -L $evidence ]] || fail 'A regular reviewed release evidence file is required.'
    for key in "git_sha=$sha" 'test:ci=pass' 'lint=pass' 'build=pass' 'runtime_config=pass' 'standalone_workers=pass' 'go_live_gate=approved' 'bun_version=1.4.4'; do
        [[ $(grep -Fxc -- "$key" "$evidence" || true) == 1 ]] || fail "Missing/duplicate release evidence: $key"
    done
}
healthcheck() {
    local port=${1:-3654} attempt ok_status me_status
    if [[ ! $port =~ ^[0-9]+$ ]]; then fail 'Invalid backend port.'; fi
    if ((port < 1024 || port > 65535)); then fail 'Invalid backend port.'; fi
    for ((attempt=0; attempt<30; attempt++)); do
        ok_status=$(curl --noproxy '*' --silent --output /dev/null --write-out '%{http_code}' --max-time 3 \
            -H 'Host: mails.monkeymed.de' -H 'X-Forwarded-Host: mails.monkeymed.de' \
            -H 'X-Forwarded-Proto: https' -H 'X-Forwarded-Port: 443' -H 'X-Forwarded-For: 127.0.0.1' \
            "http://127.0.0.1:$port/api/ba/ok") || ok_status=000
        me_status=$(curl --noproxy '*' --silent --output /dev/null --write-out '%{http_code}' --max-time 3 \
            -H 'Host: mails.monkeymed.de' -H 'X-Forwarded-Host: mails.monkeymed.de' \
            -H 'X-Forwarded-Proto: https' -H 'X-Forwarded-Port: 443' -H 'X-Forwarded-For: 127.0.0.1' \
            "http://127.0.0.1:$port/api/auth/me") || me_status=000
        if [[ $ok_status == 200 && $me_status == 401 ]] && systemctl is-active --quiet noctua.service; then
            return 0
        fi
        sleep 2
    done
    return 1
}
switch_link() {
    local target=$1 name=$2 temporary
    [[ $name == current || $name == previous ]] || fail 'Invalid release link name.'
    [[ ! -e /srv/noctua/$name || -L /srv/noctua/$name ]] || fail 'Refusing to replace a non-symlink.'
    temporary=$(mktemp -d /srv/noctua/.link.XXXXXXXX)
    ln -s "$target" "$temporary/link"
    mv -Tf "$temporary/link" "/srv/noctua/$name"
    rmdir "$temporary"
}
