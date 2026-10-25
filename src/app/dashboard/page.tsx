import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Play } from 'lucide-react';
import { prisma } from '@/server/db';
import { requireUser } from '@/server/auth/session';
import { logOut } from '@/server/auth/actions';
import { MISSIONS, getMission, missionTitle } from '@/config/missions';
import { FAILURE_LABEL, formatDue, isAssignedTo, runsForAssignment, timeAgo } from '@/features/teacher/format';
import { StatTile } from '@/features/teacher/components/TeacherShell';

export const dynamic = 'force-dynamic';

function ResultChip({ outcome, finalHour, kind }: { outcome: 'SUCCESS' | 'FAILED'; finalHour: number; kind: string | null }) {
  if (outcome === 'SUCCESS') {
    return <span className="rounded-full border border-status-ok/40 bg-status-ok/10 px-2.5 py-0.5 font-data text-[12px] font-semibold text-status-ok">✓ Survived H{finalHour}</span>;
  }
  return (
    <span className="rounded-full border border-status-crit/50 bg-status-crit/10 px-2.5 py-0.5 font-data text-[12px] font-semibold text-status-crit">
      ✕ Ended H{finalHour}
      {kind && <span className="font-body font-normal text-dust"> · {FAILURE_LABEL[kind] ?? kind}</span>}
    </span>
  );
}

