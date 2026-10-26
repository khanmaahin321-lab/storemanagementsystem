# Vaishnav Marble & Tiles

Marble/tiles shop management app: products, sales, purchases, stock tracking, expenses, reports.

## Structure

This repo has two independent parts:

- **Frontend (root)** — Vite + React + TypeScript + Tailwind. This is what runs in Bolt and is served by `npm run dev`. It talks to Supabase (PostgreSQL) for data. See `src/` for the app code (`pages/`, `components/`, `lib/`).
- **`backend/`** — Standalone Node.js + Express + MySQL REST API with JWT auth. NOT run by Bolt; for use on your own server/localhost. Setup: see `backend/README.md`.

Both can run independently. The frontend currently uses Supabase; to switch it to the MySQL backend, point `VITE_API_BASE_URL` at your running backend and replace the Supabase calls in `src/lib/`.

## Frontend (root)

```bash
npm install
npm run dev      # dev server (auto-runs in Bolt)
npm run build    # production build into dist/
```

## Backend (`backend/`)

```bash
cd backend
npm install
cp .env.example .env   # set MySQL creds + JWT_SECRET
npm run migrate        # create tables
npm run seed           # default admin + categories
npm run dev            # API on http://localhost:4000/api
```

Admin login after seed: `admin@vaishnavmarble.in` / `admin123`.
