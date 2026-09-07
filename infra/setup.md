# VPS provisioning runbook (native install, no Docker)

Target: a single Ubuntu 22.04/24.04 VPS. All services run natively, supervised by PM2
(`web`, `worker`, `watermark-svc`) or systemd (`postgres`, `redis`), fronted by nginx for
TLS.

## 1. System packages

```bash
sudo apt update
sudo apt install -y \
  postgresql postgresql-contrib \
  redis-server \
  darktable \
  libimage-exiftool-perl \
  python3 python3-venv python3-pip \
  curl git build-essential
```

Verify:

```bash
darktable-cli --version
exiftool -ver
psql --version
redis-cli --version
```

## 2. Node.js + pnpm + PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pnpm pm2
```

## 3. Postgres

```bash
sudo -u postgres psql -c "CREATE USER photolib WITH PASSWORD '<choose-a-password>';"
sudo -u postgres psql -c "CREATE DATABASE photolib OWNER photolib;"
sudo systemctl enable --now postgresql
```

Set `DATABASE_URL=postgres://photolib:<password>@localhost:5432/photolib` in `.env`.

## 4. Redis

```bash
sudo systemctl enable --now redis-server
```

Default `REDIS_URL=redis://localhost:6379` is fine for a single-box deployment (Redis
bound to localhost only - do not expose it externally).

## 5. Clone and build the app

```bash
git clone <your-repo-url> /opt/photolib
cd /opt/photolib
cp .env.example .env
# edit .env: DATABASE_URL, REDIS_URL, R2_*, NEXTAUTH_SECRET, NEXTAUTH_URL, ADMIN_EMAIL, ADMIN_PASSWORD

pnpm install
pnpm build   # builds packages/shared then apps/web and apps/worker, in dependency order
```

`NEXTAUTH_SECRET` should be a long random value, e.g. `openssl rand -base64 32`.

**Alternative:** instead of building on the VPS, download a pre-built release tarball
from the repo's GitHub Releases (produced by `.github/workflows/release.yml` on every
`vX.Y.Z` tag - lint + build already passed in CI) and skip straight to `pnpm install`/
`pnpm build` below:

```bash
mkdir -p /opt/photolib && cd /opt/photolib
curl -fsSL -o photolib.tar.gz https://github.com/<org>/<repo>/releases/download/vX.Y.Z/photolib-vX.Y.Z.tar.gz
tar -xzf photolib.tar.gz
cp .env.example .env   # edit as below - the tarball never contains .env
```

This only covers `apps/web`, `apps/worker`, and `packages/shared` (already built, with
`node_modules` pruned to production dependencies) - still do steps 6-9 as normal, and
still build the Python watermark sidecar (step 7) directly on the VPS, since its
torch/torchvision wheels are platform-specific and aren't part of the tarball.

## 6. Database migrations + admin user

```bash
pnpm db:generate   # only needed after schema.ts changes
pnpm db:migrate
pnpm --filter @photolib/web run seed-admin   # reads ADMIN_EMAIL / ADMIN_PASSWORD from .env
```

## 7. Watermark sidecar (Python)

This pulls in TrustMark's ML stack (torch/torchvision/lightning) - a few GB, several
minutes on first install. Budget disk space accordingly (10GB+ free recommended).

```bash
cd /opt/photolib/services/watermark-svc
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
```

Sanity check before wiring into PM2:

```bash
.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000 &
curl http://127.0.0.1:8000/healthz   # expect {"status":"ok"}
kill %1
```

## 8. Worker scratch directory

```bash
sudo mkdir -p /tmp/photolib
sudo chown $USER:$USER /tmp/photolib
```

Set `WORKER_SCRATCH_DIR=/tmp/photolib` in `.env` (or point it somewhere with more free
space if `/tmp` is small - RAW files can be 20-80MB each and the worker downloads one
per in-flight conversion job).

## 9. Start everything with PM2

```bash
cd /opt/photolib
mkdir -p logs
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # follow the printed command to enable start-on-boot
```

Check status: `pm2 status`, `pm2 logs photolib-worker`, etc.

## 10. Firewall

Only nginx's ports (80/443) and SSH should be reachable from outside. Everything else
(`web` on :3000, `worker`, `watermark-svc` on :8000, Postgres :5432, Redis :6379) binds
to localhost and must never be exposed:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

## 11. nginx (TLS reverse proxy)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/photolib`:

```nginx
server {
    listen 80;
    server_name your-domain.example;

    # RAW uploads can be tens of MB; nginx's default 1m client_max_body_size
    # would reject them with 413 otherwise. Give some headroom above
    # MAX_UPLOAD_SIZE_MB in .env.
    client_max_body_size 200m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        # nginx does NOT set this automatically (unlike Caddy) - apps/web/src/lib/ip.ts
        # relies on it for the download audit log, and that's only safe because the
        # firewall above guarantees `web` is unreachable except through nginx.
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # RAW downloads/uploads can take a while on a slow connection.
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/photolib /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Then get a TLS certificate (certbot's nginx plugin edits the config above in place to
add the `listen 443 ssl` block and the HTTP→HTTPS redirect):

```bash
sudo certbot --nginx -d your-domain.example
```

Certbot installs a systemd timer for renewal automatically - verify with
`sudo certbot renew --dry-run`.

## 12. Redeploying after a code change

```bash
cd /opt/photolib
git pull
pnpm install
pnpm build
pnpm db:migrate   # if schema.ts changed
pm2 restart ecosystem.config.js
```

Or, using a CI-built release tarball instead of building on the VPS:

```bash
cd /opt/photolib
curl -fsSL -o photolib.tar.gz https://github.com/<org>/<repo>/releases/download/vX.Y.Z/photolib-vX.Y.Z.tar.gz
tar -xzf photolib.tar.gz   # overwrites apps/, packages/, node_modules/ - leaves .env alone
pnpm db:migrate            # if schema.ts changed
pm2 restart ecosystem.config.js
```
