import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "../../../../../lib/auth";
import { deleteEmailConnection } from "../../../../../lib/db";
import { isAllowedOrigin, isRateLimited } from "../../../../../lib/security";

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Origin is not allowed." }, { status: 403 });
  }

  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: "Sign in before disconnecting Gmail." }, { status: 401 });

  await deleteEmailConnection(userId, "google");
  return NextResponse.json({ ok: true });
}
