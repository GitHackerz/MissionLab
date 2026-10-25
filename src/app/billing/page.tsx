import Image from 'next/image';
import Link from 'next/link';
import { Check, CheckCircle2 } from 'lucide-react';
import { prisma } from '@/server/db';
import { requireTeacher } from '@/server/auth/session';
import { cancelPlan } from '@/server/billing/actions';
import { getTeacherUsage } from '@/server/billing/entitlements';
import { CURRENCY, PLANS, formatPrice, getPlan } from '@/config/plans';
import { TeacherShell } from '@/features/teacher/components/TeacherShell';

export const dynamic = 'force-dynamic';

function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, (used / max) * 100);
  const full = used >= max;
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-dust">{label}</span>
        <span className="font-data tabular"><b className={full ? 'text-status-warn' : 'text-cream'}>{used}</b><span className="text-dust-2"> / {max}</span></span>
      </div>
      <span className="h-2 rounded-full bg-space-3" aria-hidden>
        <span className={`block h-2 rounded-full ${full ? 'bg-status-warn' : 'bg-flare'}`} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ paid?: string; cancelled?: string }> }) {
  const { paid, cancelled } = await searchParams;
  const teacher = await requireTeacher();
  const [usage, payments] = await Promise.all([
    getTeacherUsage(teacher.id, teacher.plan),
    prisma.payment.findMany({ where: { userId: teacher.id }, orderBy: { createdAt: 'desc' } }),
  ]);
  const plan = getPlan(teacher.plan);
  const fmt = (n: number) => `${CURRENCY.symbol} ${n.toLocaleString('en-US')}`;

  return (
    <TeacherShell name={teacher.name} plan={teacher.plan}>
      <header className="grid gap-2">
        <span className="eyebrow">Plan & billing</span>
        <h1 className="font-display text-4xl font-semibold">Your plan</h1>
      </header>

      {paid && (
        <div role="status" className="flex items-center gap-4 rounded-lg border border-status-ok/40 bg-status-ok/10 p-4">
          <Image src="/mascot/fankouch-celebrating.webp" alt="" width={487} height={520} className="h-16 w-auto" />
          <p className="text-[15px]">
            <b>Payment complete.</b> You’re now on <b>{plan.name}</b>. Receipt <span className="font-data">{paid}</span>. New features are unlocked.
          </p>
        </div>
      )}
      {cancelled && (
        <p role="status" className="rounded-lg border border-space-line bg-space-2 p-4 text-[15px]">
          You’re back on Explorer. Your classes and results are kept; new classes, students and assignments follow the Explorer limits.
        </p>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid gap-5 rounded-lg border border-space-line bg-space-2 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="font-data text-[11px] uppercase tracking-[0.14em] text-dust-2">Current plan</span>
              <h2 className="font-display text-3xl font-semibold">{plan.name}</h2>
              <p className="text-sm text-dust">
                {teacher.planRenewsAt
                  ? `Renews ${teacher.planRenewsAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
                  : 'Free forever'}
              </p>
            </div>
            {plan.id !== 'explorer' && (
              <form action={cancelPlan}>
                <button type="submit" className="min-h-10 rounded-md px-3 text-[13px] text-dust hover:bg-space-3 hover:text-cream">
                  Switch to free plan
                </button>
              </form>
            )}
          </div>
          <div className="grid gap-4">
            <Meter label="Classes" used={usage.classes} max={plan.limits.maxClasses} />
            <Meter label="Active students" used={usage.students} max={plan.limits.maxStudents} />
          </div>
          <ul className="grid gap-1.5 text-sm">
            <li className="flex items-center gap-2"><Check className={`h-4 w-4 ${plan.limits.targetedAssignments ? 'text-status-ok' : 'text-dust-2'}`} aria-hidden /> <span className={plan.limits.targetedAssignments ? '' : 'text-dust-2 line-through'}>Assign to chosen students</span></li>
            <li className="flex items-center gap-2"><Check className={`h-4 w-4 ${plan.limits.insights ? 'text-status-ok' : 'text-dust-2'}`} aria-hidden /> <span className={plan.limits.insights ? '' : 'text-dust-2 line-through'}>Activity insights</span></li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-status-ok" aria-hidden /> {plan.limits.maxAssignmentsPerClass === null ? 'Unlimited assignments' : `${plan.limits.maxAssignmentsPerClass} assignment per class`}</li>
          </ul>
          <p className="text-[12px] text-dust-2">Sample classes don’t count toward your limits.</p>
        </div>

        <div className="grid content-start gap-3 rounded-lg border border-space-line bg-space-2 p-6">
          <span className="font-data text-[11px] uppercase tracking-[0.14em] text-dust-2">{CURRENCY.name} wallet</span>
          <p className="font-data text-4xl font-bold tabular"><span className="text-flare">{CURRENCY.symbol}</span> {teacher.stardust.toLocaleString('en-US')}</p>
          <p className="text-sm text-dust">{CURRENCY.explainer} Every pilot account starts with a grant so you can try a paid plan.</p>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="font-display text-2xl font-semibold">Plans</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => {
            const current = p.id === plan.id;
            return (
              <article key={p.id} className={`grid content-start gap-3 rounded-lg border p-5 ${current ? 'border-flare bg-flare/5' : 'border-space-line bg-space-2'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-semibold">{p.name}</h3>
                  {current && <span className="flex items-center gap-1 font-data text-[11px] uppercase text-flare"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Current</span>}
                </div>
                <p className="font-data text-2xl font-bold tabular">
                  {formatPrice(p.price)}
                  {p.cadence && <span className="ml-1 font-body text-sm font-normal text-dust-2">{p.cadence}</span>}
                </p>
                <ul className="grid gap-1.5 text-[13px] text-dust">
                  {p.features.map((f) => <li key={f}>· {f}</li>)}
                </ul>
                {current ? (
                  <span className="btn min-h-10 border-space-line text-sm text-dust">Your plan</span>
                ) : p.purchasable ? (
                  <Link href={`/billing/checkout?plan=${p.id}`} className={p.highlighted ? 'btn-primary min-h-10 text-sm' : 'btn-secondary min-h-10 text-sm'}>
                    Choose {p.name}
                  </Link>
                ) : p.id === 'explorer' ? (
                  <span className="btn min-h-10 border-space-line text-sm text-dust">Free plan</span>
                ) : (
                  <span className="btn min-h-10 border-space-line text-sm text-dust">Contact us for a quote</span>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="font-display text-2xl font-semibold">Payment history</h2>
        {payments.length === 0 ? (
          <p className="text-dust">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-space-line">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead className="bg-space-2 text-left font-data text-[11px] uppercase tracking-[0.12em] text-dust-2">
                <tr>
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Receipt</th>
                  <th scope="col" className="px-4 py-3">Plan</th>
                  <th scope="col" className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-space-line">
                    <td className="px-4 py-3 text-dust">{p.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3 font-data">{p.receiptNo}</td>
                    <td className="px-4 py-3">{getPlan(p.planId).name}</td>
                    <td className="px-4 py-3 text-right font-data tabular">{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[12px] text-dust-2">All payments are simulated with fictional {CURRENCY.name}. No real money is involved.</p>
      </section>
    </TeacherShell>
  );
}
