import { FAILURE_LABEL } from '../format';

export function OutcomeChip({ outcome, finalHour, kind, compact }: { outcome: 'SUCCESS' | 'FAILED'; finalHour: number; kind: string | null; compact?: boolean }) {
  return outcome === 'SUCCESS' ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-status-ok/40 bg-status-ok/10 px-2.5 py-0.5 font-data text-[12px] font-semibold text-status-ok">
      ✓ Survived H{finalHour}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-status-crit/50 bg-status-crit/10 px-2.5 py-0.5 font-data text-[12px] font-semibold text-status-crit">
      ✕ Ended H{finalHour}
      {kind && !compact && <span className="font-body font-normal text-dust">· {FAILURE_LABEL[kind] ?? kind}</span>}
    </span>
  );
}

export function StatusPill({ status }: { status: 'ACTIVE' | 'DISABLED' }) {
  return status === 'DISABLED' ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-status-offline/50 px-2.5 py-0.5 font-data text-[12px] text-status-offline">⏻ Disabled</span>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-status-ok/40 px-2.5 py-0.5 font-data text-[12px] text-status-ok">● Active</span>
  );
}

export type DueTone = 'overdue' | 'soon' | 'later' | 'none';

export function DuePill({ text, tone }: { text: string; tone: DueTone }) {
  const cls =
    tone === 'overdue'
      ? 'border-status-crit/50 bg-status-crit/10 text-status-crit'
      : tone === 'soon'
        ? 'border-status-warn/50 bg-status-warn/10 text-status-warn'
        : 'border-space-line text-dust';
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 font-data text-[12px] ${cls}`}>{text}</span>;
}

export function Initials({ name, muted }: { name: string; muted?: boolean }) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return (
    <span
      aria-hidden
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-data text-[13px] font-bold ${muted ? 'bg-space-3 text-dust-2' : 'bg-flare/15 text-flare'}`}
    >
      {letters}
    </span>
  );
}

export function MiniProgress({ done, total }: { done: number; total: number }) {
  if (!total) return <span className="text-[13px] text-dust-2">—</span>;
  return (
    <span className="grid min-w-[90px] gap-1">
      <span className="font-data text-[12px] tabular">
        <b className={done === total ? 'text-status-ok' : 'text-cream'}>{done}</b>
        <span className="text-dust-2">/{total} done</span>
      </span>
      <span className="h-1.5 rounded-full bg-space-3" aria-hidden>
        <span className={`block h-1.5 rounded-full ${done === total ? 'bg-status-ok' : 'bg-flare'}`} style={{ width: `${(done / total) * 100}%` }} />
      </span>
    </span>
  );
}
