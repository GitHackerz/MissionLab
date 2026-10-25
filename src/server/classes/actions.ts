'use server';

import { randomInt } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { getCurrentUser, requireTeacher, requireUser } from '@/server/auth/session';
import { generateToken, hashPassword } from '@/server/auth/crypto';
import { getMission } from '@/config/missions';
import { getPlan } from '@/config/plans';
import { getTeacherUsage } from '@/server/billing/entitlements';
import { simulateSamplePlan, type SamplePlan } from './sample';

export interface ClassFormState {
  error?: string;
  notice?: string;
  /** True when the error is a plan limit, so the form can link to billing. */
  upgrade?: boolean;
}

const CODE_WORDS = ['RED', 'DUST', 'ORBIT', 'ROVER', 'DUNE', 'CRATER', 'SOL', 'MESA'];

function newJoinCode(): string {
  return `${CODE_WORDS[randomInt(CODE_WORDS.length)]}-${randomInt(1000, 10000)}`;
}

async function createWithUniqueCode(teacherId: string, name: string, isSample = false) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.classroom.create({ data: { name, teacherId, isSample, joinCode: newJoinCode() } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
      throw err;
    }
  }
  throw new Error('Could not generate a unique join code.');
}

/** Loads an enrollment and checks it belongs to one of this teacher's classes. */
async function ownedEnrollment(teacherId: string, enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { classroom: { select: { id: true, teacherId: true, isSample: true } } },
  });
  if (!enrollment || enrollment.classroom.teacherId !== teacherId) return null;
  return enrollment;
}

export async function createClassroom(_prev: ClassFormState, formData: FormData): Promise<ClassFormState> {
  const teacher = await requireTeacher();
  const parsed = z.string().trim().min(1, 'Give the class a name.').max(60).safeParse(formData.get('name'));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const usage = await getTeacherUsage(teacher.id, teacher.plan);
  if (usage.classes >= usage.plan.limits.maxClasses) {
    return { error: `Your ${usage.plan.name} plan includes ${usage.plan.limits.maxClasses} class${usage.plan.limits.maxClasses === 1 ? '' : 'es'}. Upgrade to add more.`, upgrade: true };
  }
  const classroom = await createWithUniqueCode(teacher.id, parsed.data);
  redirect(`/teacher/classes/${classroom.id}`);
}

export async function setEnrollmentStatus(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const id = String(formData.get('enrollmentId') ?? '');
  const status = formData.get('status') === 'DISABLED' ? 'DISABLED' : 'ACTIVE';
  const enrollment = await ownedEnrollment(teacher.id, id);
  if (!enrollment) return;
  if (status === 'ACTIVE' && enrollment.status !== 'ACTIVE' && !enrollment.classroom.isSample) {
    const usage = await getTeacherUsage(teacher.id, teacher.plan);
    if (usage.students >= usage.plan.limits.maxStudents) return; // UI explains the limit; nothing changes.
  }
  await prisma.enrollment.update({ where: { id }, data: { status } });
  revalidatePath(`/teacher/classes/${enrollment.classroom.id}`);
}

export async function removeEnrollment(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const id = String(formData.get('enrollmentId') ?? '');
  const enrollment = await ownedEnrollment(teacher.id, id);
  if (!enrollment) return;
  // Removes the student from the class only; their account and mission history stay theirs.
  await prisma.enrollment.delete({ where: { id } });
  revalidatePath(`/teacher/classes/${enrollment.classroom.id}`);
}

