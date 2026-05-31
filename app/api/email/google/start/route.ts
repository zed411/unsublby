import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createGoogleAuthUrl, isGoogleEmailConfigured } from "../../../../../lib/email-providers";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", process.env.APP_URL || "http://127.0.0.1:4174"), 303);

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
