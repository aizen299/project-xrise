'use client';

import { useEffect, useEffectEvent } from 'react';

export function useTicketStream(ticketId: string, onChange: () => void) {
  const notify = useEffectEvent(onChange);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;

    let source: EventSource | null = null;
    let reopen: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const open = () => {
      if (disposed) return;
      source = new EventSource(`/api/tickets/${ticketId}/stream`);

      source.addEventListener('timeline', () => notify());

      source.addEventListener('bye', () => {
        source?.close();
        reopen = setTimeout(open, 250);
      });

      source.onerror = () => {
        source?.close();
        if (!disposed) reopen = setTimeout(open, 5_000);
      };
    };

    open();

    return () => {
      disposed = true;
      if (reopen) clearTimeout(reopen);
      source?.close();
    };
  }, [ticketId]);
}
