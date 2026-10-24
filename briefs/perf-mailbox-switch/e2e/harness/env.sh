# Process-only env: worktree .env.local + synthetic Better Auth settings (no file in the worktree edited).
set -a
. /home/monkey/code/noctua-mail/wt-spike-switch-e2e/.env.local
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET:?export a throwaway synthetic secret, e.g. $(openssl rand -hex 32)}
BETTER_AUTH_URL=http://127.0.0.1:3905
PASSKEY_RP_ID=127.0.0.1
BETTER_AUTH_TELEMETRY=0
NOCTUA_TRUSTED_ORIGINS=
NOCTUA_IMAP_LOGIN_HOSTS=
NOCTUA_DESKTOP_MODE=false
NOCTUA_MAILBOX_WATCHER=${NOCTUA_MAILBOX_WATCHER:-1}
APP_ENV_LABEL=SPIKE
TMPDIR=/tmp/spike-switch-e2e/tmp
set +a
