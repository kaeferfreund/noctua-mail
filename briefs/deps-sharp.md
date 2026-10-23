# sharp security release gate

Worktree: `/home/monkey/code/noctua-mail/wt-deps-sharp`. Branch: `chore/deps-sharp`. Base: `9424150f5aa0a446ed9bc03ed199e6825129467d`.
Commit: `b3ad7240326465b361126fc18bb40008d73c256b` — `chore(deps): pin sharp 0.35.5 (security advisory)`.
Changed tracked files: `package.json`, `bun.lock`, `next.config.ts`. Next remains **16.2.4**; Bun remains **1.4.4**.

## Advisory and mechanism

[GHSA-wq5f-xc86-pv6w / CVE-2026-96889](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) affects sharp before 0.35.5. It fixes an upstream librsvg memory-safety vulnerability with possible remote code execution under certain runtime conditions on glibc Linux. sharp 0.35.5 prebuilt binaries supply fixed librsvg **2.63.2**. See the [0.35.5 release](https://github.com/lovell/sharp/releases/tag/v0.35.5).

Added `"sharp": "0.35.5"` to the existing `overrides`. Bun honours this for Next's optional sharp dependency even though Next's own manifest still requests `^0.34.5`. This enforces the transitive version without introducing an artificial direct application dependency. After editing package.json, ran `nice -n 10 bun install` to regenerate bun.lock. `bun pm ls sharp` and Next's own module-resolution context both resolve the root sharp 0.35.5.

**Required standalone packaging fix:** the first override-only build succeeded but its standalone sharp could not load: `ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.7: cannot open shared object file`. Next 16.2's trace copied the new package manifests and native addon but omitted the libvips shared object. Added `"/*": ["./node_modules/@img/sharp-libvips-*/lib/**"]` to the existing `outputFileTracingIncludes`. The glob follows the installed target platform and includes its shared library in standalone builds. Rebuilt after removing the prior generated standalone output; verified the library can actually load. There are no patches to Next or manual library-copy requirements for deployment.

After the commit, ran **`nice -n 10 bun install --frozen-lockfile`**: `Checked 1099 installs across 1103 packages (no changes) [379.00ms]`. `bun pm ls sharp` still reports **0.35.5**; `git diff --exit-code HEAD -- package.json bun.lock next.config.ts` passed. The committed override and lockfile reproduce as a no-op.

## Lock delta

30 package records changed: 28 updated and 2 added, all within sharp's dependency graph; plus the lockfile's override entry. Native bindings/WASM moved from 0.34.5 to 0.35.5, bundled libvips packages from 1.2.4 to 1.3.4. Linux records now include explicit glibc/musl selectors. Existing sharp-wasm32 loses its old CPU restriction; the new FreeBSD and WebContainers wrapper packages select the updated WASM package. No Next version change or unrelated dependency update.

- `@emnapi/runtime`: 1.8.1 → 1.11.3.
- `@img/colour`: 1.0.0 → 1.1.0.
- `@img/sharp-darwin-arm64`: 0.34.5 → 0.35.5.
- `@img/sharp-darwin-x64`: 0.34.5 → 0.35.5.
- `@img/sharp-freebsd-wasm32`: new → 0.35.5.
- `@img/sharp-libvips-darwin-arm64`: 1.2.4 → 1.3.4.
- `@img/sharp-libvips-darwin-x64`: 1.2.4 → 1.3.4.
- `@img/sharp-libvips-linux-arm`: 1.2.4 → 1.3.4.
- `@img/sharp-libvips-linux-arm64`: 1.2.4 → 1.3.4.
- `@img/sharp-libvips-linux-ppc64`: 1.2.4 → 1.3.4.
- `@img/sharp-libvips-linux-riscv64`: 1.2.4 → 1.3.4.
- `@img/sharp-libvips-linux-s390x`: 1.2.4 → 1.3.4.
- `@img/sharp-libvips-linux-x64`: 1.2.4 → 1.3.4.
- `@img/sharp-libvips-linuxmusl-arm64`: 1.2.4 → 1.3.4.
- `@img/sharp-libvips-linuxmusl-x64`: 1.2.4 → 1.3.4.
- `@img/sharp-linux-arm`: 0.34.5 → 0.35.5.
- `@img/sharp-linux-arm64`: 0.34.5 → 0.35.5.
- `@img/sharp-linux-ppc64`: 0.34.5 → 0.35.5.
- `@img/sharp-linux-riscv64`: 0.34.5 → 0.35.5.
- `@img/sharp-linux-s390x`: 0.34.5 → 0.35.5.
- `@img/sharp-linux-x64`: 0.34.5 → 0.35.5.
- `@img/sharp-linuxmusl-arm64`: 0.34.5 → 0.35.5.
- `@img/sharp-linuxmusl-x64`: 0.34.5 → 0.35.5.
- `@img/sharp-wasm32`: 0.34.5 → 0.35.5.
- `@img/sharp-webcontainers-wasm32`: new → 0.35.5.
- `@img/sharp-win32-arm64`: 0.34.5 → 0.35.5.
- `@img/sharp-win32-ia32`: 0.34.5 → 0.35.5.
- `@img/sharp-win32-x64`: 0.34.5 → 0.35.5.
- `sharp`: 0.34.5 → 0.35.5.
- `sharp/semver`: 7.7.3 → 7.8.5.

## Platform and standalone verification

Primary target **linux-arm64 under systemd**. Host: aarch64/glibc 2.43, Bun 1.4.4 (Node-API 10); available Node is v24.22.1. [sharp's requirements](https://sharp.pixelplumbing.com/install/) are a Node-API v9 compatible runtime, Node >=20.9.0 when using Node, and glibc >=2.28 for Linux ARM64/x64 prebuilds. This is Node-API compatibility rather than a per-Node-major addon rebuild. Installed sharp's `config.libvips` is `>=8.18.7`. Direct Bun SVG → PNG decoding/encoding succeeded (32×32, 148 bytes).

Versions read directly from the final standalone output:

- `/home/monkey/code/noctua-mail/wt-deps-sharp/.next/standalone/node_modules/sharp/package.json`: **0.35.5**.
- `/home/monkey/code/noctua-mail/wt-deps-sharp/.next/standalone/node_modules/@img/sharp-linux-arm64/package.json`: **0.35.5**.
- `/home/monkey/code/noctua-mail/wt-deps-sharp/.next/standalone/node_modules/@img/sharp-libvips-linux-arm64/package.json`: **1.3.4**.
- `@img/sharp-linux-arm64/lib/sharp-linux-arm64-0.35.5.node` and `@img/sharp-libvips-linux-arm64/lib/libvips-cpp.so.8.18.7` are present.
- Requiring standalone sharp succeeds and reports **sharp 0.35.5 / libvips 8.18.7 / librsvg 2.63.2**.

Bun left baseline non-target musl packages in this pre-existing node_modules tree while skipping them on this glibc host: `@img/sharp-linuxmusl-arm64` 0.34.5 and its libvips 1.2.4. Removed those two obsolete local directories before the final build. The final standalone contains only the matching ARM64/glibc sharp/libvips packages. Use a clean target dependency installation for release packaging, as the Docker deps stage already does.

Docker is secondary. `Dockerfile` uses `oven/bun:1.4.4-debian` for every stage, installs with `bun install --frozen-lockfile`, and copies standalone output plus static/public assets. The [tagged upstream Bun Dockerfile](https://raw.githubusercontent.com/oven-sh/bun/bun-v1.4.4/dockerhub/debian/Dockerfile) uses Debian trixie and supports amd64/arm64. Thus glibc packages apply: ARM64 uses the versions tested above; x64 resolves `@img/sharp-linux-x64` **0.35.5** plus `@img/sharp-libvips-linux-x64` **1.3.4**. Confirmed those exact npm records and their linux/x64/glibc selectors against the registry. The lockfile also retains the matching musl ARM64/x64 variants. Docker CLI is unavailable here, so no container build or x64 execution was performed; primary ARM64 standalone execution was verified.

## Gates

Heavy commands ran under `nice -n 10`.

- `bun run typecheck`: **PASS**, no type errors, including after the tracing change.
- `bun run lint`: **baseline unchanged**, exit 1, **1 error + 25 warnings**. Existing `app/components/calendar/useCalendarConflicts.ts:58`, `react-hooks/set-state-in-effect`; no unrelated lint cleanup. Changed `next.config.ts` separately passes ESLint.
- `bun run test:ci`: **PASS**, **2,754 unit tests across 300 files** and **433 DOM tests across 52 files**, zero failures (357.72s + 66.26s).
- `bun run build`: **PASS** with the tracing include; Next 16.2.4 production standalone generated.
- Post-commit frozen install: **PASS**, no changes, sharp remains 0.35.5.
- `bun scripts/checkGracefulShutdown.ts --port 3899 --data-dir /home/monkey/code/noctua-mail/data/noctua-data-wt-deps-sharp`: **PASS**, owned PID 1665420, health endpoint 200, SIGTERM → exit **0** in **118 ms**, `forced: false`.

## HTTP image checks

Copied `.next/static/.` into `.next/standalone/.next/static/` and `public/.` into `.next/standalone/public/`, then started `bun --bun server.js` from `.next/standalone` on **127.0.0.1:3899**. Loaded this worktree's `.env.local`, retaining exactly `NOCTUA_DATA_DIR=/home/monkey/code/noctua-mail/data/noctua-data-wt-deps-sharp`. The env file lacks Better Auth startup settings, so supplied an ephemeral synthetic auth secret and loopback auth URL/RP ID only to the probe processes; `.env.local` was unchanged. Mailbox watcher and telemetry disabled. Both plain (`APP_ENV_LABEL` empty) and badged (`APP_ENV_LABEL=SHARP`) instances exited 0 after the checks.

**44 HTTP checks passed** across the two modes. Every PNG below returned **200**, **image/png**, non-empty PNG signature, and exact expected dimensions. Badged routes invoke `lib/ui/envIcon.tsx` → `next/og` → sharp; Next's optimizer was additionally exercised directly.

- `/icon`: 256×256; plain 34,821 bytes; `SHARP` badge 14,350 bytes.
- `/apple-icon`: 180×180; plain 23,357 bytes; `SHARP` badge 9,960 bytes.
- `/icons/badged/32`: 32×32; plain 3,697 bytes; `SHARP` badge 1,996 bytes.
- `/icons/badged/192`: 192×192; plain 24,804 bytes; `SHARP` badge 10,726 bytes.
- `/icons/badged/512`: 512×512; plain 71,204 bytes; `SHARP` badge 29,740 bytes.
- `/_next/image?url=%2Ficons%2Ficon-512.png&w=256&q=75`: 256×256; plain 5,011 bytes; `SHARP` badge 5,011 bytes.

`/manifest.webmanifest`: **200**, **application/manifest+json**, **539 bytes** in both modes. Parsed its icons and fetched all declared URLs: `/icons/badged/32`, `/icons/badged/192`, `/icons/badged/512`. Those are all sizes allowed by `app/icons/badged/[size]/route.ts`.

`/icons/logo.svg`: **200**, **image/svg+xml**, XML parsed successfully; plain **7,447 bytes**, badged **8,030 bytes**, with the badge label present. This route composes SVG text and does not rasterize it.

Static PNGs and favicon also returned 200/image/png with valid PNG signatures and dimensions in both modes (same byte sizes):

- `/icons/icon-128.png`: 16,507 bytes, 128×128.
- `/icons/icon-144.png`: 18,418 bytes, 144×144.
- `/icons/icon-152.png`: 19,438 bytes, 152×152.
- `/icons/icon-16.png`: 1,683 bytes, 16×16.
- `/icons/icon-180.png`: 23,357 bytes, 180×180.
- `/icons/icon-192.png`: 24,804 bytes, 192×192.
- `/icons/icon-256.png`: 34,821 bytes, 256×256.
- `/icons/icon-32.png`: 3,697 bytes, 32×32.
- `/icons/icon-48.png`: 5,670 bytes, 48×48.
- `/icons/icon-512.png`: 71,204 bytes, 512×512.
- `/icons/icon-64.png`: 7,693 bytes, 64×64.
- `/icons/icon-72.png`: 8,754 bytes, 72×72.
- `/icons/icon-96.png`: 12,352 bytes, 96×96.
- `/favicon.png`: 3,697 bytes, 32×32.

No unpatched `.next` build existed in this worktree; did not create a second baseline build solely for optional byte-size comparison. Instead verified that all five plain dynamic PNG responses match the committed base PNG bytes exactly. Badged byte counts above document the patched renderer's output.

The authenticated `/api/accounts/[accountId]/sender-icon` route resolves stored/remote icon data through `lib/senderIcons.ts`; source search shows it does not use sharp or ImageResponse. It was outside this public icon/image-rendering smoke test; no accounts or sessions were provisioned for the probe.

## Release handoff

Keep the libvips tracing include alongside the override while on Next 16.2.4; package version checks alone did not catch the initial broken standalone. Reassess the include with the separate Next upgrade spike. The only remaining failing requested gate is the documented baseline lint error. No app server remains running. Only port 3899 was used; 3900 and other teams' ports/processes were untouched. No pushes, merges, rebases, stashes, PRs, or changes to other worktrees. Scratch checks and test-generated `undefined/` are removed before handoff; the branch is clean. This external brief is intentionally outside the committed worktree.