export async function createAssignment(_prev: ClassFormState, formData: FormData): Promise<ClassFormState> {
  const teacher = await requireTeacher();
  const parsed = z
    .object({
      classroomId: z.string().min(1),
      missionId: z.string().min(1),
      audience: z.enum(['class', 'students']),
      dueAt: z.string().optional(),
      note: z.string().trim().max(200).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Choose a mission to assign.' };
  const { classroomId, missionId, audience, dueAt, note } = parsed.data;
  const studentIds = [...new Set(formData.getAll('studentIds').map(String))];

  const mission = getMission(missionId);
  if (!mission || mission.status !== 'available') return { error: 'That mission isn’t available yet.' };
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { teacherId: true, isSample: true, enrollments: { where: { status: 'ACTIVE' }, select: { studentId: true } } },
  });
  if (!classroom || classroom.teacherId !== teacher.id) return { error: 'Class not found.' };

  const plan = getPlan(teacher.plan);
  if (plan.limits.maxAssignmentsPerClass !== null && !classroom.isSample) {
    const current = await prisma.assignment.count({ where: { classroomId } });
    if (current >= plan.limits.maxAssignmentsPerClass) {
      return { error: `Your ${plan.name} plan allows ${plan.limits.maxAssignmentsPerClass} assignment per class. Unassign one or upgrade.`, upgrade: true };
    }
  }
  if (audience === 'students' && !plan.limits.targetedAssignments && !classroom.isSample) {
    return { error: `Assigning to chosen students is part of the Classroom plan.`, upgrade: true };
  }

  let targets: string[] = [];
  if (audience === 'students') {
    if (!studentIds.length) return { error: 'Select at least one student, or assign to the whole class.' };
    const active = new Set(classroom.enrollments.map((e) => e.studentId));
    // Only active members of this class can be targeted.
    if (studentIds.some((id) => !active.has(id))) return { error: 'One of the selected students isn’t active in this class.' };
    targets = studentIds;
  } else {
    const existing = await prisma.assignment.findFirst({ where: { classroomId, missionId, targets: { none: {} } } });
    if (existing) return { error: `${mission.title} is already assigned to the whole class.` };
  }

  const due = dueAt ? new Date(`${dueAt}T23:59:00`) : null;
  if (due && Number.isNaN(due.getTime())) return { error: 'Pick a valid due date.' };

  await prisma.assignment.create({
    data: {
      classroomId,
      missionId,
      dueAt: due,
      note: note || null,
      targets: { create: targets.map((studentId) => ({ studentId })) },
    },
  });
  revalidatePath(`/teacher/classes/${classroomId}`);
  return {
    notice: targets.length
      ? `${mission.title} assigned to ${targets.length} student${targets.length === 1 ? '' : 's'}.`
      : `${mission.title} assigned to the whole class.`,
  };
}

export async function deleteAssignment(formData: FormData): Promise<void> {
  const teacher = await requireTeacher();
  const id = String(formData.get('assignmentId') ?? '');
  const assignment = await prisma.assignment.findUnique({ where: { id }, include: { classroom: { select: { teacherId: true } } } });
  if (!assignment || assignment.classroom.teacherId !== teacher.id) return;
  await prisma.assignment.delete({ where: { id } });
  revalidatePath(`/teacher/classes/${assignment.classroomId}`);
}

const SAMPLE_STUDENTS: { name: string; plans: SamplePlan[]; disabled?: boolean; retry?: boolean }[] = [
  { name: 'Yasmine B.', plans: ['all-on', 'shed-and-repair'] },
  { name: 'Omar K.', plans: ['all-on', 'shed-no-repair', 'shed-and-repair'] },
  { name: 'Lina T.', plans: ['shed-and-repair'] },
  { name: 'Adam R.', plans: ['all-on'], retry: true },
  { name: 'Sara M.', plans: ['late-shed', 'shed-and-repair'] },
  { name: 'Youssef H.', plans: ['shed-no-repair'], disabled: true },
];

/** Creates a clearly-labelled sample class whose results come from real engine runs. */
export async function createSampleClassroom(): Promise<void> {
  const teacher = await requireTeacher();
  const classroom = await createWithUniqueCode(teacher.id, 'Sample class · Period 3', true);
  // One unusable password hash for every sample student: nobody can log in as them.
  const passwordHash = await hashPassword(generateToken());
  const now = Date.now();
  await prisma.assignment.create({
    data: {
      classroomId: classroom.id,
      missionId: 'mission-01-red-storm',
      note: 'Try to keep all four crew safe. Then rewind once and compare.',
      createdAt: new Date(now - 24 * 3_600_000),
      dueAt: new Date(now + 3 * 24 * 3_600_000),
    },
  });

  const retryIds: string[] = [];
  for (const [i, s] of SAMPLE_STUDENTS.entries()) {
    const student = await prisma.user.create({
      data: {
        name: s.name,
        email: `sample-${classroom.id}-${i}@sample.missionlab.local`,
        passwordHash,
        role: 'STUDENT',
        isSample: true,
        emailVerifiedAt: new Date(),
        onboardedAt: new Date(),
      },
    });
    await prisma.enrollment.create({
      data: { classroomId: classroom.id, studentId: student.id, status: s.disabled ? 'DISABLED' : 'ACTIVE' },
    });
    for (const [j, plan] of s.plans.entries()) {
      const summary = simulateSamplePlan(plan);
      await prisma.missionRun.create({
        data: {
          userId: student.id,
          scenarioId: summary.scenarioId,
          outcome: summary.status === 'success' ? 'SUCCESS' : 'FAILED',
          finalHour: summary.finalHour,
          durationHours: summary.durationHours,
          minBatteryKwh: summary.minBatteryKwh,
          minWaterLiters: summary.minWaterLiters,
          minOxygenKg: summary.minOxygenKg,
          scienceScore: summary.scienceScore,
          failureKind: summary.rootCause?.kind ?? null,
          failureReason: summary.failureReason ?? null,
          decisions: summary.keyDecisions.length,
          createdAt: new Date(now - (s.plans.length - j) * 3_600_000 - i * 600_000),
        },
      });
    }
    if (s.retry) retryIds.push(student.id);
  }
  // A targeted assignment: only the students who struggled get a second attempt.
  await prisma.assignment.create({
    data: {
      classroomId: classroom.id,
      missionId: 'mission-01-red-storm',
      note: 'Retry: pause the optional systems before hour 20 and watch the battery.',
      dueAt: new Date(now + 2 * 24 * 3_600_000),
      targets: { create: retryIds.map((studentId) => ({ studentId })) },
    },
  });
  redirect(`/teacher/classes/${classroom.id}`);
}

