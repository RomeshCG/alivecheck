'use client';

import { AuthGate } from '@/components/auth-gate';
import { ThemeToggle } from '@/components/theme-toggle';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate mode="guest">
      <div className="relative grid min-h-screen lg:grid-cols-2">
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        <div className="relative hidden flex-col justify-between bg-zinc-950 p-10 text-white lg:flex">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-emerald-500 text-zinc-950">
              AC
            </span>
            AliveCheck
          </div>
          <div>
            <blockquote className="space-y-2">
              <p className="text-lg text-zinc-100">
                “Monitor your services from outside the machine that hosts them — so outages still get reported.”
              </p>
              <footer className="text-sm text-zinc-400">Built for self-hosters and small teams</footer>
            </blockquote>
          </div>
        </div>
        <div className="flex items-center justify-center p-6 md:p-10">{children}</div>
      </div>
    </AuthGate>
  );
}
