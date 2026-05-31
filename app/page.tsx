import { currentUser } from "@clerk/nextjs/server";
import { UnsublyApp } from "../components/unsubly-app";
import { hasEmailConnection, isDeepSearchUnlocked } from "../lib/db";
import { hashIdentity } from "../lib/security";
import { verifyAndFulfillCheckoutSession } from "../lib/stripe-checkout";

export default async function Home({
  searchParams
}: {
  searchParams: Promise<{ demo?: string; identity?: string; payment?: string; session_id?: string }>;
}) {
  const params = await searchParams;
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  const clerkEnabled = clerkKey.startsWith("pk_") && !clerkKey.includes("replace_me");

  if (params.payment === "success" && params.session_id) {
    await verifyAndFulfillCheckoutSession(params.session_id);
  }

  const user = clerkEnabled ? await currentUser() : null;
  const userId = user?.id || "";
  const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses[0]?.emailAddress || "";
  const identity = clerkEnabled ? userEmail : params.identity || "";
  const unlockSubject = clerkEnabled && userId ? `user:${userId}` : identity;
  const isPaid = unlockSubject ? await isDeepSearchUnlocked(hashIdentity(unlockSubject)) : false;
  const gmailConnected = userId ? await hasEmailConnection(userId, "google") : false;
  const paymentSuccess = params.payment === "success";

  return (
    <UnsublyApp
      initialDemoMode={params.demo === "1"}
      initialIdentity={identity}
      initialPaid={isPaid}
      initialPaymentPending={paymentSuccess && !isPaid}
      authEnabled={clerkEnabled}
      signedInEmail={userEmail}
      isSignedIn={Boolean(userId)}
      gmailConnected={gmailConnected}
    />
  );
}
