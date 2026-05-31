import { NextRequest, NextResponse } from "next/server";
import { markDeepSearchUnlocked } from "../../../lib/db";
import { verifyStripeSignature } from "../../../lib/security";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!verifyStripeSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  let event: {
    type?: string;
    data?: { object?: { id?: string; metadata?: Record<string, string>; client_reference_id?: string } };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" && event.data?.object?.metadata?.product === "unsubly_deep_search") {
    const identityHash = event.data.object.metadata.identity_hash;
    const identityHint = event.data.object.metadata.identity_hint || "paid-user";
    const stripeSessionId = event.data.object.id || event.data.object.client_reference_id || identityHash;

    if (identityHash) {
      await markDeepSearchUnlocked(identityHash, identityHint, stripeSessionId);
    }
  }

  return NextResponse.json({ received: true });
}
