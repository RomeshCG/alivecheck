# TinyPulse — Open-Source Uptime Monitoring

## 1. Project Overview

TinyPulse is a small, self-hosted/open-source uptime monitoring platform for developers and small teams.

The goal is to provide a simple alternative to paid uptime-monitoring services:

- Monitor public HTTP/HTTPS endpoints automatically.
- Detect downtime without manually opening the application.
- Measure response time and uptime.
- Send notifications when a service goes down or recovers.
- Allow users to configure their own notification services.
- Provide a dashboard for current and historical health.
- Provide a manual "Check Now" health check.
- Keep the project lightweight and inexpensive to self-host.

A key design principle is that the monitoring service should run separately from the services it monitors. If the monitored home server goes offline, the monitor must remain online so it can detect and report the outage.

---

## 2. Example Use Case

A developer hosts an Express API on a Linux Mint laptop:

```text
Internet
   |
   v
Cloudflare
   |
Cloudflare Tunnel
   |
   v
Linux Mint
   |
Express API :3000
   |
Prisma
   |
MySQL
```

TinyPulse runs somewhere else:

```text
TinyPulse Monitoring Server
          |
          | every 60 seconds
          v
https://api.example.com/health
          |
          v
Cloudflare Tunnel
          |
          v
Home API
```

If the laptop loses power, Wi-Fi, Express crashes, PM2 stops, or the Cloudflare Tunnel becomes unavailable, TinyPulse detects the failed checks and sends an alert.

---

## 3. V1 Goals

V1 should remain intentionally small.

### Core Goals

1. Create and manage monitors.
2. Automatically check monitors on a configurable interval.
3. Record every check result.
4. Detect DOWN and RECOVERED states.
5. Measure response time and uptime.
6. Show current service status.
7. Show basic uptime history.
8. Allow manual "Check Now".
9. Send notifications.
10. Support SMTP and generic webhooks.
11. Provide a simple authentication system.
12. Provide Docker-based deployment.
13. Keep the architecture easy to understand and self-host.

---

# 4. V1 Features

## 4.1 User Authentication

Basic account system:

- Register
- Login
- Logout
- Password hashing
- Session authentication
- Change password
- Delete account

Security requirements:

- Rate-limit authentication endpoints.
- Never store plaintext passwords.
- Do not expose secrets in API responses.
- Use secure HTTP-only cookies.
- Validate all incoming data.

---

## 4.2 Monitor Management

Users can create monitors.

### Monitor Fields

```text
id
name
url
method
interval
timeout
expectedStatus
failureThreshold
recoveryThreshold
enabled
createdAt
updatedAt
```

### V1 Methods

- GET
- HEAD

### Example

```json
{
  "name": "XoneX API",
  "url": "https://api.example.com/health",
  "method": "GET",
  "interval": 60,
  "timeout": 10,
  "expectedStatus": 200,
  "failureThreshold": 3,
  "recoveryThreshold": 2,
  "enabled": true
}
```

---

## 4.3 Automatic Health Checks

The worker periodically checks every enabled monitor.

The worker records:

- Timestamp
- HTTP status
- Response time
- Success/failure
- Error category
- Response size

Do not store full response bodies by default.

```text
Every 60 seconds
      |
      v
GET /health
      |
      v
HTTP 200?
   /       \
 YES       NO
  |         |
 UP       failure++
            |
       threshold reached?
            |
            v
           DOWN
```

---

## 4.4 Failure Detection

Do not immediately mark a service DOWN after one failed request.

Example:

```text
Failure threshold: 3

Check 1 → timeout → failure 1
Check 2 → timeout → failure 2
Check 3 → timeout → failure 3
                     |
                     v
                    DOWN
```

This reduces false alerts caused by temporary network problems.

---

## 4.5 Recovery Detection

Use a recovery threshold as well.

```text
Recovery threshold: 2

DOWN
 |
 +--> Check 1 → 200
 |
 +--> Check 2 → 200
 |
 v
RECOVERED
```

