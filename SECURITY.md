# Unsubly Backend Safety Checklist

This prototype now includes the backend safety foundation needed before adding real payments or real inbox scanning.

## Already Set Up

- Security headers, including CSP, frame blocking, content sniffing protection, and strict referrer policy.
- API rate limiting per client and route.
- Request body size limits for normal API routes and Stripe webhooks.
- Origin allow-list checks for payment session creation.
- Server-only Stripe environment variable placeholders in `.env.example`.
- Stripe Checkout Session endpoint scaffold at `/api/create-checkout-session`.
- Stripe webhook endpoint scaffold at `/api/stripe-webhook`.
- Webhook signature verification using the Stripe webhook secret.
- Safe static file serving with path traversal protection.

## Still Needed Before Launch

- Real user accounts and authentication.
- A database table for users, scans, subscriptions, payments, and unlock status.
- A real Stripe product/price for the $0.99 Deep Search unlock.
- Production webhook fulfillment that marks `deepSearchUnlocked` for the paid user.
- Gmail/Outlook/SMS OAuth permissions with least-privilege scopes.
- Encrypted storage for OAuth tokens and scan metadata.
- A data deletion flow so users can remove their scan history.
- Audit logging for payment unlocks and unsubscribe actions.

## Important Rule

Never trust the browser to unlock paid access. The frontend can show UI changes, but the backend must confirm payment through the Stripe webhook before the real full scan results are released.
