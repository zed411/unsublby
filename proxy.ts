import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
const clerkEnabled = clerkKey.startsWith("pk_") && !clerkKey.includes("replace_me");

const activeClerkMiddleware = clerkMiddleware();

export default function proxy(request: NextRequest) {
  if (!clerkEnabled) {
    return NextResponse.next();
  }

  return activeClerkMiddleware(request, {} as never);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)"
  ]
};
