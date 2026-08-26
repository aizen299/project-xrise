import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LifeBuoy } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { LoginForm } from './login-form';

export const metadata = { title: 'Agent sign in · XRise Helpdesk' };

function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const session = await getSession();
  const { next } = await searchParams;
  const target = safeNext(typeof next === 'string' ? next : undefined);

  if (session) redirect(target);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:ring-ring/60 focus-visible:ring-[3px] focus-visible:outline-none"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
            <LifeBuoy className="size-4" />
          </span>
          XRise Helpdesk
        </Link>
        <ThemeToggle />
      </div>

      <main className="flex flex-1 items-center justify-center px-6 pb-20">
        <Card className="animate-rise glass w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">Agent sign in</CardTitle>
            <CardDescription>
              Support agents only.{' '}
              <Link href="/" className="text-foreground underline underline-offset-4">
                Submit a ticket instead
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm next={target} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
