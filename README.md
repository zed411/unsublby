# Unsubly

Unsubly (https://www.unsubly.online) scans a connected Gmail account with read-only permission, finds subscriptions, newsletters, and notification lists, and helps you unsubscribe — including real RFC 8058 one-click unsubscribes for senders that support them.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Clerk** for authentication
- **Google OAuth** (gmail.readonly scope) for inbox scanning
- **Stripe Checkout** for the $0.99 Deep Search unlock
- **Postgres** in production (`DATABASE_URL`), SQLite locally

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in keys
npm run dev                  # http://127.0.0.1:4174
```

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on port 4174 |
| `npm run build` | Production build |
| `npm run check` | TypeScript type check |

Without Clerk keys the app runs in a demo mode with sample data. Append `?demo=1` to preview the demo flow even when auth is enabled.

## How it works

1. **Sign in** with Clerk, then connect Gmail (`/api/email/google/start` → Google consent → `/api/email/google/callback`). OAuth tokens are stored encrypted (AES-256-GCM with `EMAIL_TOKEN_ENCRYPTION_KEY`).
2. **Scan** (`/api/email/scan`) searches recent mail for unsubscribe/subscription signals, dedupes by sender, and returns up to 6 results free or 50 with Deep Search.
3. **Unsubscribe** (`/api/email/unsubscribe`) re-reads the message server-side; if the sender supports `List-Unsubscribe-Post` it performs a one-click unsubscribe POST, otherwise it returns the unsubscribe link for the user to open.
4. **Deep Search unlock** goes through Stripe Checkout; fulfillment happens via the Stripe webhook (`/api/stripe-webhook`) and is also verified on the success redirect.

## Environment variables

See `.env.example` for the full list. Everything is validated at `/api/readiness`, which reports which pieces are configured. `/api/health` is a simple liveness check.

## Deployment

Deployed on Vercel with the env vars listed in `LAUNCH_CHECKLIST.md`. That file also covers Google OAuth verification and Stripe setup steps; `LIVE_TEST_STEPS.md` walks through a production smoke test.
