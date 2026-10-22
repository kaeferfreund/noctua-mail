#!/bin/bash
set -eu
repo=${REVIEW_CHECKOUT:-/home/monkey/code/noctua-mail/wt-review-collab}
probe_dir=$(cd -- "$(dirname -- "$0")" && pwd)
mask_args=()
for path in .tmp .tmp-design .data .next; do
  if [[ -d "$repo/$path" ]]; then mask_args+=(--tmpfs "$repo/$path" --remount-ro "$repo/$path"); fi
done
exec nice -n 10 timeout --signal=TERM --kill-after=5 240 prlimit --cpu=160 --as=4294967296 --nproc=4096 --nofile=1024 --fsize=33554432 -- bwrap \
  --unshare-all --die-with-parent --new-session --cap-drop ALL \
  --ro-bind /usr /usr --symlink usr/bin /bin --symlink usr/lib /lib \
  --ro-bind /home/monkey/.bun/bin/bun /home/monkey/.bun/bin/bun \
  --proc /proc --dev /dev \
  --dir /home/monkey/code/noctua-mail --ro-bind "$repo" "$repo" \
  --ro-bind /dev/null "$repo/.env.local" "${mask_args[@]}" \
  --ro-bind "$probe_dir" "$probe_dir" \
  --size 536870912 --tmpfs /scratch --dir /scratch/home --dir /scratch/tmp --dir /scratch/data \
  --symlink /scratch/tmp /tmp --chdir "$repo" --clearenv \
  --setenv PATH /usr/local/bin:/usr/bin:/bin --setenv HOME /scratch/home \
  --setenv TMPDIR /scratch/tmp --setenv XDG_CACHE_HOME /scratch/cache \
  --setenv NOCTUA_DATA_DIR /scratch/data --setenv ACCOUNT_DB_IDLE_MS 0 \
  --setenv BETTER_AUTH_SECRET noctua-auth-test-secret-0123456789abcdef \
  --setenv BETTER_AUTH_URL http://localhost:3000 --setenv PASSKEY_RP_ID localhost \
  --setenv BETTER_AUTH_TELEMETRY 0 --setenv NOCTUA_DESKTOP_MODE false \
  --setenv IMAP_SECRET_KEY test-imap-secret-key-32-chars-minimum__ --setenv IMAP_CREDENTIALS_STORAGE db \
  --setenv REVIEW_CHECKOUT "$repo" --setenv TZ UTC --setenv LANG C.UTF-8 --remount-ro / "$@"
