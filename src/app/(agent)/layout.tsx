import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LifeBuoy } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { SignOutButton } from './sign-out-button';

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="glass-strong sticky top-0 z-40">
        <nav
          aria-label="Agent"
          className="mx-auto flex w-full max-w-6xl items-center gap-3 px-6 py-3"
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:ring-ring/60 focus-visible:ring-[3px] focus-visible:outline-none"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              <LifeBuoy className="size-4" />
            </span>
            XRise Helpdesk
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-sm text-muted-foreground">{session.name}</span>
              <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-primary">
                {session.role}
              </span>
            </div>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
