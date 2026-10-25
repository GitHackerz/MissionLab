'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { GUEST_MINUTES } from '@/config/guest';
import { useMissionStore } from '@/state/missionStore';

function format(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Guest countdown chip for the mission header, plus the lock screen when time runs out. */
export function GuestAccess({ deadline }: { deadline: number }) {
  const [now, setNow] = useState<number | null>(null);
  const setAutoRunning = useMissionStore((s) => s.setAutoRunning);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Before mount the clock isn't read yet (keeps server and client HTML identical).
  const remaining = now === null ? Number.POSITIVE_INFINITY : deadline - now;
  const expired = remaining <= 0;
  const low = remaining <= 60_000;

  useEffect(() => {
    if (expired) setAutoRunning(false);
  }, [expired, setAutoRunning]);

  return (
    <>
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-1.5 rounded px-2 py-1 font-data tabular ${
            low ? 'bg-status-warn/15 text-status-warn' : 'bg-space-3 text-dust'
          }`}
          aria-label={`Guest time left: ${format(remaining)}`}
        >
          <Clock className="h-3.5 w-3.5" aria-hidden />
          Guest · {now === null ? `${GUEST_MINUTES}:00` : format(remaining)}
        </span>
        <Link href="/signup" className="rounded bg-flare px-2.5 py-1 font-semibold text-flare-ink hover:bg-flare-hover">
          Save progress
        </Link>
      </div>

      {expired && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(8,5,5,.82)] px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="guest-end-title">
          <div className="grid w-full max-w-md justify-items-center gap-4 rounded-lg border border-space-line bg-space-2 p-8 text-center shadow-2xl">
            <Image src="/mascot/fankouch-sad.webp" alt="" width={352} height={520} className="h-36 w-auto" />
            <h2 id="guest-end-title" className="font-display text-2xl font-semibold">
              Your {GUEST_MINUTES}-minute guest mission is over
            </h2>
            <p className="text-[15px] text-dust">
              Create a free account to keep playing, finish the 72 hours and see your Mission Autopsy.
            </p>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Link href="/signup" className="btn-primary flex-1">
                Create free account
              </Link>
              <Link href="/login" className="btn-secondary flex-1">
                Log in
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
