/** Grey outline of a dashboard page while the real one loads, so a slow connection never shows a blank screen. */
export default function Loading() {
  return (
    <div className="dash-skeleton" aria-busy="true" aria-label="Loading">
      <div className="dash-skeleton-title" />
      <div className="dash-skeleton-line" />
      <div className="dash-skeleton-tiles">
        <div />
        <div />
        <div />
        <div />
      </div>
      <div className="dash-skeleton-card" />
      <div className="dash-skeleton-card short" />
    </div>
  );
}
