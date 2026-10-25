import Image from 'next/image';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { prisma } from '@/server/db';
import { getCurrentUser } from '@/server/auth/session';
import { logOut } from '@/server/auth/actions';
import { GUEST_COOKIE, GUEST_LIMIT_MS } from '@/config/guest';
import { MissionWorkspace } from '@/features/mission-ui/components/MissionWorkspace';
import { GuestAccess } from '@/features/mission-ui/components/GuestAccess';
import { MissionResultRecorder } from '@/features/mission-ui/components/MissionResultRecorder';

export const dynamic = 'force-dynamic';

/** A student whose teacher disabled them in every class they belong to. Fails open if the database is down. */
async function pausedClassName(userId: string): Promise<string | null> {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: userId },
      select: { status: true, classroom: { select: { name: true } } },
    });
    if (!enrollments.length || enrollments.some((e) => e.status === 'ACTIVE')) return null;
    return enrollments[0].classroom.name;
  } catch {
    return null;
  }
}

export default async function MissionPage({ searchParams }: { searchParams: Promise<{ tour?: string }> }) {
  const [{ tour }, user, jar] = await Promise.all([searchParams, getCurrentUser(), cookies()]);

  if (user && user.role !== 'TEACHER') {
    const paused = await pausedClassName(user.id);
    if (paused) {
      return (
        <main className="grid min-h-screen place-items-center px-4">
          <div className="grid max-w-md justify-items-center gap-4 rounded-lg border border-space-line bg-space-2 p-8 text-center">
            <Image src="/mascot/fankouch-sad.webp" alt="" width={352} height={520} className="h-36 w-auto" />
            <h1 className="font-display text-2xl font-semibold">Your mission access is paused</h1>
            <p className="text-[15px] text-dust">
              Your teacher has paused your access to <b className="text-cream">{paused}</b>. Ask them to turn it back on.
            </p>
            <form action={logOut}>
              <button type="submit" className="btn-secondary">Log out</button>
            </form>
          </div>
        </main>
      );
    }
  }

  // Signed-in users play without limit; guests get a fixed trial from their first visit.
  let account: React.ReactNode;
  if (user) {
    account = (
      <div className="flex items-center gap-2 text-xs">
        <span className="font-data text-dust">{user.name}</span>
        {user.role === 'TEACHER' ? (
          <Link href="/teacher" className="rounded px-2 py-1 text-ember hover:bg-space-3">Dashboard</Link>
        ) : (
          <Link href="/dashboard" className="rounded px-2 py-1 text-ember hover:bg-space-3">My dashboard</Link>
        )}
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

  return (
    <>
      <MissionWorkspace account={account} startTour={tour === '1'} />
      {user && user.role !== 'TEACHER' && <MissionResultRecorder />}
    </>
  );
}