Send a recovery notification only after the configured recovery threshold is reached.

---

# 5. Manual "Check Now"

Every monitor should have:

```text
[ Check Now ]
```

The backend immediately performs a health check and returns:

```json
{
  "status": "up",
  "httpStatus": 200,
  "responseTime": 184,
  "checkedAt": "2026-09-20T06:00:00Z"
}
```

A manual check should not permanently alter the monitor's schedule.

---

# 6. Dashboard

Example:

```text
TinyPulse

3 / 3 services operational

-----------------------------------------
🟢 XoneX API              184 ms
   Last checked: 10 sec ago

🟢 Frontend                91 ms
   Last checked: 35 sec ago

🔴 Payment API             DOWN
   Last checked: 20 sec ago
-----------------------------------------
```

Monitor detail should show:

- Current status
- Current response time
- Last check
- Uptime percentage
- Recent check history
- Response-time history
- Failure/recovery events
- Manual Check Now

---

# 7. Uptime Calculation

V1 should show:

- 1 hour
- 24 hours
- 7 days
- 30 days

Basic calculation:

```text
uptime = successful checks / total checks * 100
```

Later, uptime can be calculated from actual outage duration for more accurate reporting.

---

# 8. Notification System

Notifications should use a provider/adapter architecture:

```text
NotificationProvider
        |
        +-- SMTP
        |
        +-- Generic Webhook
        |
        +-- Telegram (V2)
        |
        +-- Discord (V2)
        |
        +-- Slack (V2)
```

Interface:

```typescript
interface NotificationProvider {
  send(event: MonitorEvent): Promise<void>;
}
```

## SMTP

Users configure their own mail server:

```text
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
```

## Generic Webhook

Example:

```text
POST https://example.com/webhook
```

Payload:

```json
{
  "event": "monitor.down",
  "monitor": "XoneX API",
  "url": "https://api.example.com/health",
  "timestamp": "2026-09-20T06:00:00Z"
}
```

SMTP passwords and webhook secrets must be encrypted at rest.

---

# 9. Notification Events

V1:

- DOWN
- RECOVERED

Optional later:

- DEGRADED

Avoid notification spam:

```text
3 failures
   ↓
DOWN
   ↓
one alert
   ↓
continue checking
   ↓
recovery threshold reached
   ↓
one recovery alert
```

---

# 10. Health Endpoint Monitoring

Users can monitor an existing endpoint such as:

```text
https://api.example.com/health
```

Recommended application endpoints:

```text
/health
```

Basic liveness/process check.

```text
/health/ready
```

Readiness check that can optionally verify dependencies such as a database.

Health endpoints must not expose:

- Database credentials
- Filesystem paths
- Internal IPs
- Stack traces
- Environment variables
- Sensitive infrastructure information

---

# 11. Monitor Types

## V1

- HTTP
- HTTPS

## V2+

- TCP
- DNS
- Ping/ICMP
- WebSocket
- Keyword checks
- JSON response assertions
- SSL certificate expiration
- Docker/container health
- Push monitors

---

# 12. Security Requirements

Security is a first-class requirement because TinyPulse makes outbound requests to user-provided URLs.

## SSRF Protection

A user must not be able to make the monitoring worker request internal infrastructure.

Block addresses and ranges such as:

```text
http://localhost
http://127.0.0.1
http://169.254.169.254
http://10.x.x.x
http://192.168.x.x
http://172.16.x.x
```

Implement:

- URL validation
- DNS/IP validation
- Private-network blocking
- DNS rebinding protection
- Redirect validation

## Request Restrictions

- HTTP/HTTPS only in V1.
- Strict request timeout.
- Limit redirects.
- Limit response size.
- Do not execute downloaded content.
- Do not allow shell commands.

## API Security

- Authentication
- Authorization
- Input validation
- Rate limiting
- Secure HTTP-only cookies
- Security headers
- Safe error responses
- Dependency auditing

---

# 13. Recommended Tech Stack

## Frontend

```text
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
Lucide
Recharts
```

## Backend

