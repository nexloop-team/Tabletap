import "@/styles/landing.css";

/**
 * Placeholder while a venue page streams in. The venue's colour isn't known
 * yet, so it uses neutral greys on the default (white) page.
 */
export default function Loading() {
  return (
    <main className="page-wrapper skeleton" aria-busy="true" aria-label="Loading">
      <div className="skeleton-cover" />
      <div className="skeleton-head">
        <div className="skeleton-logo" />
        <div className="skeleton-lines">
          <div />
          <div />
        </div>
      </div>
      <div className="skeleton-cards">
        <div />
        <div />
        <div />
        <div />
      </div>
    </main>
  );
}
