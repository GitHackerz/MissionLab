'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import {
  completeOnboarding,
  forgotPassword,
  logIn,
  resendVerification,
  resetPassword,
  signUp,
  type FormState,
} from '@/server/auth/actions';
import { Field, FormMessage, SubmitButton } from './FormParts';

const initial: FormState = {};

export function SignUpForm() {
  const [state, action] = useActionState(signUp, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <Field name="name" label="Name" autoComplete="given-name" placeholder="What should Fankouch call you?" state={state} />
      <Field name="email" label="Email" type="email" autoComplete="email" state={state} />
      <Field name="password" label="Password" type="password" autoComplete="new-password" hint="At least 8 characters." state={state} />
      <SubmitButton pendingLabel="Creating your account…">Create account</SubmitButton>
    </form>
  );
}

export function LogInForm() {
  const [state, action] = useActionState(logIn, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <Field name="email" label="Email" type="email" autoComplete="email" state={state} />
      <Field name="password" label="Password" type="password" autoComplete="current-password" state={state} />
      <div className="-mt-1 text-right text-sm">
        <Link href="/forgot-password" className="text-ember hover:underline">
          Forgot your password?
        </Link>
      </div>
      <SubmitButton pendingLabel="Logging in…">Log in</SubmitButton>
    </form>
  );
}

export function ResendVerificationForm() {
  const [state, action] = useActionState(resendVerification, initial);
  return (
    <form action={action} className="grid gap-3">
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Sending…">Send a new link</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPassword, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <Field name="email" label="Email" type="email" autoComplete="email" state={state} />
      <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <Field name="password" label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." state={state} />
      <Field name="confirm" label="Repeat new password" type="password" autoComplete="new-password" state={state} />
      <SubmitButton pendingLabel="Saving…">Save new password</SubmitButton>
    </form>
  );
}

export function OnboardingForm() {
  const [state, action] = useActionState(completeOnboarding, initial);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">I’m here as a…</legend>
        {[
          { value: 'STUDENT', title: 'Student', text: 'I want to fly the mission and keep the crew alive.' },
          { value: 'TEACHER', title: 'Teacher', text: 'I want to try the mission my students will play. Class tools come with the pilot.' },
        ].map((o) => (
          <label
            key={o.value}
            className="flex min-h-target cursor-pointer items-start gap-3 rounded-md border border-space-line bg-space p-4 transition has-[:checked]:border-flare has-[:checked]:bg-flare/10"
          >
            <input type="radio" name="role" value={o.value} required className="mt-1 accent-[#fe5319]" />
            <span className="grid gap-0.5">
              <span className="font-display text-lg font-semibold">{o.title}</span>
              <span className="text-sm text-dust">{o.text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <SubmitButton pendingLabel="Preparing your mission…">Start my first mission</SubmitButton>
    </form>
  );
}
