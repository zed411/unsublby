"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <p className="eyebrow">Unsubly</p>
        <h1>Something went wrong</h1>
        <p>An unexpected error stopped this page from loading. Your data and any paid unlock are safe.</p>
        <p>
          <button className="ghost-button" type="button" onClick={reset}>
            Try Again
          </button>
        </p>
        <p>
          <a className="back-link" href="/">
            Back to Unsubly
          </a>
        </p>
      </section>
    </main>
  );
}
