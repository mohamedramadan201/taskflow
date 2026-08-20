export default function BoardLoading() {
  return <main className="route-loading" aria-busy="true" aria-live="polite"><div className="loading-spinner" aria-hidden="true" /><strong>Loading task board</strong><span>Preparing your workspace…</span></main>;
}
