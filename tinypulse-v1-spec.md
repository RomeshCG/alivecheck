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