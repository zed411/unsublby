import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/privacy" }
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <p className="eyebrow">Unsubly</p>
        <a className="back-link" href="/">
          Back to Unsubly
        </a>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: May 27, 2026</p>

        <h2>What Unsubly Does</h2>
        <p>
          Unsubly helps signed-in users find subscriptions, newsletters, and notification emails in accounts they connect
          with permission.
        </p>

        <h2>Information We Access</h2>
        <p>
          When you connect Gmail, Unsubly requests read-only Gmail access. This lets the app inspect message metadata,
          headers, snippets, sender details, subjects, and unsubscribe signals. Unsubly does not request permission to
          send email, delete email, or modify your mailbox.
        </p>

        <h2>How We Use Information</h2>
        <p>
          We use connected email data only to identify likely subscriptions, newsletters, account alerts, receipts,
          renewal reminders, and unsubscribe links. We use payment information only to unlock paid features.
        </p>

        <h2>Google User Data</h2>
        <p>
          Unsubly's use and transfer of information received from Google APIs will adhere to the Google API Services
          User Data Policy, including the Limited Use requirements.
        </p>

        <h2>Data Storage</h2>
        <p>
          Account connection records and paid unlock records are stored so the app can remember connected accounts and
          purchase status. For production launch, Unsubly should use a hosted database with encryption and access
          controls.
        </p>

        <h2>Your Choices</h2>
        <p>
          You can disconnect Gmail inside Unsubly. You can also revoke Google access from your Google Account security
          settings at any time.
        </p>

        <h2>Contact</h2>
        <p>For privacy questions, contact the Unsubly support email listed in the app's Google OAuth consent screen.</p>
      </section>
    </main>
  );
}
