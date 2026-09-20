'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export function AuthGate({
  children,
  mode,
}: {
  children: React.ReactNode;
  mode: 'protected' | 'guest';
}) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'loading') return;
    if (mode === 'protected' && status === 'anonymous') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
    if (mode === 'guest' && status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [mode, pathname, router, status]);

  if (status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading…
        </div>
      </div>
    );
  }

  if (mode === 'protected' && status !== 'authenticated') return null;
  if (mode === 'guest' && status !== 'anonymous') return null;

  return <>{children}</>;
}
