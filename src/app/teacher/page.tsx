import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/server/db';
import { requireTeacher } from '@/server/auth/session';
import { createSampleClassroom } from '@/server/classes/actions';
import { TeacherShell } from '@/features/teacher/components/TeacherShell';
import { CopyCode, CreateClassForm } from '@/features/teacher/components/TeacherClient';
import { classStats } from '@/features/teacher/format';
import { getTeacherUsage } from '@/server/billing/entitlements';

export const dynamic = 'force-dynamic';

export default async function TeacherHome() {
  const teacher = await requireTeacher();
  const classes = await prisma.classroom.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: 'desc' },
    include: { enrollments: { select: { status: true, student: { select: { runs: { select: { outcome: true, failureKind: true } } } } } } },
  });
  const hasSample = classes.some((c) => c.isSample);
  const usage = await getTeacherUsage(teacher.id, teacher.plan);
  const atClassLimit = usage.classes >= usage.plan.limits.maxClasses;

  return (
    <TeacherShell name={teacher.name} plan={teacher.plan}>
      <header className="grid gap-2">
        <span className="eyebrow">Teacher dashboard</span>
        <h1 className="font-display text-4xl font-semibold">Your classes</h1>
        <p className="max-w-[62ch] text-dust">
          Share a class code with your students. When they finish a mission, you’ll see how it went and why.
        </p>
      </header>

      <section className="grid gap-4 rounded-lg border border-space-line bg-space-2 p-5 md:grid-cols-[1.4fr_1fr] md:items-end">
        {atClassLimit ? (
          <div className="grid gap-2">
            <span className="text-sm font-medium">New class</span>
            <p className="text-sm text-dust">
              Your <b className="text-cream">{usage.plan.name}</b> plan includes {usage.plan.limits.maxClasses} class
              {usage.plan.limits.maxClasses === 1 ? '' : 'es'} ({usage.students}/{usage.plan.limits.maxStudents} students used).{' '}
              <Link href="/billing" className="font-semibold text-ember hover:underline">Upgrade to add more →</Link>
            </p>
          </div>
        ) : (
          <CreateClassForm />
        )}
        {!hasSample && (
          <form action={createSampleClassroom} className="grid gap-2">
            <span className="text-sm font-medium">Just looking?</span>
            <button type="submit" className="btn-secondary">
              Create a sample class
            </button>
          </form>
        )}
      </section>

      {classes.length === 0 ? (
        <section className="grid justify-items-center gap-4 rounded-lg border border-dashed border-space-line p-10 text-center">
          <Image src="/mascot/fankouch-pointing.webp" alt="" width={448} height={520} className="h-40 w-auto" />
          <h2 className="font-display text-2xl font-semibold">No classes yet</h2>
          <p className="max-w-md text-dust">Create your first class above, or a sample class to see what the dashboard shows.</p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {classes.map((c) => {
            const s = classStats(c.enrollments);
            return (
              <article key={c.id} className="grid gap-4 rounded-lg border border-space-line bg-space-2 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-semibold">{c.name}</h2>
                    {c.isSample && (
                      <span className="mt-1 inline-block rounded-full bg-status-repair/10 px-2 py-0.5 font-data text-[11px] uppercase tracking-wider text-status-repair">
                        Sample data
                      </span>
                    )}
                  </div>
                  <CopyCode code={c.joinCode} />
                </div>
                <dl className="grid grid-cols-3 gap-3 text-sm">
                  <div><dt className="text-dust-2">Students</dt><dd className="font-data text-lg font-bold">{s.students}</dd></div>
                  <div><dt className="text-dust-2">Missions</dt><dd className="font-data text-lg font-bold">{s.runs}</dd></div>
                  <div><dt className="text-dust-2">Survived</dt><dd className="font-data text-lg font-bold">{s.survivalRate === null ? '—' : `${s.survivalRate}%`}</dd></div>
                </dl>
                <Link href={`/teacher/classes/${c.id}`} className="btn-secondary">
                  Open class
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </TeacherShell>
  );
}