export default async function StudentDashboard() {
  const user = await requireUser();
  if (user.role === 'TEACHER') redirect('/teacher');

  const [enrollments, runs] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentId: user.id },
      orderBy: { joinedAt: 'asc' },
      include: {
        classroom: {
          select: { name: true, assignments: { orderBy: { createdAt: 'desc' }, include: { targets: { select: { studentId: true } } } } },
        },
      },
    }),
    prisma.missionRun.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }),
  ]);

  const active = enrollments.filter((e) => e.status === 'ACTIVE');
  const paused = enrollments.length > 0 && active.length === 0;
  const assignments = active
    .flatMap((e) => e.classroom.assignments.filter((a) => isAssignedTo(a, user.id)).map((a) => ({ ...a, className: e.classroom.name })))
    .map((a) => {
      const done = runsForAssignment(runs, a);
      const best = done.find((r) => r.outcome === 'SUCCESS') ?? done[0];
      return { ...a, done, best };
    })
    .sort((a, b) => Number(a.done.length > 0) - Number(b.done.length > 0) || (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity));
  const todo = assignments.filter((a) => !a.done.length).length;
  const survived = runs.filter((r) => r.outcome === 'SUCCESS').length;

  return (
    <div className="min-h-screen">
      <nav aria-label="Student" className="sticky top-0 z-30 border-b border-space-line bg-space/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-display text-lg font-semibold">
            <Image src="/brand/logo-mark.png" alt="" width={54} height={30} className="h-[30px] w-auto" />
            <span>Mission<span className="text-flare">Lab</span></span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/join" className="btn-ghost min-h-10 px-3 text-sm">Join a class</Link>
            <form action={logOut}>
              <button type="submit" className="btn-secondary min-h-10 px-3 text-sm">Log out</button>
            </form>
          </div>
        </div>
      </nav>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6">
        <header className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div className="grid gap-3">
            <span className="eyebrow">Commander’s log</span>
            <h1 className="font-display text-4xl font-semibold">Welcome back, {user.name}</h1>
            <p className="max-w-[60ch] text-dust">
              {paused
                ? 'Your teacher has paused your class access. Ask them to turn it back on.'
                : todo > 0
                  ? `You have ${todo} assigned mission${todo === 1 ? '' : 's'} to fly.`
                  : enrollments.length
                    ? 'All your assigned missions are done. Try a different strategy, or replay to beat your best.'
                    : 'Join your class with the code from your teacher, or fly a mission on your own.'}
            </p>
            {active.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {active.map((e) => (
                  <span key={e.id} className="rounded-full border border-space-line bg-space-2 px-3 py-1 text-[13px] text-dust">{e.classroom.name}</span>
                ))}
              </div>
            )}
          </div>
          <Image src="/mascot/fankouch-wave.webp" alt="" width={391} height={520} className="hidden h-44 w-auto animate-bob md:block" priority />
        </header>

        <section aria-label="Your stats" className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Missions flown" value={String(runs.length)} />
          <StatTile label="Crew kept safe" value={String(survived)} hint={runs.length ? `${Math.round((survived / runs.length) * 100)}% of missions` : 'no missions yet'} tone={survived ? 'ok' : undefined} />
          <StatTile label="Assigned to do" value={String(todo)} tone={todo ? 'warn' : undefined} hint={assignments.length ? `${assignments.length - todo} of ${assignments.length} done` : 'nothing assigned'} />
        </section>

        <section className="grid gap-4">
          <h2 className="font-display text-2xl font-semibold">Assigned missions</h2>
          {paused ? (
            <p className="rounded-md border border-status-offline/40 bg-space-2 p-4 text-dust">Your class access is paused, so assignments are hidden.</p>
          ) : assignments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-space-line p-8 text-center sm:flex-row sm:text-left">
              <Image src="/mascot/fankouch-pointing.webp" alt="" width={448} height={520} className="h-24 w-auto" />
              <p className="text-dust">
                {enrollments.length ? 'Your teacher hasn’t assigned a mission yet.' : 'No class yet.'}{' '}
                <Link href="/join" className="text-ember hover:underline">Join a class</Link> to get assignments.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {assignments.map((a) => {
                const mission = getMission(a.missionId);
                const due = formatDue(a.dueAt);
                const done = a.done.length > 0;
                return (
                  <li key={a.id} className={`grid gap-3 rounded-lg border p-5 ${done ? 'border-space-line bg-space-2' : 'border-flare/60 bg-[linear-gradient(180deg,rgba(254,83,25,.08),#171213_50%)]'}`}>
                    <div className="flex items-start gap-4">
                      {mission && <Image src={mission.image} alt="" width={72} height={72} className="h-16 w-16 shrink-0 object-contain" />}
                      <div className="grid gap-1">
                        <span className="font-data text-[11px] uppercase tracking-[0.14em] text-dust-2">{a.className}</span>
                        <h3 className="font-display text-xl font-semibold">{missionTitle(a.missionId)}</h3>
                        {a.note && <p className="text-sm text-dust">“{a.note}”</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-[13px]">
                        {done && a.best ? (
                          <ResultChip outcome={a.best.outcome} finalHour={a.best.finalHour} kind={a.best.failureKind} />
                        ) : (
                          <span className="rounded-full bg-status-warn/15 px-2.5 py-0.5 font-data text-[12px] font-semibold text-status-warn">To do</span>
                        )}
                        {due && <span className={due.overdue && !done ? 'text-status-warn' : 'text-dust'}>{due.text}</span>}
                      </div>
                      {mission?.status === 'available' ? (
                        <Link href={mission.href} className={done ? 'btn-secondary min-h-10 px-4 text-sm' : 'btn-primary min-h-10 px-4 text-sm'}>
                          <Play className="h-4 w-4" aria-hidden />
                          {done ? 'Play again' : 'Start mission'}
                        </Link>
                      ) : (
                        <span className="text-[13px] text-dust-2">Coming soon</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="grid gap-4">
          <h2 className="font-display text-2xl font-semibold">All missions</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MISSIONS.map((m) => (
              <li key={m.id} className={`grid content-start gap-3 rounded-lg border border-space-line bg-space-2 p-5 ${m.status === 'available' ? '' : 'opacity-60'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-data text-[13px] font-bold text-flare">MISSION {m.number}</span>
                  <span className="font-data text-[11px] text-dust-2">{m.status === 'available' ? `~${m.minutes} min` : 'Coming soon'}</span>
                </div>
                <h3 className="font-display text-lg font-semibold">{m.title}</h3>
                <p className="text-sm text-dust">{m.summary}</p>
                <div className="flex flex-wrap gap-1.5">
                  {m.concepts.map((c) => (
                    <span key={c} className="rounded-full bg-space-3 px-2 py-0.5 text-[12px] text-dust">{c}</span>
                  ))}
                </div>
                {m.status === 'available' && (
                  <Link href={m.href} className="btn-secondary mt-1 min-h-10 text-sm">
                    <Play className="h-4 w-4" aria-hidden /> Play
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-4">
          <h2 className="font-display text-2xl font-semibold">Your mission history</h2>
          {runs.length === 0 ? (
            <p className="text-dust">No missions finished yet. Your results will appear here after your first mission.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-space-line">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead className="bg-space-2 text-left font-data text-[11px] uppercase tracking-[0.12em] text-dust-2">
                  <tr>
                    <th scope="col" className="px-4 py-3">When</th>
                    <th scope="col" className="px-4 py-3">Mission</th>
                    <th scope="col" className="px-4 py-3">Result</th>
                    <th scope="col" className="px-4 py-3">Lowest battery</th>
                    <th scope="col" className="px-4 py-3">Lowest water</th>
                    <th scope="col" className="px-4 py-3">Decisions</th>
                    <th scope="col" className="px-4 py-3">Skills</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => {
                    const skills = Array.isArray(r.skills) ? (r.skills as { rating: string }[]) : null;
                    const strong = skills?.filter((s) => s.rating === 'proficient').length ?? 0;
                    return (
                      <tr key={r.id} className="border-t border-space-line">
                        <td className="px-4 py-3 text-dust">{timeAgo(r.createdAt)}</td>
                        <td className="px-4 py-3">{missionTitle(r.scenarioId)}</td>
                        <td className="px-4 py-3"><ResultChip outcome={r.outcome} finalHour={r.finalHour} kind={r.failureKind} /></td>
                        <td className="px-4 py-3 font-data tabular">{r.minBatteryKwh.toFixed(1)} kWh</td>
                        <td className="px-4 py-3 font-data tabular">{r.minWaterLiters.toFixed(1)} L</td>
                        <td className="px-4 py-3 font-data tabular">{r.decisions}</td>
                        <td className="px-4 py-3 text-dust">{skills ? `${strong}/${skills.length} strong` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
