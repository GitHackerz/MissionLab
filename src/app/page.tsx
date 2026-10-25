import { getCurrentUser } from '@/server/auth/session';
import { SiteNav } from '@/features/marketing/components/SiteNav';
import { LandingHero } from '@/features/marketing/components/LandingHero';
import { LandingSections, SiteFooter } from '@/features/marketing/components/LandingSections';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const user = await getCurrentUser();
  return (
    <>
      <SiteNav user={user} />
      <main>
        <LandingHero signedIn={!!user} />
        <LandingSections />
      </main>
      <SiteFooter />
    </>
  );
}
