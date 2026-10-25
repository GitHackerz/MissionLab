import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { ResendVerificationForm } from '@/features/auth/components/AuthForms';

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; status?: string; mail?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user?.emailVerifiedAt) redirect(user.onboardedAt ? '/mission' : '/welcome');

  if (params.status === 'invalid') {
    return (
      <AuthShell
        title="That link didn’t work"
        subtitle="The confirmation link is invalid, already used, or older than 24 hours."
        mascot={{ src: '/mascot/fankouch-thinking.webp', width: 458, height: 520, line: 'Hmm, that link has expired.' }}
        footer={
          <Link href="/login" className="text-ember hover:underline">
            Log in to get a new link
          </Link>
        }
      >
        {user ? <ResendVerificationForm /> : null}
      </AuthShell>
    );
  }

  const email = user?.email ?? params.email;
  return (
    <AuthShell
      title="Check your inbox"
      subtitle={
        <>
          We sent a confirmation link to <b className="text-cream">{email ?? 'your email'}</b>. Open it to activate your account.
        </>
      }
      mascot={{ src: '/mascot/fankouch-working.webp', width: 520, height: 424, line: 'Sending your confirmation email…' }}
      footer={
        <>
          Wrong address?{' '}
          <Link href="/signup" className="text-ember hover:underline">
            Sign up again
          </Link>{' '}
          · or{' '}
          <Link href="/mission" className="text-ember hover:underline">
            play 10 minutes as guest
          </Link>
        </>
      }
    >
      <div className="grid gap-4">
        {params.mail === 'failed' && (
          <p role="alert" className="rounded-md border border-status-warn/50 bg-status-warn/10 px-3 py-2.5 text-sm">
            Your account was created, but the email couldn’t be sent. Make sure the mail server is running, then send a new link.
          </p>
        )}
        {user ? (
          <ResendVerificationForm />
        ) : (
          <p className="text-sm text-dust">
            <Link href="/login" className="text-ember hover:underline">
              Log in
            </Link>{' '}
            to resend the link.
          </p>
        )}
      </div>
    </AuthShell>
  );
}
