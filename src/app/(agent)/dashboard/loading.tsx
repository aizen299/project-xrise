export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">Loading tickets…</span>
      <div className="h-8 w-48 animate-pulse rounded bg-black/10 dark:bg-white/10" />
      <div className="h-24 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-14 animate-pulse rounded bg-black/5 dark:bg-white/5" />
      ))}
    </div>
  );
}
