import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "../../../lib/stripe-checkout";
import { isAllowedOrigin, isRateLimited } from "../../../lib/security";

function isClerkEnabled() {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  return clerkKey.startsWith("pk_") && !clerkKey.includes("replace_me");
}

function redirectToSignIn(request: NextRequest) {
  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("redirect_url", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(signInUrl, 303);
}

async function handleCheckout(request: NextRequest, identity: string | undefined) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Origin is not allowed." }, { status: 403 });
  }

  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  try {
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    let checkoutInput: Parameters<typeof createCheckoutSession>[0] = identity;

    if (isClerkEnabled()) {
      const { userId } = await auth();
      if (!userId) {
        if (acceptsHtml) return redirectToSignIn(request);
        return NextResponse.json({ error: "Sign in before unlocking the full list." }, { status: 401 });
      }

      const user = await currentUser();
      const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses[0]?.emailAddress || userId;
      checkoutInput = {
        identity: email,
        unlockSubject: `user:${userId}`,
        includeIdentityInSuccess: false
      };
    }

    const session = await createCheckoutSession(checkoutInput);
    if (session.ok && "url" in session.body) {
      if (acceptsHtml) {
        return NextResponse.redirect(session.body.url, 303);
      }
    }
    return NextResponse.json(session.body, { status: session.status });
  } catch (error) {
    console.error("Checkout session failed", error);
    const reason = error instanceof Error ? error.message : "Unknown checkout error.";
    return NextResponse.json({ error: `Checkout setup failed: ${reason}` }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    return handleCheckout(request, String(formData.get("identity") || ""));
  }

  let payload: { identity?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  return handleCheckout(request, payload.identity);
}

export async function GET(request: NextRequest) {
  return handleCheckout(request, request.nextUrl.searchParams.get("identity") || "");
}
