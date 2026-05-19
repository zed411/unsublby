import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "../../../lib/stripe-checkout";
import { isAllowedOrigin, isRateLimited } from "../../../lib/security";

async function handleCheckout(request: NextRequest, identity: string | undefined) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Origin is not allowed." }, { status: 403 });
  }

  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  try {
    const session = await createCheckoutSession(identity);
    if (session.ok && "url" in session.body) {
      const acceptsHtml = request.headers.get("accept")?.includes("text/html");
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