```text
Node.js
Express
TypeScript
Zod
Prisma
```

## Database

```text
PostgreSQL
```

For the default hosted deployment:

```text
Supabase PostgreSQL
```

The application connects to PostgreSQL through Prisma.

## Worker

```text
Node.js
TypeScript
```

## Email

```text
Nodemailer
```

## HTTP Checker

```text
Node.js fetch
```

or:

```text
undici
```

## Authentication

```text
HTTP-only sessions
Argon2id
```

## Deployment

```text
Docker
Docker Compose
```

## Testing

```text
Vitest
Supertest
```

---

# 14. Database Hosting — Supabase

For V1, **Supabase PostgreSQL is the recommended default hosted database option**.

Instead of paying for and managing a separate MySQL/PostgreSQL database server, TinyPulse can use Supabase's hosted PostgreSQL.

Architecture:

```text
TinyPulse
   |
   +-- Express API
   |
   +-- Monitoring Worker
   |
   +-- Prisma
          |
          v
      PostgreSQL
          |
          v
       Supabase
```

### Why Supabase?

- Hosted PostgreSQL.
- Low infrastructure overhead.
- Suitable for a small monitoring platform.
- Works with Prisma.
- No database server administration required for the default deployment.
- Easy to start with a small project.

---

# 15. PostgreSQL Portability

TinyPulse should **not become dependent on Supabase-specific APIs**.

The core database architecture should be:

```text
TinyPulse
    |
  Prisma
    |
    v
Standard PostgreSQL
```

The same application should work with:

```text
Supabase PostgreSQL
        OR
Self-hosted PostgreSQL
        OR
Neon
        OR
Railway
        OR
AWS RDS
        OR
Another PostgreSQL provider
```

Example:

```env
DATABASE_URL=postgresql://user:password@host:5432/tinypulse
```

This keeps TinyPulse genuinely open-source and self-hostable.

---

# 16. Supabase Auth Decision

Supabase Auth can be used if desired, but it should not be required by the core application.

For maximum portability, V1 can use:

```text
Express
   |
Session Authentication
   |
Argon2id
   |
PostgreSQL
```

This means users can self-host TinyPulse without depending on Supabase authentication.

---

# 17. Background Jobs

## V1

Do not add Redis initially.

Use a dedicated Node.js worker:

```text
Express API
     |
     +------ PostgreSQL
     |
     Worker
       |
       +------ PostgreSQL
       |
       +------ External HTTP services
```

The worker finds monitors that are due and executes them.

This keeps infrastructure simple and cheap.

## V2 / Scaling

When required, introduce:

```text
Redis
BullMQ
```

BullMQ can provide:

- Queues
- Workers
- Retries
- Concurrency
- Scheduled jobs
- Job recovery

Redis should not be mandatory for V1.

---

# 18. Supabase Database Architecture

```text
                         TinyPulse
                            |
              +-------------+-------------+
              |                           |
              v                           v
          Express API                  Worker
              |                           |
              +-------------+-------------+
                            |
                          Prisma
                            |
                            v
                    Supabase PostgreSQL
                            |
            +---------------+---------------+
            |               |               |
            v               v               v
         monitors        checks         incidents
            |
            +-- users
            +-- notification providers
            +-- monitor notifications
```

Supabase is primarily the default hosted PostgreSQL provider.

The core application should not require:

- Supabase Auth
- Supabase Edge Functions
- Supabase Storage
- Supabase Realtime

This keeps the project portable.

---

# 19. Application Architecture

```text
                         Internet
                            |
                            v
                    Reverse Proxy
                  / Cloudflare/etc.
                            |
               +------------+------------+
               |                         |
               v                         v
           Next.js                    Express
           Frontend                     API
                                      |
                    +-----------------+----------------+
                    |                 |                |
                    v                 v                v
                 Prisma          Notification       Worker
                    |             Providers            |
                    v                                  |
             PostgreSQL                                 |
                                                       |
                                                       v
                                              HTTP/HTTPS Targets
```

The worker should be a separate process from the API.

