import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/server/db';
import { consumeToken } from '@/server/auth/tokens';
import { createSession, homePathFor } from '@/server/auth/session';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const userId = token ? await consumeToken(token, 'EMAIL_VERIFY') : null;

  if (!userId) {
    return NextResponse.redirect(new URL('/verify-email?status=invalid', request.url));
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date() },
  });
  // Clicking the link from the inbox signs the user in on that device.
  await createSession(user.id);
  return NextResponse.redirect(new URL(homePathFor(user), request.url));
}
