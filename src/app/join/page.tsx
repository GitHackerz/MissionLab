import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/server/db';
import { requireUser } from '@/server/auth/session';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { JoinClassForm } from '@/features/teacher/components/TeacherClient';

export const dynamic = 'force-dynamic';

export default async function JoinPage() {
  const user = await requireUser();
  if (user.role === 'TEACHER') redirect('/teacher');
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: user.id },
    include: { classroom: { select: { name: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  return (
    <AuthShell
      title="Join your class"
      subtitle="Enter the code your teacher gave you. They’ll see your mission results."
      mascot={{ src: '/mascot/fankouch-pointing.webp', width: 448, height: 520, line: 'Type the code, commander!' }}
      footer={
        <Link href="/dashboard" className="text-ember hover:underline">
          Back to my dashboard
        </Link>
      }
    >
      <div className="grid gap-6">
        <JoinClassForm />
        {enrollments.length > 0 && (
          <div className="grid gap-2">
            <h2 className="text-sm font-medium">Your classes</h2>
            <ul className="grid gap-2">
              {enrollments.map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-md border border-space-line bg-space px-3 py-2 text-sm">
                  {e.classroom.name}
                  <span className={`font-data text-[12px] ${e.status === 'ACTIVE' ? 'text-status-ok' : 'text-status-offline'}`}>
                    {e.status === 'ACTIVE' ? 'Active' : 'Paused by teacher'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
