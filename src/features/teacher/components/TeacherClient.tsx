'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Check, Copy, Lock, Plus, X } from 'lucide-react';
import {
  createAssignment,
  deleteAssignment,
  createClassroom,
  joinClassroom,
  removeEnrollment,
  setEnrollmentStatus,
  type ClassFormState,
} from '@/server/classes/actions';
import { MISSIONS } from '@/config/missions';

function Pending({ idle, busy, className }: { idle: string; busy: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? busy : idle}
    </button>
  );
}

function Message({ state }: { state: ClassFormState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-status-crit">
        {state.error}{' '}
        {state.upgrade && (
          <Link href="/billing" className="font-semibold text-ember underline-offset-2 hover:underline">
            See plans →
          </Link>
        )}
      </p>
    );
  }
  if (state.notice) return <p role="status" className="text-sm text-status-ok">{state.notice}</p>;
  return null;
}

export function CreateClassForm() {
  const [state, action] = useActionState(createClassroom, {});
  return (
    <form action={action} className="grid gap-2">
      <label htmlFor="class-name" className="text-sm font-medium">New class</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="class-name" name="name" required maxLength={60} placeholder="e.g. Physics · Period 3" className="field sm:flex-1" />
        <Pending idle="Create class" busy="Creating…" className="btn-primary" />
      </div>
      <Message state={state} />
    </form>
  );
}

