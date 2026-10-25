import Image from 'next/image';
import Link from 'next/link';
import { logOut } from '@/server/auth/actions';
import { getPlan } from '@/config/plans';

export function TeacherShell({ name, plan, children }: { name: string; plan?: string; children: React.ReactNode }) {
  const current = getPlan(plan);
  return (
    <div className="min-h-screen">
      <nav aria-label="Teacher" className="sticky top-0 z-30 border-b border-space-line bg-space/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/teacher" className="flex items-center gap-2.5 font-display text-lg font-semibold">
            <Image src="/brand/logo-mark.png" alt="" width={54} height={30} className="h-[30px] w-auto" />
            <span>
              Mission<span className="text-flare">Lab</span>
            </span>
          </Link>
          <span className="hidden rounded-full border border-space-line px-2.5 py-0.5 font-data text-[11px] uppercase tracking-wider text-dust sm:inline">
            Teacher
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/billing"
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-space-line px-3 text-sm hover:border-ember"
              title="Plan & billing"
            >
              <span className="font-semibold">{current.name}</span>
              {current.id === 'explorer' && <span className="font-data text-[11px] uppercase text-flare">Upgrade</span>}
            </Link>
            <span className="hidden text-sm text-dust md:inline">{name}</span>
            <Link href="/mission" className="btn-ghost min-h-10 px-3 text-sm">
              Try the mission
            </Link>
            <form action={logOut}>
              <button type="submit" className="btn-secondary min-h-10 px-3 text-sm">
                Log out
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}

export function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'ok' | 'warn' | 'crit' }) {
  const color = tone === 'ok' ? 'text-status-ok' : tone === 'warn' ? 'text-status-warn' : tone === 'crit' ? 'text-status-crit' : 'text-cream';
  return (
    <div className="grid content-start gap-1 rounded-lg border border-space-line bg-space-2 p-5">
      <span className="font-data text-[11px] uppercase tracking-[0.14em] text-dust-2">{label}</span>
      <span className={`font-data text-3xl font-bold tabular ${color}`}>{value}</span>
      {hint && <span className="text-[13px] text-dust">{hint}</span>}
    </div>
  );
}
