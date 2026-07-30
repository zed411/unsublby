import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "../../../../lib/auth";
import { isDeepSearchUnlocked } from "../../../../lib/db";
import { getFreshAccessToken } from "../../../../lib/email-access";
import { scanGmail } from "../../../../lib/email-providers";
import { hashIdentity, isAllowedOrigin, isRateLimited } from "../../../../lib/security";

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Origin is not allowed." }, { status: 403 });
  }

  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: "Sign in before scanning." }, { status: 401 });

  try {
    const accessToken = await getFreshAccessToken(userId);
    if (!accessToken) {
      return NextResponse.json({ error: "Connect Gmail before starting a real scan." }, { status: 409 });
    }

    const fullScanUnlocked = await isDeepSearchUnlocked(hashIdentity(`user:${userId}`));
    const subscriptions = await scanGmail(accessToken, fullScanUnlocked ? 50 : 12);
    return NextResponse.json({
      source: "gmail",
      subscriptions: fullScanUnlocked ? subscriptions : subscriptions.slice(0, 6),
      unlocked: fullScanUnlocked,
      totalFound: subscriptions.length,
      empty: subscriptions.length === 0
    });
  } catch (error) {
    console.error("Gmail scan failed", error);
    return NextResponse.json({ error: "Gmail scan failed. Reconnect Gmail and try again." }, { status: 502 });
  }
}