---

# 20. Database Models

## User

```text
User
- id
- email
- passwordHash
- createdAt
- updatedAt
```

## Monitor

```text
Monitor
- id
- userId
- name
- url
- method
- intervalSeconds
- timeoutSeconds
- expectedStatus
- failureThreshold
- recoveryThreshold
- enabled
- currentStatus
- consecutiveFailures
- consecutiveSuccesses
- lastCheckedAt
- createdAt
- updatedAt
```

## MonitorCheck

```text
MonitorCheck
- id
- monitorId
- checkedAt
- success
- statusCode
- responseTimeMs
- errorType
```

Indexes:

```text
monitorId
checkedAt
```

## NotificationProvider

```text
NotificationProvider
- id
- userId
- type
- name
- encryptedConfig
- enabled
- createdAt
- updatedAt
```

## MonitorNotification

```text
MonitorNotification
- id
- monitorId
- providerId
- enabled
```

## Incident

```text
Incident
- id
- monitorId
- startedAt
- resolvedAt
- duration
- errorSummary
```

---

# 21. API Endpoints

## Authentication

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
PATCH  /api/auth/password
DELETE /api/auth/account
```

## Monitors

```text
GET    /api/monitors
POST   /api/monitors
GET    /api/monitors/:id
PATCH  /api/monitors/:id
DELETE /api/monitors/:id
POST   /api/monitors/:id/check
POST   /api/monitors/:id/pause
POST   /api/monitors/:id/resume
```

## History

```text
GET /api/monitors/:id/checks
GET /api/monitors/:id/uptime
GET /api/monitors/:id/incidents
```

## Notifications

```text
GET    /api/notification-providers
POST   /api/notification-providers
PATCH  /api/notification-providers/:id
DELETE /api/notification-providers/:id
POST   /api/notification-providers/:id/test
```

## Dashboard

```text
GET /api/dashboard/summary
```

---

# 22. Worker Design

```text
Worker starts
    |
    v
Find enabled monitors that are due
    |
    v
Execute HTTP request
    |
    v
Record result
    |
    +---- success ----> update success counters
    |
    +---- failure ----> update failure counters
    |
    v
Check state transition
    |
    +---- DOWN -------> notification
    |
    +---- RECOVERED --> notification
    |
    v
Schedule next check
```

The worker must avoid duplicate checks for the same monitor.

---

# 23. Time and Data Retention

Store timestamps in UTC and display them in the user's local timezone.

Suggested V1 retention:

```text
Raw checks: 30 days
Incidents: longer retention
```

Later, aggregate old checks into hourly/daily statistics.

This prevents the database from growing indefinitely.

---

# 24. Docker Deployment

## Production

Supabase is external:

```text
Docker Host
│
├── frontend
├── api
└── worker
        |
        v
Supabase PostgreSQL
```

## Local Development

Developers should be able to run PostgreSQL locally:

```text
Docker Compose
│
├── frontend
├── api
├── worker
└── postgres
```

This means contributors do not need a Supabase account just to develop TinyPulse.

---

# 25. Environment Variables

```env
NODE_ENV=production

DATABASE_URL=

API_PORT=4000

SESSION_SECRET=

ENCRYPTION_KEY=

FRONTEND_URL=

CHECKER_USER_AGENT=TinyPulse/1.0
```

Never commit:

```text
.env
.env.production
SMTP passwords
session secrets
encryption keys
database passwords
```

Provide:

```text
.env.example
```

---

# 26. Project Structure

```text
tinypulse/
│
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   │
│   └── api/
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── monitors/
│       │   │   ├── notifications/
│       │   │   └── dashboard/
│       │   ├── middleware/
│       │   ├── lib/
│       │   └── server.ts
│       │
│       └── prisma/
│           └── schema.prisma
│
├── worker/
│   └── src/
│       ├── scheduler/
│       ├── checker/
│       └── notifications/
│
├── packages/
│   └── shared/
│
├── docker-compose.yml
├── .env.example
├── README.md
└── LICENSE
```

---

# 27. V1 UI Pages

```text
/login
/register

