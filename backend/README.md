# Vaishnav Marble & Tiles — Backend (Node.js + MySQL)

Standalone Express + MySQL API for the marble/tiles shop. Runs separately from the Vite frontend in this repo.

> NOTE: This backend does NOT run inside Bolt. MySQL is not provisioned here and long-running Node servers are blocked. Use this on your own server / localhost. Inside Bolt the app keeps using Supabase.

## 1. Prerequisites
- Node.js 18+
- MySQL 8+ running locally or on a host you can reach

## 2. Install
```bash
cd backend
npm install
cp .env.example .env   # then edit DB creds + JWT_SECRET
```

## 3. Create the database
```sql
CREATE DATABASE vaishnav_marble CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 4. Run migrations (creates all tables)
```bash
npm run migrate
```

## 5. Seed default admin + sample categories
```bash
npm run seed
```

## 6. Start the server
```bash
npm run dev     # development (auto-reload)
npm start        # production
```

API base URL: `http://localhost:4000/api`

## Auth
- `POST /api/auth/register` — create user
- `POST /api/auth/login` — `{ email, password }` → returns `{ token, user }`
- All `/api/...` routes except `/auth/*` require `Authorization: Bearer <token>`

## Main resources
- `/api/categories`, `/api/products`, `/api/suppliers`, `/api/customers`
- `/api/purchases` (+ items), `/api/sales` (+ items)
- `/api/stock-movements`, `/api/expenses`, `/api/reports/*`
- `/api/users` (admin only)

## Frontend wiring (optional)
To point the Vite frontend at this backend instead of Supabase, set in the frontend `.env`:
```
VITE_API_BASE_URL=http://localhost:4000/api
```
and replace the Supabase calls in `src/lib/` with `fetch` calls to `VITE_API_BASE_URL`. (Not required to keep the Bolt preview working — it stays on Supabase by default.)
