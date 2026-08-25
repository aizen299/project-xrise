import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { LoginForm } from './login-form';

export const metadata = { title: 'Agent sign in · XRise Helpdesk' };

function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const session = await getSession();
  const { next } = await searchParams;

  if (session) redirect(safeNext(typeof next === 'string' ? next : undefined));

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Agent sign in</h1>
      <p className="mt-2 mb-8 text-sm opacity-70">
        Support agents only.{' '}
        <Link href="/" className="underline underline-offset-4">
          Submit a ticket instead
        </Link>
        .
      </p>
      <LoginForm next={safeNext(typeof next === 'string' ? next : undefined)} />
    </main>
  );
}
