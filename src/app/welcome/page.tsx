import { redirect } from 'next/navigation';
import { homePathFor, requireUser } from '@/server/auth/session';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { OnboardingForm } from '@/features/auth/components/AuthForms';

export const dynamic = 'force-dynamic';

export default async function WelcomePage() {
  const user = await requireUser();
  if (user.onboardedAt) redirect(homePathFor(user));

  return (
    <AuthShell
      title={`Welcome, ${user.name}!`}
      subtitle="Your email is confirmed. One question before your first mission."
      mascot={{ src: '/mascot/fankouch-celebrating.webp', width: 487, height: 520, line: 'You made it! I’m Fankouch, your mission buddy.' }}
    >
      <OnboardingForm />
    </AuthShell>
  );
}
