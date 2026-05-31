# Live Test Steps

Use this after uploading the latest files to GitHub and redeploying Vercel.

## 1. Check Readiness

Open:

```text
https://www.unsubly.online/api/readiness
```

You want:

```json
{
  "ready": true,
  "storage": "postgres"
}
```

If `ready` is false, the missing item will show under `checks`.

## 2. Test Gmail

Open:

```text
https://www.unsubly.online
```

Then:

- Sign in.
- Click `Connect Gmail`.
- Approve access with a Google test user.
- Confirm the URL returns with `?email=connected#scan`.
- Click `Start Free Scan`.

## 3. Test Payment

- Click `Unlock Full List - $0.99`.
- Complete Stripe test checkout.
- Confirm the URL returns with `payment=success`.
- Confirm the full list unlocks.

## 4. Test Disconnect

- Click `Disconnect`.
- Confirm the Gmail connection is removed.

## If Gmail Blocks Access

In Google Cloud OAuth consent screen, add the Gmail account under test users. Public users will require Google app verification.
