import { NextResponse } from "next/server";
import { getStorageMode, testDatabaseConnection } from "../../../lib/db";

function present(value: string | undefined) {
  return Boolean(value?.trim());
}

export async function GET() {
  const database = await testDatabaseConnection();
  const checks = {
    appUrl: present(process.env.APP_URL),
    allowedOrigins: present(process.env.ALLOWED_ORIGINS),
    clerk: present(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) && present(process.env.CLERK_SECRET_KEY),
    stripe:
      present(process.env.STRIPE_SECRET_KEY) &&
      present(process.env.STRIPE_PRICE_ID) &&
      present(process.env.STRIPE_WEBHOOK_SECRET),
    google:
      present(process.env.GOOGLE_CLIENT_ID) &&
      present(process.env.GOOGLE_CLIENT_SECRET) &&
      present(process.env.EMAIL_OAUTH_STATE_SECRET),
    tokenEncryption: present(process.env.EMAIL_TOKEN_ENCRYPTION_KEY),
    database
  };
  const ready = Object.values(checks).every(Boolean);

  return NextResponse.json({
    ready,
    storage: getStorageMode(),
    checks
  });
}
