'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { AlertTriangle, Search } from 'lucide-react';
import { Initials, MiniProgress, OutcomeChip, StatusPill } from './Chips';
import { StudentActions } from './TeacherClient';

export interface StudentRow {
  enrollmentId: string;
  name: string;
  email: string | null;
  isSample: boolean;
  status: 'ACTIVE' | 'DISABLED';
  missions: number;
  best: string;
  last: { outcome: 'SUCCESS' | 'FAILED'; finalHour: number; kind: string | null; ago: string } | null;
  lastActiveAt: number;
  assignedDone: number;
  assignedTotal: number;
  overdue: number;
}

type Filter = 'all' | 'active' | 'disabled';
type Sort = 'name' | 'recent' | 'attention';

function needsAttention(s: StudentRow) {
  return s.status === 'ACTIVE' && (s.overdue > 0 || s.last?.outcome === 'FAILED');
}

export function StudentsPanel({ rows, joinCode }: { rows: StudentRow[]; joinCode: string }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('name');

  const counts = {
    all: rows.length,
    active: rows.filter((r) => r.status === 'ACTIVE').length,
    disabled: rows.filter((r) => r.status === 'DISABLED').length,
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (filter === 'all' ? true : filter === 'active' ? r.status === 'ACTIVE' : r.status === 'DISABLED'))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === 'recent') return b.lastActiveAt - a.lastActiveAt;
        if (sort === 'attention') return Number(needsAttention(b)) - Number(needsAttention(a)) || b.overdue - a.overdue || a.name.localeCompare(b.name);
        return a.name.localeCompare(b.name);
      });
  }, [rows, query, filter, sort]);

  if (rows.length === 0) {
    return (
      <div className="grid justify-items-center gap-3 rounded-lg border border-dashed border-space-line p-10 text-center">
        <Image src="/mascot/fankouch-wave.webp" alt="" width={391} height={520} className="h-28 w-auto" />
        <h3 className="font-display text-xl font-semibold">No students yet</h3>
        <p className="max-w-md text-dust">
          Share the code <b className="font-data text-cream">{joinCode}</b>. Students sign up, then enter it at <b className="text-cream">/join</b>.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search students</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dust-2" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            className="field pl-9"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Filter by status" className="inline-flex overflow-hidden rounded-md border border-space-line">
            {(['all', 'active', 'disabled'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`min-h-10 px-3 text-[13px] capitalize transition ${filter === f ? 'bg-flare font-semibold text-flare-ink' : 'bg-space-2 text-dust hover:text-cream'}`}
              >
                {f} <span className="font-data opacity-80">{counts[f]}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[13px] text-dust">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="field min-h-10 w-auto py-0 text-[13px]">
              <option value="name">Name A–Z</option>
              <option value="recent">Last active</option>
              <option value="attention">Needs attention first</option>
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-space-line">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="sticky top-0 bg-space-2 text-left font-data text-[11px] uppercase tracking-[0.12em] text-dust-2">
            <tr>
              <th scope="col" className="px-4 py-3">Student</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Assignments</th>
              <th scope="col" className="px-4 py-3 text-right">Missions</th>
              <th scope="col" className="px-4 py-3">Best result</th>
              <th scope="col" className="px-4 py-3">Last mission</th>
              <th scope="col" className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => {
              const disabled = s.status === 'DISABLED';
              const attention = needsAttention(s);
              return (
                <tr key={s.enrollmentId} className={`border-t border-space-line transition hover:bg-space-2/60 ${disabled ? 'text-dust' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Initials name={s.name} muted={disabled} />
                      <div className="grid">
                        <span className="flex items-center gap-2 font-semibold">
                          {s.name}
                          {attention && (
                            <span title={s.overdue ? `${s.overdue} overdue` : 'Last mission ended early'}>
                              <AlertTriangle className="h-3.5 w-3.5 text-status-warn" aria-label="Needs attention" />
                            </span>
                          )}
                        </span>
                        <span className="text-[12px] text-dust-2">{s.isSample ? 'Sample student' : s.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusPill status={s.status} /></td>
                  <td className="px-4 py-3">
                    <div className="grid gap-1">
                      <MiniProgress done={s.assignedDone} total={s.assignedTotal} />
                      {s.overdue > 0 && <span className="text-[12px] text-status-crit">{s.overdue} overdue</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-data tabular">{s.missions}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{s.best}</td>
                  <td className="px-4 py-3">
                    {s.last ? (
                      <div className="grid justify-items-start gap-1">
                        <OutcomeChip outcome={s.last.outcome} finalHour={s.last.finalHour} kind={s.last.kind} compact />
                        <span className="text-[12px] text-dust-2">{s.last.ago}</span>
                      </div>
                    ) : (
                      <span className="text-dust-2">Not played yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StudentActions enrollmentId={s.enrollmentId} name={s.name} status={s.status} />
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-dust">
                  No students match.{' '}
                  <button type="button" className="text-ember hover:underline" onClick={() => { setQuery(''); setFilter('all'); }}>
                    Clear filters
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-dust-2">
        <b className="text-dust">Disable</b> pauses mission access and keeps results. <b className="text-dust">Remove</b> takes the student out of this
        class; their account stays. <AlertTriangle className="inline h-3.5 w-3.5 text-status-warn" aria-hidden /> = overdue work or last mission ended early.
      </p>
    </div>
  );
}
