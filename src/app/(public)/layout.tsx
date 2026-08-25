import Link from 'next/link';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-black/10 dark:border-white/15">
        <nav
          aria-label="Main"
          className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3"
        >
          <Link href="/" className="font-semibold tracking-tight">
            XRise Helpdesk
          </Link>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <Link href="/status" className="underline-offset-4 hover:underline">
              Check a ticket
            </Link>
            <Link href="/login" className="underline-offset-4 hover:underline">
              Agent sign in
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
