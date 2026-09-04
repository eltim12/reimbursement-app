# VPS infrastructure & redeploy guide

Beginner-friendly guide for the **live** reimbursement app on the new VPS.

If you only need “I pushed new code — how do I update production?”, jump to [Quick redeploy](#quick-redeploy-most-common).

---

## Big picture (what talks to what)

```
Browser
   │
   ├─► https://finance.whtb.glass          → nginx → static Vue files in /var/www/finance.whtb.glass
   │
   └─► https://finance-api.whtb.glass      → nginx → Node API (PM2) on port 3001
                                                    │
                                                    ├─► MySQL (reimbursement_db)
                                                    └─► uploaded images in reimburse-backend/public/images/
```

| Piece | What it is | Where |
|--------|------------|--------|
| **Frontend** | Vue app (HTML/JS/CSS) | Domain: `finance.whtb.glass` · Files: `/var/www/finance.whtb.glass` |
| **Backend API** | Express (Node.js) | Domain: `finance-api.whtb.glass` · Process: PM2 name `reimbursement` · Port `3001` |
| **Database** | MySQL | DB name: `reimbursement_db` · User: `fantime_user` |
| **Code on server** | Git clone of this repo | `/root/reimbursement-app` |
| **Optional mirror** | Same frontend on Firebase | `https://reimbursement-ade55.web.app` |

**Important:** Changing code on your laptop does **nothing** to production until you:

1. Push to GitHub (or upload files), **and**
2. Redeploy on the VPS (and rebuild the frontend).

---

## Server details

| Item | Value |
|------|--------|
| VPS IP | `187.53.132.155` |
| SSH user | `root` |
| App folder | `/root/reimbursement-app` |
| Backend folder | `/root/reimbursement-app/reimburse-backend` |
| Frontend web root | `/var/www/finance.whtb.glass` |
| PM2 process name | `reimbursement` |
| API internal port | `3001` |
| Git remote | `https://github.com/eltim12/reimbursement-app.git` |
| Branch | `main` |

### Login to the VPS

On your Mac/PC terminal:

```bash
ssh root@187.53.132.155
```

Enter the root password when asked.

> Prefer SSH keys over passwords when you can. Never commit passwords into git or this doc.

### Old server (legacy)

| Item | Value |
|------|--------|
| Old VPS IP | `72.60.78.140` |
| Old API domain | `reimburse-api.trimind.studio` |

Use the **new** VPS for all new deploys. Keep the old one only until cutover is fully confirmed.

---

## Quick redeploy (most common)

Use this after you committed and pushed new code to `main` on GitHub.

### A) Backend only (API / database schema)

SSH into the VPS, then run:

```bash
cd /root/reimbursement-app
git pull origin main

cd reimburse-backend
npm install --production
pm2 restart reimbursement

# Check it is healthy
curl -sS http://127.0.0.1:3001/api/health
pm2 status
```

You should see something like: `{"status":"ok",...}` and PM2 status `online`.

**Database updates:** On restart, the server runs migrate (+ seed if enabled). You usually do **not** need a separate migrate command. If you want to run it manually:

```bash
cd /root/reimbursement-app/reimburse-backend
npm run db:setup
pm2 restart reimbursement
```

### B) Frontend only (UI changes)

The live site serves **built** files, not the Vue source. You must build, then copy into `/var/www/...`.

**Option 1 — build on your laptop, upload to VPS** (recommended if Node on laptop is set up):

```bash
# On your laptop, in the project:
cd reimburse-frontend

# Confirm production API URL (should already be this):
# VITE_API_BASE_URL=https://finance-api.whtb.glass/api
cat .env.production

npm run build

# Pack the build
tar -czf /tmp/finance-frontend-dist.tar.gz -C dist .

# Upload (you will be asked for the VPS password)
scp /tmp/finance-frontend-dist.tar.gz root@187.53.132.155:/tmp/
```

Then on the VPS:

```bash
ssh root@187.53.132.155

rm -rf /var/www/finance.whtb.glass/*
tar -xzf /tmp/finance-frontend-dist.tar.gz -C /var/www/finance.whtb.glass
chown -R www-data:www-data /var/www/finance.whtb.glass
rm /tmp/finance-frontend-dist.tar.gz
```

Open `https://finance.whtb.glass` and hard-refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`).

**Option 2 — build on the VPS:**

```bash
ssh root@187.53.132.155

cd /root/reimbursement-app
git pull origin main

cd reimburse-frontend
npm install
npm run build

rm -rf /var/www/finance.whtb.glass/*
cp -R dist/* /var/www/finance.whtb.glass/
chown -R www-data:www-data /var/www/finance.whtb.glass
```

### C) Both backend + frontend

Do **A** then **B**.

### D) Optional: also update Firebase Hosting

Only if you still use `https://reimbursement-ade55.web.app`:

```bash
# On your laptop
cd reimburse-frontend
npm run build
firebase deploy --only hosting
```

Make sure `.env.production` points at `https://finance-api.whtb.glass/api` before building.

---

## Full checklist when releasing new code

1. Finish coding locally.
2. Test locally if possible (`npm run dev` frontend + backend).
3. Commit and push to `main`:
   ```bash
   git push origin main
   ```
4. Redeploy **backend** on VPS (section A).
5. Redeploy **frontend** to `/var/www/finance.whtb.glass` (section B).
6. Smoke-test:
   - Frontend loads
   - Login works
   - One list / purchasing action works
7. (Optional) Firebase deploy (section D).

---

## Useful everyday commands (on the VPS)

### App status

```bash
pm2 status
pm2 logs reimbursement --lines 50
curl -sS http://127.0.0.1:3001/api/health
```

### Restart / stop / start API

```bash
pm2 restart reimbursement
pm2 stop reimbursement
pm2 start reimbursement
pm2 save
```

### See which git commit is live

```bash
cd /root/reimbursement-app
git log -1 --oneline
```

### Nginx (web server)

```bash
nginx -t
systemctl reload nginx
systemctl status nginx
```

Config files:

- Frontend: `/etc/nginx/sites-available/finance.whtb.glass`
- API: `/etc/nginx/sites-available/finance-api.whtb.glass`

### Backend environment file

```bash
nano /root/reimbursement-app/reimburse-backend/.env
```

Important keys (do **not** paste real secrets into chat/git):

| Variable | Meaning |
|----------|---------|
| `PORT` | Must be `3001` on this VPS |
| `DB_*` | MySQL connection |
| `JWT_SECRET` | Auth token signing |
| `SEED_RESET_PASSWORDS` | Keep `false` so restarts don’t overwrite real passwords |
| `RUN_SEEDS` | `true` = ensure system users exist on startup |
| `OCR_SPACE_API_KEY` | Receipt OCR (optional) |

After editing `.env`:

```bash
pm2 restart reimbursement
```

---

## Database backup (recommended before risky deploys)

On the VPS:

```bash
mkdir -p /root/backups
set -a
source /root/reimbursement-app/reimburse-backend/.env
set +a

DUMP=/root/backups/reimbursement_db-$(date +%Y%m%d-%H%M%S).sql
mysqldump -u "$DB_USER" -p"$DB_PASSWORD" --single-transaction --routines --triggers "$DB_NAME" > "$DUMP"
gzip -f "$DUMP"
ls -lh /root/backups/*.gz | tail
```

Images (receipts) live here — include them in serious backups:

```bash
/root/reimbursement-app/reimburse-backend/public/images/
```

---

## DNS & HTTPS (SSL)

### Required DNS records (Hostinger / domain DNS)

| Type | Name | Points to |
|------|------|-----------|
| A | `finance` | `187.53.132.155` |
| A | `finance-api` | `187.53.132.155` |

Check from your laptop:

```bash
dig +short finance.whtb.glass A
dig +short finance-api.whtb.glass A
```

Both should print `187.53.132.155`.

### Issue / renew Let’s Encrypt certificate

Only after DNS resolves correctly:

```bash
certbot --nginx -d finance.whtb.glass -d finance-api.whtb.glass --non-interactive --agree-tos -m admin@whtb.glass --redirect
```

Then test:

```bash
curl -sS https://finance-api.whtb.glass/api/health
curl -sSI https://finance.whtb.glass | head
```

Certbot usually auto-renews. Manual renew:

```bash
certbot renew
```

---

## How nginx is wired

### `finance.whtb.glass` (frontend)

- Serves static files from `/var/www/finance.whtb.glass`
- SPA fallback: unknown paths → `index.html` (Vue Router)

### `finance-api.whtb.glass` (backend)

- Proxies all requests to `http://127.0.0.1:3001`
- Upload size limit: `25m`
- Health check path: `/api/health`

You normally **do not** change nginx when redeploying app code.

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Site shows old UI | Rebuild frontend and copy to `/var/www/...`, then hard-refresh browser |
| Login / API fails | `pm2 status`, `pm2 logs reimbursement`, `curl http://127.0.0.1:3001/api/health` |
| `git pull` fails | Check network/GitHub access on VPS; fix conflicts or stash local edits |
| Frontend calls wrong API | Rebuild with `.env.production` = `https://finance-api.whtb.glass/api` (and avoid overriding with `.env.local` for production builds) |
| Domain does not open | Check DNS A records; wait for propagation |
| HTTPS certificate error | DNS must point here first, then run `certbot` again |
| DB password reset after deploy | Ensure `SEED_RESET_PASSWORDS=false` in backend `.env` |
| 502 Bad Gateway on API | PM2 process down → `pm2 restart reimbursement` |

---

## Mental model for beginners

| You changed… | Redeploy… |
|--------------|-----------|
| Files under `reimburse-backend/` | Backend (git pull + `pm2 restart`) |
| Files under `reimburse-frontend/` | Frontend (build + copy to `/var/www`) |
| Both | Backend + frontend |
| Only docs / comments | Nothing required for production |

**Backend** = always-running Node process (PM2).  
**Frontend** = static files nginx already knows how to serve; you replace those files after each UI build.

---

## Copy-paste: full production update script (VPS)

Run on the VPS after code is on GitHub `main`. This updates **backend** and rebuilds **frontend on the server**:

```bash
set -e
cd /root/reimbursement-app
git pull origin main

# Backend
cd /root/reimbursement-app/reimburse-backend
npm install --production
pm2 restart reimbursement
curl -sS http://127.0.0.1:3001/api/health
echo

# Frontend
cd /root/reimbursement-app/reimburse-frontend
npm install
npm run build
rm -rf /var/www/finance.whtb.glass/*
cp -R dist/* /var/www/finance.whtb.glass/
chown -R www-data:www-data /var/www/finance.whtb.glass

echo "Done. Open https://finance.whtb.glass and hard-refresh."
```

Save this as `/root/redeploy.sh` if you want:

```bash
nano /root/redeploy.sh
# paste the script, save
chmod +x /root/redeploy.sh
# later:
/root/redeploy.sh
```
