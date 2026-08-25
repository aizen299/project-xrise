import Link from 'next/link';

export function Pagination({
  page,
  totalPages,
  total,
  searchParams,
}: {
  page: number;
  totalPages: number;
  total: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  function hrefFor(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === 'string' && value && key !== 'page') params.set(key, value);
    }
    params.set('page', String(target));
    return `/dashboard?${params.toString()}`;
  }

  const linkStyle =
    'rounded-md border border-black/15 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-white/20 dark:hover:bg-white/10';
  const disabledStyle =
    'rounded-md border border-black/10 px-3 py-1.5 text-sm opacity-40 dark:border-white/10';

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-3">
      <p className="text-sm opacity-70">
        Page {page} of {totalPages} · {total} {total === 1 ? 'ticket' : 'tickets'}
      </p>
      <div className="ml-auto flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={linkStyle} rel="prev">
            Previous
          </Link>
        ) : (
          <span className={disabledStyle} aria-disabled="true">Previous</span>
        )}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className={linkStyle} rel="next">
            Next
          </Link>
        ) : (
          <span className={disabledStyle} aria-disabled="true">Next</span>
        )}
      </div>
    </nav>
  );
}
