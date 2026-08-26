import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/theme-toggle';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="glass-strong sticky top-0 z-40">
        <nav
          aria-label="Main"
          className="mx-auto flex w-full max-w-3xl items-center gap-3 px-6 py-3"
        >
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:ring-ring/60 focus-visible:ring-[3px] focus-visible:outline-none"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              <LifeBuoy className="size-4" />
            </span>
            XRise Helpdesk
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href="/status">Check a ticket</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Agent sign in</Link>
            </Button>
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">{children}</main>

      <footer className="mx-auto w-full max-w-3xl px-6 pb-10">
        <p className="text-xs text-muted-foreground">
          XRise Helpdesk · support requests are answered by a human agent.
        </p>
      </footer>
    </div>
  );
}
