import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { User } from '@prisma/client';
import { prisma } from '@/server/db';
import { SESSION_COOKIE } from '@/config/guest';
import { generateToken, hashToken } from './crypto';

const SESSION_DAYS = 30;

export type SessionUser = Pick<User, 'id' | 'email' | 'name' | 'role' | 'emailVerifiedAt' | 'onboardedAt' | 'plan' | 'planRenewsAt' | 'stardust'>;

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

/** Current signed-in user, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        user: {
          select: { id: true, email: true, name: true, role: true, emailVerifiedAt: true, onboardedAt: true, plan: true, planRenewsAt: true, stardust: true },
        },
      },
    });
    if (!session || session.expiresAt < new Date()) return null;
    return session.user;
  } catch (err) {
    // Database unreachable: treat as signed out so guest play and the landing page keep working.
    console.error('Session lookup failed', err);
    return null;
  }
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.emailVerifiedAt) redirect(`/verify-email?email=${encodeURIComponent(user.email)}`);
  return user;
}

export async function requireTeacher(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'TEACHER') redirect('/mission');
  return user;
}

/** Where a signed-in user lands after login, verification or onboarding. */
export function homePathFor(user: Pick<SessionUser, 'role' | 'onboardedAt'>): string {
  if (!user.onboardedAt) return '/welcome';
  return user.role === 'TEACHER' ? '/teacher' : '/dashboard';
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}
