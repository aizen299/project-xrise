'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch('/api/auth/logout', { method: 'POST' });
        router.replace('/login');
        router.refresh();
      }}
      className="rounded-md border border-black/15 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
