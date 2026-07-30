import { auth } from "@clerk/nextjs/server";

// auth() throws when Clerk middleware is not active (e.g. keys not configured
// in local demo mode). Treat that as signed out instead of crashing the route.
export async function getAuthUserId() {
  try {
    const { userId } = await auth();
    return userId;
  } catch {
    return null;
  }
}
