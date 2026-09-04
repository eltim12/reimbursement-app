# Reimbursement Backend API

Node.js/Express backend for the Reimbursement Tracker application with MySQL database and local image storage.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Configure MySQL credentials in `.env`.

4. Apply schema + seed system users:
```bash
npm run db:setup
```

5. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

On startup the server also runs migrate + seed automatically (idempotent).

## Database commands

| Command | Purpose |
|---|---|
| `npm run db:migrate` | Create/update tables and columns |
| `npm run db:seed` | Upsert management + finance users |
| `npm run db:setup` | migrate + seed (use on VPS deploy) |
| `npm run init-db` | Alias for migrate (legacy) |

### System users (seeded)

| Email | Role | Default password |
|---|---|---|
| `admin@whtb.com` | management | `Wuhuatianbao88!` |
| `finance@whtb.com` | finance | `BankOfChina88!` |
| `stakeholder@whtb.com` | stakeholder (read-only) | `StakeholderView88!` |

Set `SEED_RESET_PASSWORDS=false` after first deploy if you change those passwords and do not want them overwritten on restart.

Set `RUN_SEEDS=false` to skip seeding on server start (migrate still runs).

## VPS deploy

Full beginner guide (domains, PM2, nginx, frontend + backend redeploy):

**[../docs/VPS-DEPLOY.md](../docs/VPS-DEPLOY.md)**

Short backend update on the live VPS (`187.53.132.155`):

```bash
cd /root/reimbursement-app
git pull origin main
cd reimburse-backend
npm install --production
pm2 restart reimbursement
```

Because migrate/seed are idempotent, restarting the app after deploy is enough to apply schema updates and ensure system users exist.

When you add a new migration or seed user later:
1. Update `database/migrate.js` and/or `database/seed.js`
2. Deploy + restart (or run `npm run db:setup`)

## Features

- MySQL database for data storage
- Local image storage in `public/images/` folder
- Automatic image compression to under 1MB
- Multer for file upload handling
- Sharp for image processing

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/lists` - Get all lists
- `GET /api/lists/:id` - Get a specific list with entries
- `POST /api/lists` - Create a new list
- `PUT /api/lists/:id` - Update a list
- `DELETE /api/lists/:id` - Delete a list
- `POST /api/upload-image` - Upload and compress image (multipart/form-data)
- `DELETE /api/entries/:id` - Delete an entry

## Image Upload

Images are uploaded via `multipart/form-data` with field name `image`. The server will:
1. Accept the uploaded image
2. Compress it to under 1MB
3. Save it to `public/images/` folder
4. Return the URL path (e.g., `/images/filename.jpg`)

## Environment Variables

- `DB_HOST` - MySQL host (default: localhost)
- `DB_USER` - MySQL username (default: root)
- `DB_PASSWORD` - MySQL password
- `DB_NAME` - Database name (default: reimbursement_db)
- `DB_PORT` - MySQL port (default: 3306)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `JWT_SECRET` - JWT signing secret
- `RUN_SEEDS` - Run seeds on startup / setup (default: true)
- `SEED_RESET_PASSWORDS` - Reset system user passwords on seed (default: true)

## Database Schema

- `users` - Auth accounts (`role`: user | admin | management | finance)
- `lists` - Reimbursement lists
- `entries` - Individual reimbursement entries
