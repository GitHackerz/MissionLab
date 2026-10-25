import Link from 'next/link';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { ForgotPasswordForm } from '@/features/auth/components/AuthForms';

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we’ll send you a link to choose a new password."
      mascot={{ src: '/mascot/fankouch-thinking.webp', width: 458, height: 520, line: 'Forgot it? Happens to every astronaut.' }}
      footer={
        <Link href="/login" className="text-ember hover:underline">
          Back to log in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
