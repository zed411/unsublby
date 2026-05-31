# Unsubly Launch Checklist

## Before Public Launch

- Rotate exposed Stripe and Google secrets, then update Vercel environment variables.
- Add a hosted production database such as Neon, Supabase, or Vercel Postgres, then set `DATABASE_URL`.
- Set `EMAIL_TOKEN_ENCRYPTION_KEY` in Vercel to a long random secret.
- Finish Google OAuth verification for Gmail read-only access.
- Publish and link final Privacy Policy and Terms URLs in Google Cloud and Stripe.
- Add a real support email to Google OAuth consent screen, Vercel, Stripe, and the app pages.
- Test production flows in an incognito browser:
  - Sign in
  - Connect Gmail
  - Start Free Scan
  - Unlock Full List
  - Stripe webhook unlock
  - Disconnect Gmail

## Current Required Vercel Environment Variables

```text
APP_URL=https://www.unsubly.online
ALLOWED_ORIGINS=https://www.unsubly.online
CLERK_SECRET_KEY=
EMAIL_OAUTH_STATE_SECRET=
EMAIL_TOKEN_ENCRYPTION_KEY=
DATABASE_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
STRIPE_PRICE_ID=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

## Google Cloud URLs

Authorized redirect URI:

```text
https://www.unsubly.online/api/email/google/callback
```

Local redirect URI:

```text
http://127.0.0.1:4174/api/email/google/callback
```

Privacy Policy:

```text
https://www.unsubly.online/privacy
```

Terms:

```text
https://www.unsubly.online/terms
```
