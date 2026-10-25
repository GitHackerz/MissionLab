'use client';

import { useFormStatus } from 'react-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { FormState } from '@/server/auth/actions';

interface FieldProps {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  state: FormState;
  defaultValue?: string;
}

export function Field({ name, label, type = 'text', autoComplete, placeholder, hint, state, defaultValue }: FieldProps) {
  const error = state.fieldErrors?.[name];
  const id = `field-${name}`;
  const echoed = type === 'password' ? undefined : state.values?.[name as 'name' | 'email'];
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={echoed ?? defaultValue}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`field ${error ? 'border-status-crit' : ''}`}
        required
      />
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-status-crit">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-[13px] text-dust-2">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function SubmitButton({ children, pendingLabel }: { children: React.ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-md border border-status-crit/50 bg-status-crit/10 px-3 py-2.5 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-crit" aria-hidden />
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-md border border-status-ok/40 bg-status-ok/10 px-3 py-2.5 text-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-ok" aria-hidden />
        {state.notice}
      </p>
    );
  }
  return null;
}
