'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/server/db';
import { sendPasswordResetEmail, sendVerificationEmail } from '@/server/mail';
import { hashPassword, verifyPassword } from './crypto';
import { createSession, destroySession, getCurrentUser, homePathFor } from './session';
import { consumeToken, issueToken } from './tokens';

export interface FormState {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  notice?: string;
  /** Non-secret values echoed back so the form keeps what was typed (never passwords). */
  values?: Partial<Record<'name' | 'email', string>>;
}

function echo(formData: FormData): FormState['values'] {
  const pick = (k: string) => (typeof formData.get(k) === 'string' ? String(formData.get(k)) : undefined);
  return { name: pick('name'), email: pick('email') };
}

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);
const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Use at most 128 characters.');

function fieldErrors(error: z.ZodError): FormState {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return { fieldErrors: out };
}

async function trySendVerification(userId: string, to: string, name: string): Promise<boolean> {
  try {
    const token = await issueToken(userId, 'EMAIL_VERIFY');
    await sendVerificationEmail(to, name, token);
    return true;
  } catch (err) {
    console.error('Verification email failed', err);
    return false;
  }
}

const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Tell us what to call you.').max(60),
  email,
  password,
});

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ...fieldErrors(parsed.error), values: echo(formData) };
  const { name, email: address, password: plain } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: address } });
  if (existing) {
    return { fieldErrors: { email: 'An account with this email already exists. Log in instead.' }, values: echo(formData) };
  }

  const user = await prisma.user.create({
    data: { name, email: address, passwordHash: await hashPassword(plain) },
  });
  await createSession(user.id);
  const sent = await trySendVerification(user.id, user.email, user.name);
  redirect(`/verify-email?email=${encodeURIComponent(user.email)}${sent ? '' : '&mail=failed'}`);
}

const logInSchema = z.object({ email, password: z.string().min(1, 'Enter your password.') });

export async function logIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = logInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ...fieldErrors(parsed.error), values: echo(formData) };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !valid) {
    // Same message either way so the form doesn't reveal which emails have accounts.
    return { error: 'Email or password is incorrect.', values: echo(formData) };
  }

  await createSession(user.id);
  if (!user.emailVerifiedAt) redirect(`/verify-email?email=${encodeURIComponent(user.email)}`);
  redirect(homePathFor(user));
}

export async function resendVerification(_prev: FormState, _formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Log in again to resend the email.' };
  if (user.emailVerifiedAt) redirect('/welcome');
  const sent = await trySendVerification(user.id, user.email, user.name);
  return sent
    ? { notice: `New link sent to ${user.email}.` }
    : { error: 'We couldn’t send the email. Check that Mailpit is running (pnpm db:up) and try again.' };
}

export async function forgotPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ...fieldErrors(parsed.error), values: echo(formData) };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    try {
      const token = await issueToken(user.id, 'PASSWORD_RESET');
      await sendPasswordResetEmail(user.email, user.name, token);
    } catch (err) {
      console.error('Password reset email failed', err);
    }
  }
  return { notice: 'If an account uses that email, a reset link is on its way. It expires in 1 hour.' };
}

const resetSchema = z
  .object({ token: z.string().min(1), password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'The passwords don’t match.', path: ['confirm'] });

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);

  const userId = await consumeToken(parsed.data.token, 'PASSWORD_RESET');
  if (!userId) return { error: 'This reset link is invalid or has expired. Ask for a new one.' };

  const user = await prisma.user.update({
    where: { id: userId },
    // The reset email proves inbox ownership, so the address counts as verified.
    data: { passwordHash: await hashPassword(parsed.data.password), emailVerifiedAt: new Date() },
  });
  await prisma.session.deleteMany({ where: { userId } });
  await createSession(userId);
  redirect(homePathFor(user));
}

export async function completeOnboarding(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const parsed = z.object({ role: z.enum(['STUDENT', 'TEACHER']) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Choose student or teacher to continue.' };

  await prisma.user.update({
    where: { id: user.id },
    data: { role: parsed.data.role, onboardedAt: new Date() },
  });
  redirect(parsed.data.role === 'TEACHER' ? '/teacher' : '/mission?tour=1');
}

export async function logOut(): Promise<void> {
  await destroySession();
  redirect('/');
}
