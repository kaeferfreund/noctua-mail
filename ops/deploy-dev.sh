#!/bin/bash
# Build + assemble the Noctua dev preview from the deploy/dev worktree and restart the user service.
# Usage: deploy-dev.sh [--no-restart]
set -euo pipefail
ROOT=/home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215
WT=$ROOT/wt-deploy-dev
cd "$WT"
set -a; source .env.local; set +a
export NEXT_TELEMETRY_DISABLED=1
echo "[deploy-dev] HEAD: $(git log --oneline -1)"
bun install --frozen-lockfile
# runtime-config.js must exist in public/ before the standalone copy
ENV_FILE=.env.local bun --bun build-scripts/generateRuntimeConfig.ts
bun run build
# Next infers the workspace root from a lockfile above the worktree, so the
# standalone tree is nested under .next/standalone/<absolute path>. Find it.
SA=$(dirname "$(find .next/standalone -name server.js -not -path '*/node_modules/*' | head -1)")
[[ -f "$SA/server.js" ]] || { echo "standalone server.js not found" >&2; exit 1; }
rm -rf "$SA/.next/static" "$SA/public"
cp -r .next/static "$SA/.next/static"
cp -r public "$SA/public"
echo "[deploy-dev] standalone assembled at $SA"
if [[ "${1:-}" != "--no-restart" ]]; then
  systemctl --user restart noctua-dev.service
  sleep 4
  systemctl --user --no-pager status noctua-dev.service | head -5
fi
