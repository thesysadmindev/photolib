#!/usr/bin/env bash
set -euo pipefail

# Packages a self-contained release tarball for the native (no-Docker) PM2/VPS
# deployment described in infra/setup.md. Run this AFTER `pnpm install` and
# `pnpm build` (build order already matters there: packages/shared before
# apps/web and apps/worker, which `pnpm build` already handles topologically).
#
# The tarball contains the built apps, ecosystem.config.js, and a
# production-only node_modules tree (pnpm's symlinked layout, pruned via
# `pnpm prune --prod`) - extract the WHOLE archive as one unit on the target
# machine (its node_modules symlinks are relative to the layout inside the
# archive) and no `pnpm install`/`pnpm build` is needed there. `.env` is
# never included; keep managing that directly on the target VPS.
#
# Deliberately does not touch services/watermark-svc: its Python/torch venv
# is platform-specific and is still built directly on the VPS per
# infra/setup.md.
#
# Usage: scripts/package-release.sh [output-path]

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="${GITHUB_REF_NAME:-$(git rev-parse --short HEAD 2>/dev/null || echo local)}"
OUT="${1:-photolib-${VERSION}.tar.gz}"

echo "Pruning devDependencies for a production-only install..."
# `pnpm prune --prod` asks for interactive confirmation before it will remove and
# reinstall node_modules. `printf` feeds it an explicit answer so this can't hang
# waiting on a prompt, whether run in CI or by hand from a non-interactive shell.
# (Deliberately not `yes | ...`: it never reaches EOF, so once pnpm stops reading
# stdin after the prompt, `yes` is killed by SIGPIPE - which `pipefail` above
# treats as this whole step failing, aborting the script before packaging runs.)
printf 'y\n' | pnpm prune --prod

echo "Packaging ${OUT}..."
tar \
  --exclude=".git" \
  --exclude=".github" \
  --exclude="logs" \
  --exclude="*.log" \
  --exclude=".env" \
  --exclude=".env.*" \
  -czf "$OUT" \
  node_modules \
  apps \
  packages \
  ecosystem.config.js \
  package.json \
  pnpm-workspace.yaml \
  pnpm-lock.yaml \
  README.md \
  infra

echo "Wrote $OUT"
