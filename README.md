# Photo Library

Personal RAW photo library. Admin uploads RAW files, they're converted to JPG for
display, visitors browse the gallery and download JPGs (invisibly watermarked per
download for leak tracing) or admins download the original RAW.

## Architecture

- `apps/web` - Next.js (public gallery/detail/download + admin UI + API routes)
- `apps/worker` - BullMQ job processor (darktable-cli RAW→JPEG conversion, exiftool EXIF extraction)
- `services/watermark-svc` - Python/FastAPI sidecar wrapping [TrustMark](https://github.com/adobe/trustmark) for invisible watermark embed/extract
- `packages/shared` - Drizzle DB schema/client, R2 storage client, BullMQ queue defs, shared types

Runs natively on a single VPS (no Docker), processes supervised by PM2. See
[`infra/setup.md`](./infra/setup.md) for the full provisioning runbook.

## Local development

Prerequisites: Node 20+, pnpm, a local Postgres + Redis (or point `.env` at remote
ones), `darktable-cli` and `exiftool` on PATH, Python 3.10+ for the watermark sidecar,
and a Cloudflare R2 bucket (or any S3-compatible bucket) with credentials.

```bash
cp .env.example .env   # fill in DATABASE_URL, REDIS_URL, R2_*, NEXTAUTH_SECRET, etc.
pnpm install

# build the shared package once before running web/worker
pnpm --filter @photolib/shared run build

# db
pnpm db:migrate
pnpm --filter @photolib/web run seed-admin   # reads ADMIN_EMAIL / ADMIN_PASSWORD from .env

# watermark sidecar (separate terminal)
cd services/watermark-svc
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000

# web + worker (watches shared for changes too)
pnpm dev
```

Site: http://localhost:3000, admin login: http://localhost:3000/admin/login

## Notes

- RAW files are never exposed publicly - only the admin can download originals
  (`/admin/photos` → "Download RAW"), and that download is logged but not watermarked
  (RAW formats can't be steganographically watermarked without corruption).
- Every public JPG download embeds a unique opaque token; `download_events` maps that
  token to the downloader's IP + UTC timestamp. `/admin/lookup` recovers the token from
  a suspicious/leaked JPG and resolves it back to that record.