/dashboard

/monitors
/monitors/new
/monitors/[id]

/notifications
/notifications/new

/settings
```

---

# 28. Status Model

```text
NEW
 |
 v
UP <---------------- RECOVERED
 |
 | failures >= threshold
 v
DOWN
 |
 | successes >= threshold
 v
RECOVERED
 |
 v
UP
```

Avoid treating every failed request as an incident.

---

# 29. Testing

## Unit Tests

- URL validation
- SSRF protection
- Status calculation
- Failure threshold
- Recovery threshold
- Uptime calculation
- Notification formatting

## Integration Tests

- Create monitor
- Execute check
- Record result
- DOWN transition
- RECOVERED transition
- Notification dispatch

## Security Tests

Especially:

```text
localhost URLs
127.0.0.1
private IPs
IPv6 localhost
cloud metadata IPs
DNS rebinding
redirects to private IPs
huge responses
slow responses
invalid URLs
```

---

# 30. V1 Non-Goals

Do NOT build initially:

- Mobile application
- Kubernetes monitoring
- Distributed multi-region workers
- Complex alert rules
- AI anomaly detection
- Synthetic browser testing
- Full observability/logging platform
- APM
- Distributed tracing
- Dozens of notification integrations
- Billing/subscriptions
- Enterprise RBAC
- Multi-region monitoring

Keep V1 focused on:

```text
Monitor → Detect → Record → Notify
```

---

# 31. V2 Ideas

- Telegram
- Discord
- Slack
- Microsoft Teams
- More webhook formats
- TCP monitoring
- DNS monitoring
- Ping monitoring
- Keyword matching
- JSON assertions
- SSL certificate expiry alerts
- Maintenance windows
- Public status pages
- Team accounts
- Multiple notification rules
- Redis + BullMQ
- Multiple monitoring workers
- Regional monitoring
- Docker monitoring
- API tokens
- CLI
- Prometheus metrics
- OpenTelemetry integration

---

# 32. Cost and Infrastructure Philosophy

TinyPulse should minimize infrastructure costs during V1.

### Default Production Architecture

```text
Frontend
   |
   v
Low-cost/free hosting
   |
   v
Express API + Worker
   |
   v
Supabase PostgreSQL
```

There is no requirement for a separate paid MySQL/PostgreSQL server for TinyPulse.

### Local Development

```text
Docker Compose
     |
     +-- Next.js
     +-- Express
     +-- Worker
     +-- PostgreSQL
```

### Important

The monitoring worker should run independently from the services being monitored.

For example:

```text
Monitoring Server
      |
      | HTTPS
      v
Cloudflare
      |
      v
Home Server
      |
      v
