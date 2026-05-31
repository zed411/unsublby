import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getEmailConnection, saveEmailConnection } from "../../../../lib/db";
import { refreshGoogleAccessToken, scanGmail } from "../../../../lib/email-providers";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in before scanning." }, { status: 401 });

  const connection = await getEmailConnection(userId, "google");
  if (!connection) {
    return NextResponse.json({ error: "Connect Gmail before starting a real scan." }, { status: 409 });
  }

  try {
    let accessToken = connection.access_token;
    if (connection.expires_at < Date.now() + 60_000 && connection.refresh_token) {
      const refreshed = await refreshGoogleAccessToken(connection.refresh_token);
      accessToken = refreshed.accessToken;
      await saveEmailConnection({
        userId,
        provider: "google",
        email: connection.email,
        accessToken,
        refreshToken: connection.refresh_token,
        expiresAt: refreshed.expiresAt
      });
    }

    const subscriptions = await scanGmail(accessToken);
    return NextResponse.json({
      source: "gmail",
      subscriptions: subscriptions.slice(0, 6),
      empty: subscriptions.length === 0
    });
  } catch (error) {
    console.error("Gmail scan failed", error);
    return NextResponse.json({ error: "Gmail scan failed. Reconnect Gmail and try again." }, { status: 502 });
  }
}
