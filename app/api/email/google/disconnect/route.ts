import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { deleteEmailConnection } from "../../../../../lib/db";
import { getAppUrl } from "../../../../../lib/security";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in before disconnecting Gmail." }, { status: 401 });

  await deleteEmailConnection(userId, "google");
  return NextResponse.redirect(`${getAppUrl()}/?email=disconnected#scan`, 303);
}
