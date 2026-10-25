import 'server-only';
import { prisma } from '@/server/db';
import { getPlan, type Plan } from '@/config/plans';

export interface TeacherUsage {
  plan: Plan;
  classes: number;
  students: number;
}

/** What a teacher currently uses against their plan. Sample classes never count. */
export async function getTeacherUsage(teacherId: string, planId: string): Promise<TeacherUsage> {
  const [classes, students] = await Promise.all([
    prisma.classroom.count({ where: { teacherId, isSample: false } }),
    prisma.enrollment.count({ where: { status: 'ACTIVE', classroom: { teacherId, isSample: false } } }),
  ]);
  return { plan: getPlan(planId), classes, students };
}

export function upgradeHint(limit: string): string {
  return `${limit} Upgrade your plan to unlock more.`;
}
