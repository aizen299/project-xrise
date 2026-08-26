import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Loading tickets…</span>
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="surface flex flex-col gap-px overflow-hidden rounded-xl">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-none" />
        ))}
      </div>
    </div>
  );
}
