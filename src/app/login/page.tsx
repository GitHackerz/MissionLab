import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser, homePathFor } from '@/server/auth/session';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { LogInForm } from '@/features/auth/components/AuthForms';

export const dynamic = 'force-dynamic';

export default async function LogInPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  return (
    <AuthShell
      title="Welcome back, commander"
      subtitle="Log in to continue your missions."
      mascot={{ src: '/mascot/fankouch-pointing.webp', width: 448, height: 520, line: 'Mission control is this way!' }}
      footer={
        <>
          New to MissionLab?{' '}
          <Link href="/signup" className="text-ember hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LogInForm />
    </AuthShell>
  );
}
