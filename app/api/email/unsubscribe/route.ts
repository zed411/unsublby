import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "../../../../lib/auth";
import { getFreshAccessToken } from "../../../../lib/email-access";
import { getUnsubscribeTargetForMessage } from "../../../../lib/email-providers";
import { isAllowedOrigin, isRateLimited } from "../../../../lib/security";

const PRIVATE_HOST_PATTERN =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[::1\]|172\.(1[6-9]|2\d|3[01])\.)/i;

function isSafeUnsubscribeUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.port && url.port !== "80" && url.port !== "443") return false;
    if (PRIVATE_HOST_PATTERN.test(url.hostname) || url.hostname.endsWith(".local") || !url.hostname.includes(".")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Origin is not allowed." }, { status: 403 });
  }

  if (isRateLimited(request, 60)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: "Sign in before unsubscribing." }, { status: 401 });

  let payload: { messageId?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const messageId = String(payload.messageId || "").trim();
  if (!messageId || !/^[A-Za-z0-9_-]{1,64}$/.test(messageId)) {
    return NextResponse.json({ error: "Invalid message id." }, { status: 400 });
  }

  const accessToken = await getFreshAccessToken(userId);
  if (!accessToken) {
    return NextResponse.json({ error: "Connect Gmail before unsubscribing." }, { status: 409 });
  }

  try {
    const target = await getUnsubscribeTargetForMessage(accessToken, messageId);
    if (!target || !isSafeUnsubscribeUrl(target.url)) {
      return NextResponse.json({ error: "No usable unsubscribe link was found for this email." }, { status: 404 });
    }

    if (!target.oneClick) {
      return NextResponse.json({ method: "link", url: target.url });
    }

    // RFC 8058 one-click unsubscribe: a single POST, no confirmation page needed.
    const response = await fetch(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      return NextResponse.json({ method: "link", url: target.url });
    }

    return NextResponse.json({ method: "one-click" });
  } catch (error) {
    console.error("Unsubscribe request failed", error);
    return NextResponse.json({ error: "The unsubscribe request failed. Open the link manually instead." }, { status: 502 });
  }
}
