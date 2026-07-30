import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "../../../lib/auth";
import { isDeepSearchUnlocked } from "../../../lib/db";
import { hashIdentity, isRateLimited } from "../../../lib/security";

function isClerkEnabled() {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  return clerkKey.startsWith("pk_") && !clerkKey.includes("replace_me");
}

export async function GET(request: NextRequest) {
  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  // With auth enabled, only report the signed-in user's own unlock status so
  // this endpoint cannot be used to probe whether an arbitrary email has paid.
  if (isClerkEnabled()) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ unlocked: false });
    return NextResponse.json({ unlocked: await isDeepSearchUnlocked(hashIdentity(`user:${userId}`)) });
  }

  const identity = request.nextUrl.searchParams.get("identity") || "";
  if (!identity) {
    return NextResponse.json({ unlocked: false });
  }

  return NextResponse.json({ unlocked: await isDeepSearchUnlocked(hashIdentity(identity)) });
}
