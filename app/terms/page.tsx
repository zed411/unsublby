import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  alternates: { canonical: "/terms" }
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <p className="eyebrow">Unsubly</p>
        <a className="back-link" href="/">
          Back to Unsubly
        </a>
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: May 27, 2026</p>

        <h2>Use of Unsubly</h2>
        <p>
          You may use Unsubly only with accounts you own or are authorized to manage. Do not use Unsubly to access or
          scan another person's email account.
        </p>

        <h2>Email Connections</h2>
        <p>
          Gmail connections require your permission through Google. Unsubly uses read-only access to identify likely
          subscriptions and notification emails. You are responsible for reviewing each result before taking action.
        </p>

        <h2>Unsubscribe Actions</h2>
        <p>
          Unsubly may show unsubscribe links or account management pages. Some services require you to sign in directly
          with that provider before changing or cancelling a subscription.
        </p>

        <h2>Payments</h2>
        <p>
          Paid unlocks are processed by Stripe. Prices, refunds, and access terms should be shown clearly before
          payment.
        </p>

        <h2>No Guarantee</h2>
        <p>
          Unsubly may not find every subscription or notification. Results are based on available mailbox signals and
          should be reviewed by the user.
        </p>

        <h2>Changes</h2>
        <p>These terms may be updated as Unsubly adds production features, integrations, and support policies.</p>
      </section>
    </main>
  );
}
