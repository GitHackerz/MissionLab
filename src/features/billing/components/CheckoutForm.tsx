'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { purchasePlan, type CheckoutState } from '@/server/billing/actions';

function PayButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary min-h-12 w-full text-base">
      {pending ? 'Processing simulated payment…' : label}
    </button>
  );
}

export function CheckoutForm({ planId, label, disabled }: { planId: string; label: string; disabled?: boolean }) {
  const [state, action] = useActionState<CheckoutState, FormData>(purchasePlan, {});
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="planId" value={planId} />
      {state.error && (
        <p role="alert" className="rounded-md border border-status-crit/50 bg-status-crit/10 px-3 py-2.5 text-sm">
          {state.error}
        </p>
      )}
      {disabled ? (
        <button type="button" disabled className="btn min-h-12 w-full border-space-line bg-space-3 text-dust">
          {label}
        </button>
      ) : (
        <PayButton label={label} />
      )}
    </form>
  );
}
