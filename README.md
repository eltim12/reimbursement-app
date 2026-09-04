# reimbursement-app

Multi-tenant reimbursement & purchasing tracker (Vue frontend + Express/MySQL backend).

## Project layout

| Folder | Role |
|--------|------|
| `reimburse-frontend/` | Vue 3 + Vite + Tailwind UI |
| `reimburse-backend/` | Express API + MySQL + image uploads |
| `docs/` | Ops / deploy guides |

## Production URLs

| Role | URL |
|------|-----|
| Frontend | https://finance.whtb.glass |
| API | https://finance-api.whtb.glass |
| Optional Firebase mirror | https://reimbursement-ade55.web.app |

## Redeploy (new code → live)

See the beginner guide:

**[docs/VPS-DEPLOY.md](docs/VPS-DEPLOY.md)**

Short version after pushing to `main`:

1. SSH: `ssh root@187.53.132.155`
2. Pull + restart API + rebuild frontend (commands in the guide)

## Local development

```bash
# Backend
cd reimburse-backend
cp .env.example .env   # edit DB + JWT
npm install
npm run db:setup
npm run dev

# Frontend (other terminal)
cd reimburse-frontend
npm install
npm run dev
```

Frontend defaults to `http://localhost:3000/api` via `.env.development`.
