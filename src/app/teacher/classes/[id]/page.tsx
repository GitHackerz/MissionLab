import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { prisma } from '@/server/db';
import { requireTeacher } from '@/server/auth/session';
import { StatTile, TeacherShell } from '@/features/teacher/components/TeacherShell';
import { CopyCode, NewAssignmentPanel, UnassignButton } from '@/features/teacher/components/TeacherClient';
import { StudentsPanel, type StudentRow } from '@/features/teacher/components/StudentsPanel';
import { DuePill, Initials, MiniProgress, OutcomeChip } from '@/features/teacher/components/Chips';
import { FAILURE_LABEL, assignmentProgress, bestResult, classStats, dueStatus, isAssignedTo, runsForAssignment, timeAgo } from '@/features/teacher/format';
import { getMission, missionTitle } from '@/config/missions';
import { getPlan } from '@/config/plans';
import { getTeacherUsage } from '@/server/billing/entitlements';
import { Lock } from 'lucide-react';

export const dynamic = 'force-dynamic';

const TABS = [
  { id: 'students', label: 'Students' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'activity', label: 'Activity' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default async function ClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const tab: TabId = TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : 'students';
  const teacher = await requireTeacher();
  const classroom = await prisma.classroom.findUnique({
    where: { id },
    include: {
      assignments: {
        orderBy: { createdAt: 'desc' },
        include: { targets: { select: { studentId: true, student: { select: { name: true } } } } },
      },
      enrollments: {
        orderBy: { joinedAt: 'asc' },
        include: {
          student: {
            select: { id: true, name: true, email: true, isSample: true, runs: { orderBy: { createdAt: 'desc' } } },
          },
        },
      },
    },
  });
  if (!classroom || classroom.teacherId !== teacher.id) notFound();

  const now = Date.now();
  const plan = getPlan(teacher.plan);
  // Sample classes show every feature so the demo is always complete.
  const unlocked = (feature: 'targetedAssignments' | 'insights') => classroom.isSample || plan.limits[feature];
  const usage = await getTeacherUsage(teacher.id, teacher.plan);
  const stats = classStats(classroom.enrollments);
  const activeEnrollments = classroom.enrollments.filter((e) => e.status === 'ACTIVE');

  // ---- Students tab rows (plain data for the client table) ----
  const studentRows: StudentRow[] = classroom.enrollments.map((e) => {
    const mine = classroom.assignments.filter((a) => isAssignedTo(a, e.student.id));
    const done = mine.filter((a) => runsForAssignment(e.student.runs, a).length > 0);
    const overdue = mine.filter((a) => a.dueAt && a.dueAt.getTime() < now && !done.includes(a)).length;
    const last = e.student.runs[0];
    return {
      enrollmentId: e.id,
      name: e.student.name,
      email: e.student.isSample ? null : e.student.email,
      isSample: e.student.isSample,
      status: e.status,
      missions: e.student.runs.length,
      best: bestResult(e.student.runs),
      last: last ? { outcome: last.outcome, finalHour: last.finalHour, kind: last.failureKind, ago: timeAgo(last.createdAt, now) } : null,
      lastActiveAt: last ? last.createdAt.getTime() : 0,
      assignedDone: e.status === 'ACTIVE' ? done.length : 0,
      assignedTotal: e.status === 'ACTIVE' ? mine.length : 0,
      overdue: e.status === 'ACTIVE' ? overdue : 0,
    };
  });

  // ---- Assignments tab rows ----
  const assignmentRows = classroom.assignments.map((a) => {
    const progress = assignmentProgress(a, classroom.enrollments);
    const due = dueStatus(a.dueAt, now);
    const roster = activeEnrollments
      .filter((e) => isAssignedTo(a, e.student.id))
      .map((e) => {
        const attempts = runsForAssignment(e.student.runs, a);
        const best = attempts.find((r) => r.outcome === 'SUCCESS') ?? attempts[0];
        return { id: e.student.id, name: e.student.name, attempts: attempts.length, best, lastAgo: attempts[0] ? timeAgo(attempts[0].createdAt, now) : null };
      })
      .sort((x, y) => Number(!!x.best) - Number(!!y.best) || x.name.localeCompare(y.name));
    const audience =
      a.targets.length === 0
        ? 'Whole class'
        : a.targets.length <= 3
          ? a.targets.map((t) => t.student.name).join(', ')
          : `${a.targets.slice(0, 3).map((t) => t.student.name).join(', ')} +${a.targets.length - 3}`;
    return { a, progress, due, roster, audience, mission: getMission(a.missionId) };
  });
  const overdueAssignments = assignmentRows.filter((r) => r.due.tone === 'overdue' && r.progress.completed < r.progress.total).length;

  // ---- Activity tab ----
  const recent = classroom.enrollments
    .flatMap((e) => e.student.runs.map((r) => ({ ...r, student: e.student.name })))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 15);
  const maxFail = Math.max(1, ...stats.failuresByKind.map((f) => f.count));

  const badge: Record<TabId, string> = {
    students: String(classroom.enrollments.length),
    assignments: String(classroom.assignments.length),
    activity: String(stats.runs),
  };

  return (
    <TeacherShell name={teacher.name} plan={teacher.plan}>
      <header className="grid gap-4">
        <Link href="/teacher" className="text-sm text-dust hover:text-cream">← All classes</Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1">
            <h1 className="font-display text-4xl font-semibold">{classroom.name}</h1>
            {classroom.isSample && (
              <p className="text-sm text-status-repair">Sample data: example students whose results come from real runs of the mission engine.</p>
            )}
          </div>
          <div className="grid justify-items-end gap-1">
            <span className="text-[13px] text-dust">Students join at <b className="text-cream">/join</b> with</span>
            <CopyCode code={classroom.joinCode} />
          </div>
        </div>
      </header>

      <section aria-label="Key numbers" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Active students"
          value={String(stats.students)}
          hint={classroom.isSample ? (stats.disabled ? `${stats.disabled} disabled` : 'none disabled') : `${usage.students}/${plan.limits.maxStudents} on your ${plan.name} plan`}
          tone={!classroom.isSample && usage.students >= plan.limits.maxStudents ? 'warn' : undefined}
        />
        <StatTile
          label="Assignments"
          value={String(classroom.assignments.length)}
          hint={overdueAssignments ? `${overdueAssignments} overdue` : 'none overdue'}
          tone={overdueAssignments ? 'warn' : undefined}
        />
        <StatTile
          label="Survival rate"
          value={stats.survivalRate === null ? '—' : `${stats.survivalRate}%`}
          hint={stats.runs ? `${stats.survived} of ${stats.runs} missions reached 72 h` : 'no missions yet'}
          tone={stats.survivalRate === null ? undefined : stats.survivalRate >= 50 ? 'ok' : 'warn'}
        />
        <StatTile
          label="Most common failure"
          value={stats.topFailure ? `${stats.topFailure.count}×` : '—'}
          hint={stats.topFailure ? FAILURE_LABEL[stats.topFailure.kind] ?? stats.topFailure.kind : 'no failures recorded'}
          tone={stats.topFailure ? 'crit' : undefined}
        />
      </section>

      <nav aria-label="Class sections" className="flex gap-1 overflow-x-auto border-b border-space-line">
        {TABS.map((t) => {
          const current = t.id === tab;
          return (
            <Link
              key={t.id}
              href={`?tab=${t.id}`}
              scroll={false}
              aria-current={current ? 'page' : undefined}
              className={`-mb-px flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-4 text-[15px] transition ${
                current ? 'border-flare font-semibold text-cream' : 'border-transparent text-dust hover:text-cream'
              }`}
            >
              {t.label}
              <span className={`rounded-full px-2 py-0.5 font-data text-[11px] ${current ? 'bg-flare/15 text-flare' : 'bg-space-3 text-dust'}`}>{badge[t.id]}</span>
            </Link>
          );
        })}
      </nav>

      {tab === 'students' && <StudentsPanel rows={studentRows} joinCode={classroom.joinCode} />}

      {tab === 'assignments' && (
        <section className="grid gap-4">
          <NewAssignmentPanel
            classroomId={classroom.id}
            students={activeEnrollments.map((e) => ({ id: e.student.id, name: e.student.name }))}
            startOpen={classroom.assignments.length === 0}
            canTarget={unlocked('targetedAssignments')}
          />

          {assignmentRows.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-space-line">
              <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_24px] gap-4 bg-space-2 px-4 py-3 font-data text-[11px] uppercase tracking-[0.12em] text-dust-2 md:grid">
                <span>Mission</span>
                <span>Assigned to</span>
                <span>Due</span>
                <span>Progress</span>
                <span />
              </div>
              {assignmentRows.map(({ a, progress, due, roster, audience, mission }) => (
                <details key={a.id} className="group border-t border-space-line first:border-t-0 md:first:border-t">
                  <summary className="grid cursor-pointer list-none gap-3 px-4 py-4 transition hover:bg-space-2/60 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_24px] md:items-center md:gap-4 [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 items-center gap-3">
                      {mission && <Image src={mission.image} alt="" width={48} height={48} className="h-11 w-11 shrink-0 object-contain" />}
                      <span className="grid min-w-0">
                        <span className="truncate font-display text-[17px] font-semibold">{missionTitle(a.missionId)}</span>
                        {a.note && <span className="truncate text-[13px] text-dust">“{a.note}”</span>}
                      </span>
                    </span>
                    <span className={`truncate text-sm ${a.targets.length ? 'text-cream' : 'text-dust'}`}>{audience}</span>
                    <span><DuePill text={due.text} tone={progress.completed === progress.total && progress.total > 0 ? 'later' : due.tone} /></span>
                    <span className="flex items-center gap-3">
                      <MiniProgress done={progress.completed} total={progress.total} />
                      {progress.survived > 0 && <span className="whitespace-nowrap font-data text-[12px] text-status-ok">{progress.survived} ✓</span>}
                    </span>
                    <ChevronDown className="hidden h-4 w-4 text-dust transition group-open:rotate-180 md:block" aria-hidden />
                  </summary>

                  <div className="grid gap-3 border-t border-space-line bg-space px-4 py-4">
                    {roster.length === 0 ? (
                      <p className="text-sm text-dust">No active students are assigned.</p>
                    ) : (
                      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {roster.map((s) => (
                          <li key={s.id} className="flex items-center gap-3 rounded-md border border-space-line bg-space-2 px-3 py-2">
                            <Initials name={s.name} muted={!s.best} />
                            <span className="grid min-w-0 flex-1">
                              <span className="truncate text-sm font-semibold">{s.name}</span>
                              <span className="text-[12px] text-dust-2">
                                {s.best ? `${s.attempts} attempt${s.attempts === 1 ? '' : 's'} · ${s.lastAgo}` : due.tone === 'overdue' ? 'Overdue' : 'Not started'}
                              </span>
                            </span>
                            {s.best ? (
                              <OutcomeChip outcome={s.best.outcome} finalHour={s.best.finalHour} kind={null} compact />
                            ) : (
                              <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 font-data text-[12px] ${due.tone === 'overdue' ? 'bg-status-crit/10 text-status-crit' : 'bg-status-warn/10 text-status-warn'}`}>To do</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12px] text-dust-2">Assigned {timeAgo(a.createdAt, now)}. Counts missions finished after that.</span>
                      <UnassignButton assignmentId={a.id} title={missionTitle(a.missionId)} />
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )}
          <p className="text-[13px] text-dust-2">Click an assignment to see who has finished it. Students see assignments on their dashboard.</p>
        </section>
      )}

      {tab === 'activity' && !unlocked('insights') && (
        <section className="grid justify-items-center gap-4 rounded-lg border border-dashed border-space-line p-10 text-center">
          <Image src="/mascot/fankouch-exploring.webp" alt="" width={520} height={454} className="h-32 w-auto" />
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Lock className="h-5 w-5 text-dust" aria-hidden /> Activity insights
          </h2>
          <p className="max-w-md text-dust">
            See why missions ended early across your class and every recent run. Included in the Classroom and Academy plans.
          </p>
          <Link href="/billing" className="btn-primary">See plans</Link>
        </section>
      )}

      {tab === 'activity' && unlocked('insights') && (
        <section className="grid gap-6">
          {stats.failuresByKind.length > 0 && (
            <div className="grid gap-3 rounded-lg border border-space-line bg-space-2 p-5">
              <h2 className="font-display text-xl font-semibold">Why missions ended early</h2>
              <ul className="grid gap-2">
                {stats.failuresByKind.map((f) => (
                  <li key={f.kind} className="grid grid-cols-[180px_1fr_40px] items-center gap-3 text-sm max-sm:grid-cols-[1fr_40px]">
                    <span className="text-dust max-sm:col-span-2">{FAILURE_LABEL[f.kind] ?? f.kind}</span>
                    <span className="h-3 rounded-full bg-space-3">
                      <span className="block h-3 rounded-full bg-status-crit" style={{ width: `${(f.count / maxFail) * 100}%` }} />
                    </span>
                    <span className="text-right font-data tabular">{f.count}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[13px] text-dust-2">Discussion idea: ask students who survived what they switched off first, and when.</p>
            </div>
          )}

          <div className="grid gap-3">
            <h2 className="font-display text-xl font-semibold">Recent missions</h2>
            {recent.length === 0 ? (
              <p className="text-dust">No missions finished yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-space-line">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead className="bg-space-2 text-left font-data text-[11px] uppercase tracking-[0.12em] text-dust-2">
                    <tr>
                      <th scope="col" className="px-4 py-3">When</th>
                      <th scope="col" className="px-4 py-3">Student</th>
                      <th scope="col" className="px-4 py-3">Mission</th>
                      <th scope="col" className="px-4 py-3">Result</th>
                      <th scope="col" className="px-4 py-3 text-right">Lowest battery</th>
                      <th scope="col" className="px-4 py-3 text-right">Lowest water</th>
                      <th scope="col" className="px-4 py-3 text-right">Decisions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => (
                      <tr key={r.id} className="border-t border-space-line hover:bg-space-2/60">
                        <td className="whitespace-nowrap px-4 py-3 text-dust">{timeAgo(r.createdAt, now)}</td>
                        <td className="px-4 py-3 font-semibold">{r.student}</td>
                        <td className="px-4 py-3 text-dust">{missionTitle(r.scenarioId)}</td>
                        <td className="px-4 py-3"><OutcomeChip outcome={r.outcome} finalHour={r.finalHour} kind={r.failureKind} /></td>
                        <td className="px-4 py-3 text-right font-data tabular">{r.minBatteryKwh.toFixed(1)} kWh</td>
                        <td className="px-4 py-3 text-right font-data tabular">{r.minWaterLiters.toFixed(1)} L</td>
                        <td className="px-4 py-3 text-right font-data tabular">{r.decisions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </TeacherShell>
  );
}
