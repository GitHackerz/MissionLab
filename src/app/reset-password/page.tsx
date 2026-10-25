import Link from 'next/link';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { ResetPasswordForm } from '@/features/auth/components/AuthForms';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell
      title="Choose a new password"
      subtitle={token ? 'Pick something you’ll remember. You’ll be logged in right after.' : 'This page needs the link from your reset email.'}
      mascot={{ src: '/mascot/fankouch-working.webp', width: 520, height: 424, line: 'New password, coming right up.' }}
      footer={
        <Link href="/forgot-password" className="text-ember hover:underline">
          Ask for a new reset link
        </Link>
      }
    >
      {token ? <ResetPasswordForm token={token} /> : null}
    </AuthShell>
  );
}
