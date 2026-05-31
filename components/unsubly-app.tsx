"use client";

import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { createFullList, createPreviewList, type Subscription } from "../lib/subscriptions";

type Filter = "all" | "ready" | "paid" | "notifications" | "removed";

function ClerkAccountControls() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) return null;

  if (isSignedIn) return <UserButton />;

  return null;
}

function getStatusLabel(subscription: Subscription) {
  if (subscription.status === "removed") return "Removed";
  if (subscription.status === "needs-login") return "Needs login";
  return "One-click";
}

function getStatusClass(subscription: Subscription) {
  if (subscription.status === "removed") return "removed";
  if (subscription.status === "needs-login") return "needs-login";
  return "ready";
}

export function UnsublyApp({
  initialDemoMode = false,
  initialIdentity = "",
  initialPaid = false,
  initialPaymentPending = false,
  authEnabled = false,
  signedInEmail = "",
  isSignedIn = false,
  gmailConnected = false
}: {
  initialDemoMode?: boolean;
  initialIdentity?: string;
  initialPaid?: boolean;
  initialPaymentPending?: boolean;
  authEnabled?: boolean;
  signedInEmail?: string;
  isSignedIn?: boolean;
  gmailConnected?: boolean;
}) {
  const startingIdentity = authEnabled
    ? signedInEmail
    : initialIdentity || (initialPaid ? "paid-user@example.com" : initialDemoMode ? "demo@example.com" : "");
  const [identity, setIdentity] = useState(startingIdentity);
  const [formHint, setFormHint] = useState(
    initialPaid
      ? "Payment complete. Full Deep Search results unlocked."
      : initialPaymentPending
        ? "Payment received. Waiting for Stripe webhook confirmation, then refresh this page."
        : gmailConnected
          ? "Gmail connected. Start a free scan when you're ready."
          : "No scan has run yet."
  );
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(
    initialPaid ? createFullList() : startingIdentity ? createPreviewList() : []
  );
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState("");
  const [deepSearchUnlocked, setDeepSearchUnlocked] = useState(initialPaid);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const canRunRealScan = !authEnabled || isSignedIn;
  const canScanConnectedEmail = canRunRealScan && gmailConnected;
  const activeIdentity = authEnabled ? signedInEmail : identity;

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((subscription) => {
      if (activeFilter === "all") return subscription.status !== "removed";
      if (activeFilter === "ready") return subscription.status === "ready";
      if (activeFilter === "removed") return subscription.status === "removed";
      if (activeFilter === "paid") return subscription.category === "Paid" && subscription.status !== "removed";
      if (activeFilter === "notifications") {
        return subscription.category === "Notifications" && subscription.status !== "removed";
      }
      return true;
    });
  }, [activeFilter, subscriptions]);

  const selectedSubscription = subscriptions.find((subscription) => subscription.id === selectedSubscriptionId);
  const found = subscriptions.length;
  const ready = subscriptions.filter((item) => item.status === "ready").length;
  const saved = subscriptions.filter((item) => item.saved).length;
  const removed = subscriptions.filter((item) => item.status === "removed").length;

  function applyScanResults(value: string, results: Subscription[], hint: string) {
    setIdentity(value.trim());
    setSubscriptions(results);
    setSelectedSubscriptionId("");
    setDeepSearchUnlocked(false);
    setActiveFilter("all");
    setFormHint(hint);
  }

  async function handleScan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRunRealScan && !initialDemoMode) {
      setFormHint("Sign in with the email you want to check, then start the free scan.");
      return;
    }

    if (authEnabled && !gmailConnected && !initialDemoMode) {
      setFormHint("Connect Gmail first so Unsubly can scan only your verified mailbox.");
      return;
    }

    const scanValue = initialDemoMode && !activeIdentity ? "demo@example.com" : activeIdentity;

    if (scanValue.trim().length < 5) {
      setFormHint("Enter a full email address or phone number to scan.");
      return;
    }

    if (!authEnabled || initialDemoMode) {
      applyScanResults(scanValue, createPreviewList(), "Free scan complete. Review each item before removing it.");
      return;
    }

    setScanBusy(true);
    try {
      const response = await fetch("/api/email/scan", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Email scan failed.");
      applyScanResults(
        scanValue,
        payload.subscriptions,
        payload.usedFallback
          ? "Gmail connected, but no clear subscription signals were found yet. Showing sample results for now."
          : "Gmail scan complete. Review each item before removing it."
      );
    } catch (error) {
      setFormHint(error instanceof Error ? error.message : "Email scan failed.");
    } finally {
      setScanBusy(false);
    }
  }

  function updateSubscription(id: string, updater: (subscription: Subscription) => Subscription) {
    setSubscriptions((current) => current.map((subscription) => (subscription.id === id ? updater(subscription) : subscription)));
  }

  function restoreSubscription(id: string) {
    const original = createFullList().find((subscription) => subscription.id === id);
    if (!original) return;
    updateSubscription(id, (subscription) => ({ ...subscription, status: original.status, saved: false }));
  }

  function bulkRemoveReady() {
    setSubscriptions((current) =>
      current.map((subscription) =>
        subscription.status === "ready" ? { ...subscription, status: "removed", saved: false } : subscription
      )
    );
  }

  async function unlockFullList() {
    if (initialDemoMode) {
      setDeepSearchUnlocked(true);
      setSubscriptions(createFullList());
      setFormHint("Full Deep Search results unlocked.");
      return;
    }

    if (authEnabled && !isSignedIn) {
      setFormHint("Sign in before unlocking the full list.");
      return;
    }

    setCheckoutBusy(true);
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity: activeIdentity })
      });
      const payload = await response.json();
      if (!response.ok || !payload.url) throw new Error(payload.error || "Checkout is not available yet.");
      window.location.href = payload.url;
    } catch (error) {
      setCheckoutBusy(false);
      setFormHint(error instanceof Error ? error.message : "Checkout is not available yet.");
    }
  }

  async function disconnectGmail() {
    setScanBusy(true);
    try {
      await fetch("/api/email/google/disconnect", { method: "POST" });
      window.location.href = "/?email=disconnected#scan";
    } catch {
      setFormHint("Gmail could not be disconnected. Try again.");
      setScanBusy(false);
    }
  }

  function clearDemoData() {
    setIdentity(authEnabled ? signedInEmail : "");
    setFormHint(gmailConnected ? "Gmail connected. Start a free scan when you're ready." : "No scan has run yet.");
    setActiveFilter("all");
    setSubscriptions([]);
    setSelectedSubscriptionId("");
    setDeepSearchUnlocked(false);
    setCheckoutBusy(false);
    setScanBusy(false);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Unsubly navigation">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            U
          </div>
          <div>
            <p className="brand-name">Unsubly</p>
            <p className="brand-tag">Subscription cleanup</p>
          </div>
        </div>

        <nav className="nav-list" aria-label="Main sections">
          <a className="nav-item active" href="#dashboard">
            Dashboard
          </a>
          <a className="nav-item" href="#scan">
            Scan
          </a>
          <a className="nav-item" href="#privacy">
            Privacy
          </a>
          <a className="nav-item" href="/privacy">
            Privacy Policy
          </a>
          <a className="nav-item" href="/terms">
            Terms
          </a>
        </nav>

        <div className="privacy-note">
          <p className="note-title">Private by design</p>
          <p>Unsubly scans connected accounts only after sign-in and explicit permission.</p>
        </div>
      </aside>

      <main className="main-content">
        <section className="topbar" aria-label="Overview">
          <div>
            <h1>Find subscriptions, newsletters, and notification lists in one place.</h1>
          </div>
          <div className="topbar-actions">
            {authEnabled ? (
              <ClerkAccountControls />
            ) : (
              <button className="ghost-button" type="button" disabled>
                Add Clerk Keys
              </button>
            )}
            <button className="ghost-button" type="button" onClick={clearDemoData}>
              Clear Results
            </button>
          </div>
        </section>

        {!authEnabled && (
          <section className="account-panel" aria-label="Account setup needed">
            <div>
              <p className="eyebrow">Account setup</p>
              <h2>Add Clerk keys to turn on login.</h2>
              <p>Once Clerk keys are in `.env.local`, users can sign in and paid access can be tied to accounts.</p>
            </div>
          </section>
        )}

        <section className="scan-panel" id="scan" aria-labelledby="scanTitle">
          <div className="scan-copy">
            <h2 id="scanTitle">{authEnabled ? "Start your free scan" : "Start a scan"}</h2>
            <p>
              {authEnabled
                ? "Sign in, connect Gmail with read-only permission, then Unsubly scans that verified mailbox for subscriptions and notifications."
                : "Enter an email or phone number to preview how Unsubly would organize subscriptions. Sample results are used until account connections are enabled."}
            </p>
          </div>

          <form className="scan-form" onSubmit={handleScan}>
            {authEnabled ? (
              <>
                <label>{gmailConnected ? "Connected email" : "Email connection"}</label>
                <div className="input-row verified-scan-row">
                  {(canRunRealScan || initialDemoMode) && <div className="verified-email-box">{activeIdentity || "demo@example.com"}</div>}
                  {!canRunRealScan && !initialDemoMode ? (
                    <SignInButton mode="modal">
                      <button type="button">Sign In To Scan</button>
                    </SignInButton>
                  ) : !gmailConnected && !initialDemoMode ? (
                    <a className="connect-button" href="/api/email/google/start">
                      Connect Gmail
                    </a>
                  ) : (
                    <>
                      <button type="submit" disabled={scanBusy}>
                        {scanBusy ? "Scanning..." : canScanConnectedEmail ? "Start Free Scan" : "Start Sample Scan"}
                      </button>
                      {gmailConnected && (
                        <button className="quiet-button" type="button" onClick={disconnectGmail}>
                          Disconnect
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <label htmlFor="identityInput">Email or phone number</label>
                <div className="input-row">
                  <input
                    id="identityInput"
                    name="identity"
                    type="text"
                    placeholder="you@example.com or +61 4..."
                    autoComplete="email"
                    required
                    value={identity}
                    onChange={(event) => setIdentity(event.target.value)}
                  />
                  <button type="submit">Scan</button>
                </div>
              </>
            )}
            <p className="form-hint">{formHint}</p>
          </form>
        </section>

        <section className="stats-grid" id="dashboard" aria-label="Scan summary">
          <article className="stat-card">
            <span className="stat-label">Found</span>
            <strong>{found}</strong>
            <span className="stat-help">Subscriptions and accounts</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">Ready</span>
            <strong>{ready}</strong>
            <span className="stat-help">One-click unsubscribe</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">Saved</span>
            <strong>{saved}</strong>
            <span className="stat-help">Kept on your list</span>
          </article>
          <article className="stat-card">
            <span className="stat-label">Removed</span>
            <strong>{removed}</strong>
            <span className="stat-help">Marked unsubscribed</span>
          </article>
        </section>

        <section className="workspace">
          <div className="filters" aria-label="Filter subscriptions">
            {(["all", "ready", "paid", "notifications", "removed"] as Filter[]).map((filter) => (
              <button
                className={`filter-chip ${activeFilter === filter ? "active" : ""}`}
                type="button"
                key={filter}
                onClick={() => setActiveFilter(filter)}
              >
                {filter === "ready" ? "One-click" : filter[0].toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          <div className="results-header">
            <div>
              <h2>Subscriptions</h2>
              <p>
                {subscriptions.length
                  ? `Showing ${filteredSubscriptions.length} item${filteredSubscriptions.length === 1 ? "" : "s"} for ${activeIdentity || identity}.`
                  : "Run a scan to see what Unsubly finds."}
              </p>
            </div>
            <button className="secondary-button" type="button" disabled={ready === 0} onClick={bulkRemoveReady}>
              Unsubscribe Ready Items
            </button>
          </div>

          {!subscriptions.length && (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden="true">
                U
              </div>
              <h3>Your cleanup list is waiting.</h3>
              <p>Start with your email or phone number, then review each result before removing anything.</p>
            </div>
          )}

          <div className="subscription-list" aria-live="polite">
            {filteredSubscriptions.map((subscription) => {
              const canUnsubscribe = subscription.status === "ready";
              const isRemoved = subscription.status === "removed";

              return (
                <article className="subscription-card" data-id={subscription.id} key={subscription.id}>
                  <div className="subscription-main">
                    <div className="subscription-title">
                      <strong>{subscription.name}</strong>
                      <a
                        className="subscription-link"
                        href={`#details-${subscription.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          setSelectedSubscriptionId(subscription.id);
                        }}
                      >
                        View link
                      </a>
                      <span className={`badge ${getStatusClass(subscription)}`}>{getStatusLabel(subscription)}</span>
                    </div>
                    <div className="subscription-meta">
                      <span>{subscription.category}</span>
                      <span>{subscription.source}</span>
                      <span>Last seen {subscription.lastSeen}</span>
                      <span>{subscription.confidence}% match</span>
                    </div>
                    <p className="subscription-meta">{subscription.action}</p>
                  </div>
                  <div className="card-actions">
                    {isRemoved ? (
                      <button type="button" onClick={() => restoreSubscription(subscription.id)}>
                        Restore
                      </button>
                    ) : (
                      <>
                        <button
                          className="primary-action"
                          type="button"
                          onClick={() =>
                            canUnsubscribe
                              ? updateSubscription(subscription.id, (item) => ({ ...item, status: "removed", saved: false }))
                              : updateSubscription(subscription.id, (item) => ({
                                  ...item,
                                  action: "Account page opened in a real integration. Login is still required."
                                }))
                          }
                        >
                          {canUnsubscribe ? "Unsubscribe" : "Open Account"}
                        </button>
                        <button type="button" onClick={() => updateSubscription(subscription.id, (item) => ({ ...item, saved: !item.saved }))}>
                          {subscription.saved ? "Kept" : "Keep"}
                        </button>
                        <button
                          className="danger-action"
                          type="button"
                          onClick={() => updateSubscription(subscription.id, (item) => ({ ...item, status: "removed", saved: false }))}
                        >
                          Not Mine
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {!!subscriptions.length && (
            <aside className={`deep-search-panel ${deepSearchUnlocked ? "unlocked" : ""}`} aria-labelledby="deepSearchTitle">
              <div className="deep-search-copy">
                <p className="eyebrow">Deep Search</p>
                <h2 id="deepSearchTitle">{deepSearchUnlocked ? "Deep Search unlocked" : "Deep Search found more results"}</h2>
                <p>
                  {deepSearchUnlocked
                    ? "Full list available. Every subscription, account, and notification Unsubly can find is now in your cleanup list."
                    : "Unlock the full list of every subscription, account, and notification Unsubly can find for $0.99."}
                </p>
              </div>
              {initialDemoMode || deepSearchUnlocked ? (
                <button className="unlock-button" type="button" disabled={deepSearchUnlocked || checkoutBusy} onClick={unlockFullList}>
                  {deepSearchUnlocked ? "Full List Active" : checkoutBusy ? "Opening Checkout..." : "Unlock Full List - $0.99"}
                </button>
              ) : authEnabled && !isSignedIn ? (
                <SignInButton mode="modal">
                  <button className="unlock-button" type="button">
                    Sign In To Unlock
                  </button>
                </SignInButton>
              ) : (
                <a className="unlock-button" href="/api/create-checkout-session">
                  Unlock Full List - $0.99
                </a>
              )}
            </aside>
          )}

          {selectedSubscription && (
            <aside className="detail-panel" id={`details-${selectedSubscription.id}`} aria-labelledby="detailTitle">
              <div>
                <p className="eyebrow">Subscription details</p>
                <h2 id="detailTitle">{selectedSubscription.name}</h2>
              </div>
              <div className="detail-grid">
                <div>
                  <span>What it looks like</span>
                  <strong>{selectedSubscription.plan}</strong>
                </div>
                <div>
                  <span>Found from</span>
                  <strong>{selectedSubscription.foundBy}</strong>
                </div>
                <div>
                  <span>Original link</span>
                  <a href={selectedSubscription.link} target="_blank" rel="noreferrer">
                    {selectedSubscription.link}
                  </a>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{getStatusLabel(selectedSubscription)}</strong>
                </div>
              </div>
              <button className="ghost-button" type="button" onClick={() => setSelectedSubscriptionId("")}>
                Close Details
              </button>
            </aside>
          )}
        </section>

        <section className="privacy-panel" id="privacy" aria-labelledby="privacyTitle">
          <div>
            <p className="eyebrow">How the real app should work</p>
            <h2 id="privacyTitle">Permission first, deletion second.</h2>
          </div>
          <div className="privacy-grid">
            <article>
              <h3>Connect accounts</h3>
              <p>Use Gmail, Outlook, or SMS permissions instead of searching by someone else's contact details.</p>
            </article>
            <article>
              <h3>Review before action</h3>
              <p>Show the source email, sender, and link type so users decide what gets removed.</p>
            </article>
            <article>
              <h3>Track status</h3>
              <p>Mark each item as kept, removed, needs login, or failed so cleanup is clear.</p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
