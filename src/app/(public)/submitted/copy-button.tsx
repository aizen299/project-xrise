'use client';

import { useState } from 'react';

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard access can be denied; the id is on screen to copy manually.
setCopied(false);
        }
      }}
      className="rounded-md border border-black/15 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-white/20 dark:hover:bg-white/10"
    >
      {copied ? 'Copied' : 'Copy'}
      <span className="sr-only"> ticket ID</span>
    </button>
  );
}
