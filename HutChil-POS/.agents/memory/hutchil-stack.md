---
name: HutChil POS stack
description: Key architecture decisions for the HutChil kratom/cannabis POS app
---

## Stack
- Frontend: React + Vite + Tailwind, artifact `hutchil` at previewPath `/`
- Backend: Express 5, artifact `api-server` at `/api`, port 8080
- DB: SQLite via better-sqlite3 (synchronous, externalized in build.mjs)
- Auth: JWT (SESSION_SECRET env) + bcryptjs, 7-day tokens stored in localStorage
- All times: store UTC in DB, display with `toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })`

## Seed accounts
- owner / owner1234 (role: owner)
- emp1 / emp1234 (role: employee)

## Sale lock rule
- Employees can edit/delete own sales within 5 minutes only
- Owner bypasses lock always

## Image compression
- canvas + maxWidth=800, quality=0.5 JPEG before storing as base64

**Why:** User explicitly requested SQLite (not PostgreSQL), Thai UI, dark theme always, JWT+bcrypt.

**How to apply:** DB path defaults to `../hutchil.db` relative to `dist/`. Use `initDb()` on server start.
