import type { MissionRun } from '@prisma/client';

export const FAILURE_LABEL: Record<string, string> = {
  power: 'Battery ran out',
  water: 'Water below safe level',
  oxygen: 'Oxygen below safe level',
  pressure: 'Cabin pressure too low',
  co2: 'CO₂ above safe level',
  deadline: 'Ran out of time',
};

export function timeAgo(date: Date, now = Date.now()): string {
  const mins = Math.round((now - date.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function bestResult(runs: Pick<MissionRun, 'outcome' | 'finalHour' | 'durationHours'>[]): string {
  if (!runs.length) return '—';
  if (runs.some((r) => r.outcome === 'SUCCESS')) return `Survived ${runs[0].durationHours} h`;
  return `Lasted to hour ${Math.max(...runs.map((r) => r.finalHour))}`;
}

type RunLite = Pick<MissionRun, 'scenarioId' | 'outcome' | 'finalHour' | 'createdAt'>;

/** Runs that count toward an assignment: same mission, finished after it was assigned. */
export function runsForAssignment<T extends RunLite>(runs: T[], assignment: { missionId: string; createdAt: Date }): T[] {
  return runs.filter((r) => r.scenarioId === assignment.missionId && r.createdAt >= assignment.createdAt);
}

/** True when the assignment applies to this student (no targets = whole class). */
export function isAssignedTo(assignment: { targets: { studentId: string }[] }, studentId: string): boolean {
  return assignment.targets.length === 0 || assignment.targets.some((t) => t.studentId === studentId);
}

export function assignmentProgress(
  assignment: { missionId: string; createdAt: Date; targets: { studentId: string }[] },
  enrollments: { status: 'ACTIVE' | 'DISABLED'; student: { id: string; runs: RunLite[] } }[],
) {
  const active = enrollments.filter((e) => e.status === 'ACTIVE' && isAssignedTo(assignment, e.student.id));
  let completed = 0;
  let survived = 0;
  for (const e of active) {
    const runs = runsForAssignment(e.student.runs, assignment);
    if (runs.length) completed++;
    if (runs.some((r) => r.outcome === 'SUCCESS')) survived++;
  }
  return { total: active.length, completed, survived };
}

/** Due-date label plus a tone for colouring: overdue, due within 2 days, later, or no date. */
export function dueStatus(dueAt: Date | null, now = Date.now()): { text: string; tone: 'overdue' | 'soon' | 'later' | 'none' } {
  if (!dueAt) return { text: 'No due date', tone: 'none' };
  const days = Math.ceil((dueAt.getTime() - now) / 86_400_000);
  const date = dueAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (days < 0) return { text: `Overdue · ${date}`, tone: 'overdue' };
  if (days === 0) return { text: 'Due today', tone: 'soon' };
  if (days <= 2) return { text: `Due ${date} · ${days}d left`, tone: 'soon' };
  return { text: `Due ${date}`, tone: 'later' };
}

export function formatDue(dueAt: Date | null, now = Date.now()): { text: string; overdue: boolean } | null {
  if (!dueAt) return null;
  const days = Math.ceil((dueAt.getTime() - now) / 86_400_000);
  const date = dueAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (days < 0) return { text: `Was due ${date}`, overdue: true };
  if (days === 0) return { text: 'Due today', overdue: false };
  return { text: `Due ${date} · ${days} day${days === 1 ? '' : 's'} left`, overdue: false };
}

export interface ClassStats {
  students: number;
  disabled: number;
  runs: number;
  survived: number;
  survivalRate: number | null;
  topFailure: { kind: string; count: number } | null;
  failuresByKind: { kind: string; count: number }[];
}

export function classStats(
  enrollments: { status: 'ACTIVE' | 'DISABLED'; student: { runs: Pick<MissionRun, 'outcome' | 'failureKind'>[] } }[],
): ClassStats {
  const runs = enrollments.flatMap((e) => e.student.runs);
  const survived = runs.filter((r) => r.outcome === 'SUCCESS').length;
  const counts = new Map<string, number>();
  for (const r of runs) if (r.outcome === 'FAILED' && r.failureKind) counts.set(r.failureKind, (counts.get(r.failureKind) ?? 0) + 1);
  const failuresByKind = [...counts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count);
  return {
    students: enrollments.filter((e) => e.status === 'ACTIVE').length,
    disabled: enrollments.filter((e) => e.status === 'DISABLED').length,
    runs: runs.length,
    survived,
    survivalRate: runs.length ? Math.round((survived / runs.length) * 100) : null,
    topFailure: failuresByKind[0] ?? null,
    failuresByKind,
  };
}
