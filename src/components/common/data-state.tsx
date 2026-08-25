'use client';

import type { ReactNode } from 'react';


export interface DataStateProps<T> {
 
  loading?: boolean;
  error?: string | null;
  data?: T | null;
  isEmpty?: (data: T) => boolean;
  idleFallback?: ReactNode;
  loadingFallback?: ReactNode;
  emptyFallback?: ReactNode;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}

export function DataState<T>({
  loading = false,
  error = null,
  data,
  isEmpty,
  idleFallback = null,
  loadingFallback,
  emptyFallback = null,
  onRetry,
  children,
}: DataStateProps<T>) {
  if (loading) {
    return (
      
      <div role="status" aria-live="polite" className="text-sm opacity-70">
        {loadingFallback ?? 'Loading…'}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950">
        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-red-400 px-3 py-1.5 text-sm text-red-900 transition-colors hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-600 dark:border-red-800 dark:text-red-100 dark:hover:bg-red-900"
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (data === null || data === undefined) return <>{idleFallback}</>;
  if (isEmpty?.(data)) return <>{emptyFallback}</>;

  return <>{children(data)}</>;
}
