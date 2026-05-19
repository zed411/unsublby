import { NextRequest, NextResponse } from "next/server";
import { isDeepSearchUnlocked } from "../../../lib/db";
import { hashIdentity } from "../../../lib/security";

export async function GET(request: NextRequest) {
  const identity = request.nextUrl.searchParams.get("identity") || "";

  if (!identity) {
    return NextResponse.json({ unlocked: false });
  }

  return NextResponse.json({ unlocked: isDeepSearchUnlocked(hashIdentity(identity)) });
}
