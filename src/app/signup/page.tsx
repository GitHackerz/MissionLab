import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser, homePathFor } from '@/server/auth/session';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { SignUpForm } from '@/features/auth/components/AuthForms';

export const dynamic = 'force-dynamic';

export default async function SignUpPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  return (
    <AuthShell
      title="Create your account"
      subtitle="Free for learners. Your progress stays with your account."
      mascot={{ src: '/mascot/fankouch-wave.webp', width: 391, height: 520, line: 'Welcome aboard! Let’s get you a mission badge.' }}
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="text-ember hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
