# AliveCheck

Open-source uptime monitoring for developers and small teams. AliveCheck checks public HTTP/HTTPS endpoints from outside the services you run, records results, and notifies you through SMTP or a webhook you control.

## Features

- Account register / login with HTTP-only sessions
- HTTP and HTTPS monitors (GET or HEAD)
- Interval checks, failure and recovery thresholds
- Manual **Check Now** (does not change the next scheduled run)
- Dashboard, check history, uptime (1h / 24h / 7d / 30d), incidents
- SMTP and generic webhook notifications
- SSRF protections on user-supplied URLs
- PostgreSQL via Prisma (Supabase or any Postgres)

## Requirements

- Node.js 20+
- [pnpm](https://pnpm.io/)
- A PostgreSQL database (Supabase or local)

Docker is optional. You do not need it to develop or run AliveCheck.

## Setup

```powershell
copy .env.example .env
```

Generate secrets:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run twice and put the values in `.env` as `SESSION_SECRET` and `ENCRYPTION_KEY`.

### Option A — Supabase (recommended for your laptop)

Supabase shows **two different credential groups**. AliveCheck supports both.

#### 1) API keys (Project Settings → API)

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...   # also called anon / publishable key
```

These are for the Supabase HTTP API. The publishable key is public by design.
**Never** put the `service_role` key in any `NEXT_PUBLIC_*` variable.

#### 2) Database password (Project Settings → Database)

Prisma needs Postgres, not just the API key. Easiest path:

1. Open **Project Settings → Database**.
2. Copy / reset the **database password**.
3. Put it in `.env` as `SUPABASE_DB_PASSWORD=...`

AliveCheck will derive:

```text
postgresql://postgres:...@db.YOUR_PROJECT_REF.supabase.co:5432/postgres?sslmode=require
```

Example `.env` for your project:

```env
NEXT_PUBLIC_SUPABASE_URL=https://bamhpwjygxoitwwymreu.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_or_anon_key
SUPABASE_DB_PASSWORD=your_database_password
SESSION_SECRET=...
ENCRYPTION_KEY=...
```

You can still paste full `DATABASE_URL` / `DIRECT_URL` yourself if you prefer the pooler URI from the dashboard. Explicit URLs win over derivation.

Do not enable Supabase Auth for V1. AliveCheck stores users in its own tables via Prisma.

### Option B — Local PostgreSQL (open-source self-host)

Install PostgreSQL, create database `alivecheck`, then:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/alivecheck"
DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:5432/alivecheck"
```

Or, if you use Docker only for the database:

```powershell
docker compose up postgres
```

That starts Postgres on port 5432. App processes still run with `pnpm` on the host.

## Install and run

```powershell
pnpm install
pnpm db:generate
pnpm db:migrate:deploy
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/health

Create an account, add an HTTPS monitor (not `localhost`), then use **Check Now**. The worker checks due monitors every few seconds.

## Production notes

Run the **worker** on a host that is not the machine you are monitoring. If the laptop running your API dies, the monitor must still be alive to report it.

Set `NODE_ENV=production`, `FRONTEND_URL` to your public origin, and put HTTPS in front of the app. Then run `pnpm db:migrate:deploy` and start the three processes (`web`, `api`, `worker`) with `pnpm start` in each package or a process manager such as PM2.

Optional full Docker stack (needs Docker):

```powershell
docker compose --profile app up --build
```

## Security

AliveCheck will not check private, loopback, or cloud-metadata addresses. Only `http` and `https` URLs are allowed. Notification secrets are encrypted at rest with `ENCRYPTION_KEY`.

## License

MIT
