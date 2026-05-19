import { UnsublyApp } from "../components/unsubly-app";
import { isDeepSearchUnlocked } from "../lib/db";
import { hashIdentity } from "../lib/security";
import { verifyAndFulfillCheckoutSession } from "../lib/stripe-checkout";

export default async function Home({
  searchParams
}: {
  searchParams: Promise<{ demo?: string; identity?: string; payment?: string; session_id?: string }>;
}) {
  const params = await searchParams;
  const identity = params.identity || "";
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  const clerkEnabled = clerkKey.startsWith("pk_") && !clerkKey.includes("replace_me");
  if (params.payment === "success" && params.session_id) {
    await verifyAndFulfillCheckoutSession(params.session_id);
  }

  const isPaid = identity ? isDeepSearchUnlocked(hashIdentity(identity)) : false;
  const paymentSuccess = params.payment === "success";

  return (
    <UnsublyApp
      initialDemoMode={params.demo === "1"}
      initialIdentity={identity}
      initialPaid={isPaid}
      initialPaymentPending={paymentSuccess && !isPaid}
      authEnabled={clerkEnabled}
    />
  );
}
