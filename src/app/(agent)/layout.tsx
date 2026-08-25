import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { SignOutButton } from './sign-out-button';


export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-black/10 dark:border-white/15">
        <nav
          aria-label="Agent"
          className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3"
        >
          <Link href="/dashboard" className="font-semibold tracking-tight">
            XRise Helpdesk
          </Link>
          <span className="ml-auto text-sm opacity-70">
            {session.name}
            <span className="ml-2 rounded-full border border-black/15 px-2 py-0.5 text-xs uppercase tracking-wide dark:border-white/20">
              {session.role}
            </span>
          </span>
          <SignOutButton />
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