Express API
```

If the home server goes offline, the monitoring server remains available and can report the failure.

---

# 33. Project Philosophy

TinyPulse should remain:

- Open source
- Self-hostable
- Lightweight
- Transparent
- Privacy-friendly
- Cheap to operate
- Easy to deploy
- Easy to understand
- Easy to contribute to

Users should own their:

- Monitoring data
- Notification credentials
- Infrastructure
- Deployment

The project should not require a proprietary notification service.

---

# 34. Recommended V1 Stack Summary

| Layer | Technology |
|---|---|
| Frontend | Next.js + React + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Icons | Lucide |
| Charts | Recharts |
| Backend | Node.js + Express + TypeScript |
| Validation | Zod |
| ORM | Prisma |
| Database | PostgreSQL |
| Hosted DB | Supabase PostgreSQL |
| Self-hosted DB | PostgreSQL |
| Worker | Node.js + TypeScript |
| Queue | None initially |
| Future Queue | Redis + BullMQ |
| HTTP Checks | Node fetch / undici |
| Email | Nodemailer + SMTP |
| Authentication | HTTP-only sessions + Argon2id |
| Secret Encryption | AES-256-GCM |
| Deployment | Docker Compose |
| Reverse Proxy | Cloudflare / Caddy / Nginx |
| Testing | Vitest + Supertest |
| Linting | ESLint |
| Formatting | Prettier |
| Package Manager | npm or pnpm |

---

# 35. V1 Definition of Done

V1 is complete when a new user can:

1. Start TinyPulse with Docker Compose.
2. Create an account.
3. Create an HTTPS monitor.
4. Set its interval and timeout.
5. See the monitor become UP.
6. See response time.
7. Manually run "Check Now".
8. View check history.
9. View uptime.
10. Configure SMTP.
11. Send a test notification.
12. Receive a DOWN notification.
13. Receive a RECOVERED notification.
14. Restart the server and have monitoring continue automatically.
15. Configure multiple monitors.
16. Safely monitor external services without being able to use TinyPulse as an SSRF tool.

---

# 36. Suggested Development Order

## Phase 1 — Foundation

- Monorepo
- Next.js
- Express
- PostgreSQL
- Supabase connection
- Prisma
- Docker Compose
- Authentication

## Phase 2 — Monitoring

- Monitor CRUD
- HTTP checker
- Scheduler
- Check history
- Status state machine
- Manual Check Now

## Phase 3 — Dashboard

- Monitor cards
- Status indicators
- Response-time charts
- Uptime calculations
- Incident history

## Phase 4 — Notifications

- Notification provider abstraction
- SMTP
- Generic webhook
- Test notification
- DOWN alert
- RECOVERED alert

## Phase 5 — Security

- SSRF protection
- Rate limiting
- Input validation
- Credential encryption
- Secure sessions
- Security headers
- Dependency audit
- Security test suite

## Phase 6 — Release

- Docker image
- Docker Compose
- `.env.example`
- README
- Installation guide
- Screenshots
- Contribution guide
- License
- GitHub Actions CI

---

# 37. Important Architectural Decision

The monitoring worker should **NOT normally run on the same machine as the service being monitored.**

### Bad

```text
Home Laptop
├── XoneX API
└── TinyPulse Worker

Laptop dies
    ↓
API dies
    ↓
Worker dies
    ↓
No alert
```

### Better

```text
Monitoring Host
└── TinyPulse Worker
        |
        | HTTPS
        v
Cloudflare
        |
        v
Home Laptop
└── XoneX API

Laptop dies
    ↓
TinyPulse remains alive
    ↓
Health checks fail
    ↓
Notification sent
```

This separation is the most important requirement for reliable uptime monitoring.

---

# 38. Existing Projects as Reference

Uptime Kuma is a useful open-source reference for feature ideas because it supports multiple monitor types and notification providers.

Gatus is another useful reference for configurable health checks and alerting.

TinyPulse should remain substantially smaller for V1 rather than attempting to reproduce the entire feature set of these projects.

---

# 39. Final V1 Concept

```text
                 ┌─────────────────────────┐
                 │       TinyPulse          │
                 │                         │
                 │ Next.js Dashboard       │
                 │ Express API             │
                 │ Monitoring Worker       │
                 │ Prisma                  │
                 │ PostgreSQL              │
                 │ Supabase (default)      │
                 │ Notification Engine     │
                 └────────────┬────────────┘
                              │
                    HTTP / HTTPS checks
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
          API Server      Website         API #3
              │
              ▼
          /health
              │
          UP / DOWN
              │
              ▼
       Notification Provider
         SMTP / Webhook
              │
              ▼
             User
```

## Core Philosophy

> A tiny, self-hostable uptime monitor that checks your services from outside, detects real outages, records what happened, and notifies you through infrastructure you control.

## Final Infrastructure Decision

For V1:

```text
Frontend
   ↓
Express API
   ↓
Prisma
   ↓
Supabase PostgreSQL
```

The monitoring worker runs independently:

```text
TinyPulse Worker
      ↓
HTTP/HTTPS
      ↓
User's Service
```

Supabase is the **default hosted PostgreSQL provider**, not a hard dependency. Users can replace it with any compatible PostgreSQL database while keeping the same Prisma-based application architecture.
