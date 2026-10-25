import { cookies } from 'next/headers';
import { getCurrentUser } from '@/server/auth/session';
import { logOut } from '@/server/auth/actions';
import { GUEST_COOKIE, GUEST_LIMIT_MS } from '@/config/guest';
import { MissionWorkspace } from '@/features/mission-ui/components/MissionWorkspace';
import { GuestAccess } from '@/features/mission-ui/components/GuestAccess';

export const dynamic = 'force-dynamic';

export default async function MissionPage({ searchParams }: { searchParams: Promise<{ tour?: string }> }) {
  const [{ tour }, user, jar] = await Promise.all([searchParams, getCurrentUser(), cookies()]);

  // Signed-in users play without limit; guests get a fixed trial from their first visit.
  let account: React.ReactNode;
  if (user) {
    account = (
      <div className="flex items-center gap-2 text-xs">
        <span className="font-data text-dust">{user.name}</span>
        <form action={logOut}>
          <button type="submit" className="rounded px-2 py-1 text-dust hover:bg-space-3 hover:text-cream">
            Log out
          </button>
        </form>
      </div>
    );
  } else {
    const startedAt = Number(jar.get(GUEST_COOKIE)?.value);
    const start = Number.isFinite(startedAt) && startedAt > 0 ? startedAt : Date.now();
    account = <GuestAccess deadline={start + GUEST_LIMIT_MS} />;
  }

  return <MissionWorkspace account={account} startTour={tour === '1'} />;
}