export function AssignMissionForm({ classroomId, students, canTarget = true }: { classroomId: string; students: { id: string; name: string }[]; canTarget?: boolean }) {
  const [state, action] = useActionState(createAssignment, {});
  const [audience, setAudience] = useState<'class' | 'students'>('class');
  const [picked, setPicked] = useState<string[]>([]);
  const firstAvailable = MISSIONS.find((m) => m.status === 'available');
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="classroomId" value={classroomId} />
      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <div className="grid gap-1.5">
          <label htmlFor="assign-mission" className="text-sm font-medium">Mission</label>
          <select id="assign-mission" name="missionId" required defaultValue={firstAvailable?.id ?? ''} className="field">
            {MISSIONS.map((m) => (
              <option key={m.id} value={m.id} disabled={m.status !== 'available'}>
                {m.number} · {m.title}
                {m.status !== 'available' ? ' (coming soon)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="assign-due" className="text-sm font-medium">Due date <span className="text-dust-2">(optional)</span></label>
          <input id="assign-due" name="dueAt" type="date" className="field" />
        </div>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-1.5 text-sm font-medium">Assign to</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: 'class', label: 'Whole class', hint: 'Every student, including those who join later' },
              { value: 'students', label: 'Choose students', hint: canTarget ? 'Only the students you tick' : 'Included in Classroom and Academy plans' },
            ] as const
          ).map((o) => {
            const locked = o.value === 'students' && !canTarget;
            return (
              <label
                key={o.value}
                className={`flex min-h-target flex-1 items-start gap-3 rounded-md border border-space-line bg-space p-3 has-[:checked]:border-flare has-[:checked]:bg-flare/10 ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <input type="radio" name="audience" value={o.value} checked={audience === o.value} disabled={locked} onChange={() => setAudience(o.value)} className="mt-1 accent-[#fe5319]" />
                <span className="grid">
                  <span className="flex items-center gap-1.5 font-semibold">
                    {o.label}
                    {locked && <Lock className="h-3.5 w-3.5 text-dust" aria-label="Locked on your plan" />}
                  </span>
                  <span className="text-[13px] text-dust">
                    {o.hint}
                    {locked && (
                      <>
                        {' · '}
                        <Link href="/billing" className="text-ember hover:underline">Upgrade</Link>
                      </>
                    )}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {audience === 'students' &&
          (students.length === 0 ? (
            <p className="text-sm text-dust">No active students in this class yet.</p>
          ) : (
            <div className="grid gap-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-dust">{picked.length} of {students.length} selected</span>
                <span className="flex gap-3">
                  <button type="button" onClick={() => setPicked(students.map((s) => s.id))} className="text-ember hover:underline">Select all</button>
                  <button type="button" onClick={() => setPicked([])} className="text-dust hover:text-cream">Clear</button>
                </span>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {students.map((s) => (
                  <li key={s.id}>
                    <label className="flex min-h-target cursor-pointer items-center gap-3 rounded-md border border-space-line bg-space px-3 has-[:checked]:border-ember">
                      <input type="checkbox" name="studentIds" value={s.id} checked={picked.includes(s.id)} onChange={() => toggle(s.id)} className="accent-[#fe5319]" />
                      {s.name}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </fieldset>
      <div className="grid gap-1.5">
        <label htmlFor="assign-note" className="text-sm font-medium">Note for students <span className="text-dust-2">(optional)</span></label>
        <input id="assign-note" name="note" maxLength={200} placeholder="e.g. Survive 72 hours, then rewind once and compare." className="field" />
      </div>
      <Message state={state} />
      <div>
        <Pending idle="Assign mission" busy="Assigning…" className="btn-primary" />
      </div>
    </form>
  );
}

/** "New assignment" button that opens the form in place; open by default when nothing is assigned yet. */
export function NewAssignmentPanel({ classroomId, students, startOpen, canTarget }: { classroomId: string; students: { id: string; name: string }[]; startOpen: boolean; canTarget: boolean }) {
  const [open, setOpen] = useState(startOpen);
  if (!open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)} className="btn-primary">
          <Plus className="h-4 w-4" aria-hidden /> New assignment
        </button>
      </div>
    );
  }
  return (
    <section aria-label="New assignment" className="grid gap-4 rounded-lg border border-flare/50 bg-space-2 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold">New assignment</h3>
        <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-md text-dust hover:bg-space-3 hover:text-cream" aria-label="Close">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <AssignMissionForm classroomId={classroomId} students={students} canTarget={canTarget} />
    </section>
  );
}

export function UnassignButton({ assignmentId, title }: { assignmentId: string; title: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="min-h-9 rounded-md px-3 text-[13px] text-dust hover:bg-status-crit/10 hover:text-status-crit">
        Unassign
      </button>
    );
  }
  return (
    <form action={deleteAssignment} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <span className="text-[13px] text-dust">Unassign {title}?</span>
      <Pending idle="Unassign" busy="Removing…" className="min-h-9 rounded-md border border-status-crit/60 px-3 text-[13px] font-semibold text-status-crit hover:bg-status-crit/10" />
      <button type="button" onClick={() => setConfirming(false)} className="min-h-9 rounded-md px-3 text-[13px] text-dust hover:bg-space-3 hover:text-cream">
        Cancel
      </button>
    </form>
  );
}

export function JoinClassForm() {
  const [state, action] = useActionState(joinClassroom, {});
  return (
    <form action={action} className="grid gap-3">
      <label htmlFor="join-code" className="text-sm font-medium">Class code</label>
      <input id="join-code" name="code" required placeholder="RED-4821" autoComplete="off" className="field font-data uppercase tracking-widest" />
      <Message state={state} />
      <Pending idle="Join class" busy="Joining…" className="btn-primary w-full" />
    </form>
  );
}

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(code).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {},
        );
      }}
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-space-line bg-space-3 px-3 font-data text-lg font-bold tracking-widest text-cream hover:border-ember"
      aria-label={`Copy class code ${code}`}
    >
      {code}
      {copied ? <Check className="h-4 w-4 text-status-ok" aria-hidden /> : <Copy className="h-4 w-4 text-dust" aria-hidden />}
    </button>
  );
}

export function StudentActions({ enrollmentId, name, status }: { enrollmentId: string; name: string; status: 'ACTIVE' | 'DISABLED' }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <form action={removeEnrollment} className="flex flex-wrap items-center justify-end gap-2">
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
        <span className="text-[13px] text-dust">Remove {name} from this class?</span>
        <Pending idle="Remove" busy="Removing…" className="min-h-9 rounded-md border border-status-crit/60 px-3 text-[13px] font-semibold text-status-crit hover:bg-status-crit/10" />
        <button type="button" onClick={() => setConfirming(false)} className="min-h-9 rounded-md px-3 text-[13px] text-dust hover:bg-space-3 hover:text-cream">
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <form action={setEnrollmentStatus}>
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
        <input type="hidden" name="status" value={status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'} />
        <Pending
          idle={status === 'ACTIVE' ? 'Disable' : 'Enable'}
          busy="Saving…"
          className="min-h-9 rounded-md border border-space-line bg-space-3 px-3 text-[13px] font-semibold hover:border-ember"
        />
      </form>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-9 rounded-md px-3 text-[13px] text-dust hover:bg-status-crit/10 hover:text-status-crit"
      >
        Remove
      </button>
    </div>
  );
}
