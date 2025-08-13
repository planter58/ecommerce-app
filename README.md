# E-commerce App (React + Express + PostgreSQL)

## Quick Start

1) Create PostgreSQL database (e.g., `ecommerce`).

2) Backend
- Copy `backend/.env.example` to `backend/.env` and fill values.
- Install deps: `npm install --prefix backend`
- Initialize DB: `npm run db:init --prefix backend`
- Dev: `npm run dev --prefix backend` (http://localhost:5000)

3) Frontend
- Copy `frontend/.env.example` to `frontend/.env` and fill values.
- Install deps: `npm install --prefix frontend`
- Dev: `npm run dev --prefix frontend` (http://localhost:5173)

4) Monorepo convenience (optional)
- From root, install: `npm install`
- Run both: `npm run dev`

## Notes
- JWT auth, RBAC, products, categories, cart, orders, Stripe payments.
- See `backend/src/sql/schema.sql` and `seed.sql` for DB setup.
