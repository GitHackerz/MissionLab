import { NextResponse, type NextRequest } from 'next/server';
import { GUEST_COOKIE } from '@/config/guest';

// Stamps the start of a guest's trial the first time this browser opens the mission.
// Signed-in users ignore it; the page decides who is a guest after validating the session.
// The request is updated too, so the page sees the same timestamp on this very request.
export function middleware(request: NextRequest) {
  if (request.cookies.has(GUEST_COOKIE)) {
    return NextResponse.next();
  }

  const startedAt = String(Date.now());
  request.cookies.set(GUEST_COOKIE, startedAt);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(GUEST_COOKIE, startedAt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export const config = { matcher: ['/mission'] };
