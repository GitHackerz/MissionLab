import Image from 'next/image';
import Link from 'next/link';
import { GUEST_MINUTES } from '@/config/guest';

interface AuthShellProps {
  title: string;
  subtitle?: React.ReactNode;
  mascot: { src: string; width: number; height: number; line: string };
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({ title, subtitle, mascot, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-semibold">
          <Image src="/brand/logo-mark.png" alt="" width={54} height={30} className="h-[30px] w-auto" />
          <span>
            Mission<span className="text-flare">Lab</span>
          </span>
        </Link>
        <Link href="/mission" className="ml-auto text-sm text-dust hover:text-cream">
          Try as guest ({GUEST_MINUTES} min) →
        </Link>
      </header>
      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-10 sm:px-6 md:grid-cols-[1fr_1.1fr]">
        <div className="hidden flex-col items-center gap-5 md:flex">
          <div className="relative max-w-[280px] rounded-[14px] bg-cream px-4 py-3 text-[15px] font-medium text-flare-ink shadow-xl">
            {mascot.line}
            <span className="absolute -bottom-1.5 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-sm bg-cream" />
          </div>
          <Image
            src={mascot.src}
            alt=""
            width={mascot.width}
            height={mascot.height}
            className="h-72 w-auto animate-bob drop-shadow-[0_18px_28px_rgba(0,0,0,.5)]"
            priority
          />
        </div>
        <section className="w-full rounded-lg border border-space-line bg-space-2 p-6 sm:p-8">
          <h1 className="font-display text-3xl font-semibold">{title}</h1>
          {subtitle && <div className="mt-2 text-[15px] text-dust">{subtitle}</div>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 border-t border-space-line pt-5 text-sm text-dust">{footer}</div>}
        </section>
      </main>
    </div>
  );
}
