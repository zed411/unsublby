import { NextResponse } from "next/server";
import { getAuthUserId } from "../../../../../lib/auth";
import { createGoogleAuthUrl, isGoogleEmailConfigured } from "../../../../../lib/email-providers";
import { getAppUrl } from "../../../../../lib/security";

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.redirect(`${getAppUrl()}/sign-in`, 303);

  if (!isGoogleEmailConfigured()) {
    return NextResponse.json(
      {
        error: "Gmail connection is not configured yet.",
        nextStep: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment."
      },
      { status: 501 }
    );
  }

  return NextResponse.redirect(createGoogleAuthUrl(userId), 303);
}
