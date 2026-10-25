'use server';

import { randomBytes } from 'crypto';
import { redirect } from 'next/navigation';
import { prisma } from '@/server/db';
import { requireTeacher } from '@/server/auth/session';
import { getPlan, CURRENCY } from '@/config/plans';
import { getTeacherUsage } from './entitlements';

export interface CheckoutState {
  error?: string;
}

function receiptNumber(): string {
  return `ML-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

/**
 * Simulated purchase: deducts fictional Stardust and activates the plan for a year.
 * No card data, no external payment provider, no real money.
 */
export async function purchasePlan(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const teacher = await requireTeacher();
  const plan = getPlan(String(formData.get('planId') ?? ''));
  if (!plan.purchasable || plan.price === null) return { error: `${plan.name} is a custom plan. Contact us for a quote.` };
  if (plan.id === teacher.plan) return { error: `You’re already on ${plan.name}.` };

  // Don't let a downgrade strand a teacher above the new plan's limits.
  const usage = await getTeacherUsage(teacher.id, teacher.plan);
  if (usage.classes > plan.limits.maxClasses || usage.students > plan.limits.maxStudents) {
    return {
      error: `${plan.name} allows ${plan.limits.maxClasses} class${plan.limits.maxClasses === 1 ? '' : 'es'} and ${plan.limits.maxStudents} students. You currently have ${usage.classes} and ${usage.students}.`,
    };
  }

  const receiptNo = receiptNumber();
  try {
    await prisma.$transaction(async (tx) => {
      // Conditional decrement: fails cleanly if the balance changed or is too low.
      const charged = await tx.user.updateMany({
        where: { id: teacher.id, stardust: { gte: plan.price! } },
        data: {
          stardust: { decrement: plan.price! },
          plan: plan.id,
          planRenewsAt: new Date(Date.now() + 365 * 24 * 3_600_000),
        },
      });
      if (charged.count !== 1) throw new Error('INSUFFICIENT');
      await tx.payment.create({ data: { receiptNo, userId: teacher.id, planId: plan.id, amount: plan.price!, currency: CURRENCY.code } });
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'INSUFFICIENT') {
      return { error: `Not enough ${CURRENCY.name}. ${plan.name} costs ${CURRENCY.symbol} ${plan.price.toLocaleString('en-US')}.` };
    }
    throw err;
  }
  redirect(`/billing?paid=${receiptNo}`);
}

/** Back to the free plan. Existing classes and results are kept; only new actions are limited. */
export async function cancelPlan(): Promise<void> {
  const teacher = await requireTeacher();
  await prisma.user.update({ where: { id: teacher.id }, data: { plan: 'explorer', planRenewsAt: null } });
  redirect('/billing?cancelled=1');
}
