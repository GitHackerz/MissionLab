import Image from 'next/image';
import Link from 'next/link';
import type { SessionUser } from '@/server/auth/session';
import { logOut } from '@/server/auth/actions';

const LINKS = [
  { href: '/#how', label: 'How it works' },
  { href: '/#teachers', label: 'For teachers' },
  { href: '/#plans', label: 'Plans' },
  { href: '/#faq', label: 'FAQ' },
];

export function SiteNav({ user }: { user: SessionUser | null }) {
  return (
    <nav aria-label="Main" className="sticky top-0 z-30 border-b border-space-line bg-space/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 font-display text-lg font-semibold">
          <Image src="/brand/logo-mark.png" alt="" width={54} height={30} className="h-[30px] w-auto" />
          <span>
            Mission<span className="text-flare">Lab</span>
          </span>
        </Link>
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="rounded-sm px-3 py-2 text-sm text-dust hover:bg-space-3 hover:text-cream">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-sm text-dust sm:inline">Hi, {user.name}</span>
              <form action={logOut}>
                <button type="submit" className="btn-ghost min-h-10 px-3 text-sm">
                  Log out
                </button>
              </form>
              <Link href={user.role === 'TEACHER' ? '/teacher' : '/dashboard'} className="btn-primary min-h-10 px-4 text-sm">
                {user.role === 'TEACHER' ? 'Teacher dashboard' : 'My dashboard'}
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost min-h-10 px-3 text-sm">
                Log in
              </Link>
              <Link href="/signup" className="btn-primary min-h-10 px-4 text-sm">
                Sign up free
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