export async function joinClassroom(_prev: ClassFormState, formData: FormData): Promise<ClassFormState> {
  const user = await requireUser();
  if (user.role === 'TEACHER') return { error: 'Teacher accounts manage classes; switch to a student account to join one.' };
  const code = String(formData.get('code') ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z]{3,6}-\d{4}$/.test(code)) return { error: 'Codes look like RED-4821. Check with your teacher.' };

  const classroom = await prisma.classroom.findUnique({ where: { joinCode: code } });
  if (!classroom) return { error: 'No class uses that code. Check with your teacher.' };

  const existing = await prisma.enrollment.findUnique({
    where: { classroomId_studentId: { classroomId: classroom.id, studentId: user.id } },
  });
  if (existing?.status === 'DISABLED') return { error: `Your teacher has paused your access to ${classroom.name}.` };
  if (existing) return { notice: `You’re already in ${classroom.name}.` };

  if (!classroom.isSample) {
    const teacher = await prisma.user.findUnique({ where: { id: classroom.teacherId }, select: { plan: true } });
    const usage = await getTeacherUsage(classroom.teacherId, teacher?.plan ?? 'explorer');
    if (usage.students >= usage.plan.limits.maxStudents) {
      return { error: `${classroom.name} is full. Ask your teacher: their plan allows ${usage.plan.limits.maxStudents} students.` };
    }
  }

  await prisma.enrollment.create({ data: { classroomId: classroom.id, studentId: user.id } });
  return { notice: `You joined ${classroom.name}. Your teacher will see your mission results.` };
}

const runSchema = z.object({
  scenarioId: z.string().min(1).max(80),
  status: z.enum(['success', 'failed']),
  finalHour: z.number().int().min(0).max(1000),
  durationHours: z.number().int().min(1).max(1000),
  minBatteryKwh: z.number().finite(),
  minWaterLiters: z.number().finite(),
  minOxygenKg: z.number().finite(),
  scienceScore: z.number().int().min(0).max(100000),
  failureKind: z.enum(['power', 'water', 'oxygen', 'pressure', 'co2', 'deadline']).nullable(),
  failureReason: z.string().max(500).nullable(),
  decisions: z.number().int().min(0).max(1000),
  skills: z.array(z.object({ id: z.string().max(40), label: z.string().max(60), rating: z.enum(['not-demonstrated', 'developing', 'proficient']) })).max(12).nullable(),
});

export type MissionRunInput = z.infer<typeof runSchema>;

/**
 * Saves the engine's own summary of a finished mission for signed-in students.
 * Note: the summary is reported by the browser; replaying the action log on the server would make it tamper-proof.
 */
export async function recordMissionRun(input: MissionRunInput): Promise<{ saved: boolean }> {
  const user = await getCurrentUser();
  if (!user || user.role === 'TEACHER') return { saved: false };
  const parsed = runSchema.safeParse(input);
  if (!parsed.success) return { saved: false };
  const r = parsed.data;
  await prisma.missionRun.create({
    data: {
      userId: user.id,
      scenarioId: r.scenarioId,
      outcome: r.status === 'success' ? 'SUCCESS' : 'FAILED',
      finalHour: r.finalHour,
      durationHours: r.durationHours,
      minBatteryKwh: r.minBatteryKwh,
      minWaterLiters: r.minWaterLiters,
      minOxygenKg: r.minOxygenKg,
      scienceScore: r.scienceScore,
      failureKind: r.failureKind,
      failureReason: r.failureReason,
      decisions: r.decisions,
      skills: r.skills ?? Prisma.JsonNull,
    },
  });
  return { saved: true };
}
