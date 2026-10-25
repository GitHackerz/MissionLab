import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check, ShieldCheck } from 'lucide-react';
import { requireTeacher } from '@/server/auth/session';
import { CURRENCY, getPlan, PLANS } from '@/config/plans';
import { TeacherShell } from '@/features/teacher/components/TeacherShell';
import { CheckoutForm } from '@/features/billing/components/CheckoutForm';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: planId } = await searchParams;
  const teacher = await requireTeacher();
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan || !plan.purchasable || plan.price === null) redirect('/billing');

  const current = getPlan(teacher.plan);
  const price = plan.price;
  const after = teacher.stardust - price;
  const enough = after >= 0;
  const same = current.id === plan.id;
  const fmt = (n: number) => `${CURRENCY.symbol} ${n.toLocaleString('en-US')}`;

  return (
    <TeacherShell name={teacher.name} plan={teacher.plan}>
      <Link href="/billing" className="text-sm text-dust hover:text-cream">← Plans & billing</Link>
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <section className="grid content-start gap-5">
          <div className="grid gap-2">
            <span className="eyebrow">Checkout</span>
            <h1 className="font-display text-4xl font-semibold">{plan.name} plan</h1>
            <p className="text-dust">{plan.description}</p>
          </div>
          <ul className="grid gap-2 rounded-lg border border-space-line bg-space-2 p-5">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[15px]">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-ok" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-4">
            <Image src="/mascot/fankouch-working.webp" alt="" width={520} height={424} className="h-24 w-auto" />
            <p className="text-sm text-dust">
              Your current plan is <b className="text-cream">{current.name}</b>. The new plan starts right away and renews in a year.
            </p>
          </div>
        </section>

        <aside className="grid content-start gap-4 rounded-lg border border-flare/50 bg-space-2 p-6">
          <h2 className="font-display text-xl font-semibold">Order summary</h2>
          <dl className="grid gap-2 text-[15px]">
            <div className="flex justify-between"><dt className="text-dust">{plan.name} · {plan.cadence}</dt><dd className="font-data tabular">{fmt(price)}</dd></div>
            <div className="flex justify-between border-t border-space-line pt-2"><dt className="text-dust">Your {CURRENCY.name} wallet</dt><dd className="font-data tabular">{fmt(teacher.stardust)}</dd></div>
            <div className="flex justify-between"><dt className="text-dust">Balance after payment</dt><dd className={`font-data font-bold tabular ${enough ? 'text-cream' : 'text-status-crit'}`}>{fmt(after)}</dd></div>
          </dl>
          <CheckoutForm
            planId={plan.id}
            disabled={same || !enough}
            label={same ? 'This is your current plan' : enough ? `Pay ${fmt(price)} with ${CURRENCY.name}` : `Not enough ${CURRENCY.name}`}
          />
          <p className="flex items-start gap-2 rounded-md bg-space px-3 py-2.5 text-[13px] text-dust">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-status-repair" aria-hidden />
            <span>
              <b className="text-cream">Simulated payment.</b> {CURRENCY.name} is MissionLab’s fictional pilot currency. No card details are collected and
              no real money is charged.
            </span>
          </p>
        </aside>
      </div>
    </TeacherShell>
  );
}
