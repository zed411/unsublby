import { markDeepSearchUnlocked } from "./db";
import { getAppUrl, hashIdentity, sanitizeReferenceId } from "./security";

type CheckoutInput = {
  identity: unknown;
  unlockSubject?: string;
  includeIdentityInSuccess?: boolean;
};

function normalizeCheckoutInput(input: unknown | CheckoutInput) {
  if (typeof input === "object" && input !== null && "identity" in input) {
    const checkoutInput = input as CheckoutInput;
    return {
      identityValue: sanitizeReferenceId(checkoutInput.identity),
      unlockSubject: checkoutInput.unlockSubject || sanitizeReferenceId(checkoutInput.identity),
      includeIdentityInSuccess: checkoutInput.includeIdentityInSuccess ?? true
    };
  }

  const identityValue = sanitizeReferenceId(input);
  return { identityValue, unlockSubject: identityValue, includeIdentityInSuccess: true };
}

export async function createCheckoutSession(input: unknown | CheckoutInput) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const priceId = process.env.STRIPE_PRICE_ID?.trim();

  if (!secretKey || !priceId) {
    return {
      ok: false,
      status: 501,
      body: {
        error: "Stripe is not configured on this server yet.",
        nextStep: "Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID in your environment."
      }
    } as const;
  }

  if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_")) {
    return {
      ok: false,
      status: 400,
      body: { error: "STRIPE_SECRET_KEY must start with sk_test_ or sk_live_." }
    } as const;
  }

  if (!priceId.startsWith("price_")) {
    return {
      ok: false,
      status: 400,
      body: { error: "STRIPE_PRICE_ID must start with price_. Do not use the prod_ product ID." }
    } as const;
  }

  const appUrl = getAppUrl();
  const { identityValue, unlockSubject, includeIdentityInSuccess } = normalizeCheckoutInput(input);
  const identityHash = hashIdentity(unlockSubject);
  const successParams = new URLSearchParams({
    payment: "success",
    session_id: "{CHECKOUT_SESSION_ID}"
  });

  if (includeIdentityInSuccess) {
    successParams.set("identity", identityValue);
  }

  const form = new URLSearchParams({
    mode: "payment",
    success_url: `${appUrl}/?${successParams.toString()}#scan`,
    cancel_url: `${appUrl}/?payment=cancelled#scan`,
    client_reference_id: identityHash,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    "metadata[product]": "unsubly_deep_search",
    "metadata[identity_hash]": identityHash,
    "metadata[identity_hint]": identityValue
  });

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
      headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form
  });
  const session = await stripeResponse.json();

  if (!stripeResponse.ok || !session.url) {
    return {
      ok: false,
      status: 502,
      body: {
        error: session.error?.message || "Stripe checkout could not be created."
      }
    } as const;
  }

  return { ok: true, status: 200, body: { url: session.url as string } } as const;
}

export async function verifyAndFulfillCheckoutSession(sessionId: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!sessionId || !secretKey) return false;

  const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`
    }
  });

  if (!stripeResponse.ok) return false;

  const session = await stripeResponse.json();
  const metadata = session.metadata || {};

  if (
    session.payment_status === "paid" &&
    metadata.product === "unsubly_deep_search" &&
    metadata.identity_hash &&
    metadata.identity_hint
  ) {
    await markDeepSearchUnlocked(metadata.identity_hash, metadata.identity_hint, session.id);
    return true;
  }

  return false;
}
