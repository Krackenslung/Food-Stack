# Deploying TJ-Hotels

TJ-Hotels **shares** the Oracle Cloud VM you already run (`MyProjects`,
`64.181.232.104`) with the **AulaSense** project. The database lives in
**Oracle Autonomous Database**.

```
Internet ──HTTPS──► Caddy :443
   │
   ├── 64.181.232.104.nip.io           → AulaSense  :8000   (pre-existing)
   │
   └── tjhotels.64.181.232.104.nip.io  → TJ-Hotels
           ├── /static/  → disk (served by Caddy)
           ├── /api/     → gunicorn :5010  (backend)
           └── /         → gunicorn :5020  (frontend)

gunicorn :5010 ──mTLS + wallet──► Autonomous Database (TJHotels)
```

**None of this touches AulaSense.** Caddy serves several sites on the same
:443 by hostname, so a block is only **appended** to the Caddyfile.

Everything lives on one domain, so the `auth_token` cookie keeps working with
`SameSite=Strict`.

---

## Machine context (verified over SSH)

| | |
|---|---|
| OS | Ubuntu 24.04.4 LTS, x86_64 |
| RAM | 954 MB, **~500 MB free** · 2 GB swap already configured |
| Disk | 45 GB, 38 GB free |
| SSH user | **`ubuntu`** (not `opc`) |
| Already running | Caddy (:80, :443), Docker with `aulasense-backend-api` (:8000), `aulasense-backend-ingestor`, `mosquitto` (:1883, :8883) |
| Free | :5010 and :5020 |

**Memory is the tight resource.** That is why the services run with one worker
and a `MemoryMax`, so a runaway process cannot drag AulaSense down.

---

## 1. Upload the code

From your machine (PowerShell). Copy to paths **without spaces** — the original
names (`BackEnd Server`) complicate systemd and Caddy:

```powershell
scp -r "D:\Dev\projects\TJ-Hotels\BackEnd Server"  ubuntu@64.181.232.104:/tmp/backend
scp -r "D:\Dev\projects\TJ-Hotels\FrontEnd Server" ubuntu@64.181.232.104:/tmp/frontend
scp -r "D:\Dev\projects\TJ-Hotels\deploy"          ubuntu@64.181.232.104:/tmp/deploy
scp "D:\Dev\wallets\tjhotels\*"                    ubuntu@64.181.232.104:/tmp/wallet/
```

Then on the VM:

```bash
sudo useradd --system --home /opt/tjhotels --shell /usr/sbin/nologin tjhotels
sudo mkdir -p /opt/tjhotels
sudo mv /tmp/backend /tmp/frontend /tmp/deploy /tmp/wallet /opt/tjhotels/
sudo chown -R tjhotels:tjhotels /opt/tjhotels
sudo chmod 700 /opt/tjhotels/wallet
sudo sh -c 'chmod 600 /opt/tjhotels/wallet/*'
```

## 2. Python environment

Ubuntu 24.04 ships Python 3.12, the same version used locally.

```bash
sudo apt update
sudo apt install -y python3.12-venv

sudo -u tjhotels python3.12 -m venv /opt/tjhotels/venv
sudo -u tjhotels /opt/tjhotels/venv/bin/pip install --upgrade pip
sudo -u tjhotels /opt/tjhotels/venv/bin/pip install \
    -r /opt/tjhotels/backend/requirements.txt \
    -r /opt/tjhotels/frontend/requirements.txt \
    gunicorn
```

`oracledb` in thin mode needs no Oracle Instant Client — the wallet is enough.

## 3. Environment variables

`/opt/tjhotels/backend/.env`:

```
ORACLE_USER=ADMIN
ORACLE_PASSWORD=...
ORACLE_DSN=tjhotels_low
ORACLE_WALLET_DIR=/opt/tjhotels/wallet
ORACLE_WALLET_PASSWORD=...

JWT_SECRET=...            # a NEW one: openssl rand -hex 32
TOKEN_HOURS=2
FRONTEND_ORIGIN=https://tjhotels.64.181.232.104.nip.io
```

`/opt/tjhotels/frontend/.env`:

```
GOOGLE_MAPS_API_KEY=...
API_BASE=/api
```

`API_BASE=/api` is what makes the browser call the backend on the same domain.
Leaving it pointed at `127.0.0.1:5010` breaks production: that backend does not
exist on the visitor's machine.

```bash
sudo chmod 600 /opt/tjhotels/*/.env
```

## 4. Services

```bash
sudo cp /opt/tjhotels/deploy/tjhotels-backend.service  /etc/systemd/system/
sudo cp /opt/tjhotels/deploy/tjhotels-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tjhotels-backend tjhotels-frontend
```

Test locally before exposing anything:

```bash
curl -s http://127.0.0.1:5010/                                      # {"status":0,...}
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5020/app  # 200
```

If the backend fails, the reason shows up here:

```bash
journalctl -u tjhotels-backend -n 50 --no-pager
```

## 5. Caddy

```bash
# APPEND at the end, without touching the AulaSense block
sudo tee -a /etc/caddy/Caddyfile < /opt/tjhotels/deploy/Caddyfile-tjhotels

sudo caddy validate --config /etc/caddy/Caddyfile   # validate BEFORE reloading
sudo systemctl reload caddy
```

`reload` does not drop connections: AulaSense keeps serving throughout. Caddy
requests the Let's Encrypt certificate for the new subdomain the first time
someone visits it (a few seconds).

Check AulaSense is still alive:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://64.181.232.104.nip.io/docs
```

## 6. Google Maps

In Google Cloud Console, add this to the key's referrer restriction:

```
https://tjhotels.64.181.232.104.nip.io/*
```

Without it, maps and search go blank in production.

---

## Final check

```bash
curl -s https://tjhotels.64.181.232.104.nip.io/api/ | head
curl -s -o /dev/null -w "%{http_code}\n" https://tjhotels.64.181.232.104.nip.io/app
```

In the browser: register, sign in, save a favorite and reload. If the favorite
survives, the whole chain works (Caddy → gunicorn → Autonomous Database).

Watch memory for the first few hours:

```bash
free -h
systemctl status tjhotels-backend tjhotels-frontend --no-pager | grep Memory
```

## Troubleshooting

| Symptom | Usual cause |
|---|---|
| 502 on the new site | Service did not start: `journalctl -u tjhotels-backend -n 50` |
| Caddy will not reload | Syntax error: `caddy validate` catches it before anything breaks |
| Login fails | `API_BASE` is not `/api`, or `FRONTEND_ORIGIN` does not match the domain |
| `DatabaseConnectionError` | Wallet path, `ORACLE_DSN`, or the database stopped from inactivity |
| Blank maps | Domain missing from the referrer restriction |
| AulaSense gets slow | Memory: lower `MemoryMax` or the TJ-Hotels thread count |

**Remember**: the Always Free database **stops itself after 7 days of
inactivity**. Check it is *Available* before a demo.

## Rollback

To revert without leaving traces:

```bash
sudo systemctl disable --now tjhotels-backend tjhotels-frontend
sudo rm /etc/systemd/system/tjhotels-*.service
sudo systemctl daemon-reload
# remove the tjhotels.* block from the end of /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
sudo rm -rf /opt/tjhotels
```

AulaSense is unaffected at every step.
