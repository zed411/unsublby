import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "../../../../../lib/auth";
import { saveEmailConnection } from "../../../../../lib/db";
import { exchangeGoogleCode, getGoogleProfile, verifyGoogleState } from "../../../../../lib/email-providers";
import { getAppUrl } from "../../../../../lib/security";

export async function GET(request: NextRequest) {
  const userId = await getAuthUserId();
  const appUrl = getAppUrl();
  if (!userId) return NextResponse.redirect(`${appUrl}/sign-in`, 303);

  const code = request.nextUrl.searchParams.get("code") || "";
  const state = request.nextUrl.searchParams.get("state") || "";
  const error = request.nextUrl.searchParams.get("error");

  if (error) return NextResponse.redirect(`${appUrl}/?email=cancelled#scan`, 303);
  if (!code || !verifyGoogleState(state, userId)) return NextResponse.redirect(`${appUrl}/?email=failed#scan`, 303);

  try {
    const token = await exchangeGoogleCode(code);
    const email = await getGoogleProfile(token.accessToken);
    await saveEmailConnection({
      userId,
      provider: "google",
      email,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt
    });

    return NextResponse.redirect(`${appUrl}/?email=connected#scan`, 303);
  } catch (callbackError) {
    console.error("Google email callback failed", callbackError);
    return NextResponse.redirect(`${appUrl}/?email=failed#scan`, 303);
  }
}
