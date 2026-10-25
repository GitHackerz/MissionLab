import Image from 'next/image';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { CURRENCY, PLANS, formatPrice } from '@/config/plans';
import { GUEST_MINUTES } from '@/config/guest';

const STEPS = [
  { tag: '01 · Decide', title: 'Make the call', text: 'A dust storm cuts solar power from 10 kW to 4 kW. Keep the greenhouse lit, or save the battery?' },
  { tag: '02 · Watch', title: 'Advance time', text: 'Every simulated hour the battery, water and oxygen change. The 3D habitat shows it.' },
  { tag: '03 · Understand', title: 'Read the autopsy', text: 'When the mission ends, see the chain of events that caused it, with the hour and the numbers.' },
  { tag: '04 · Rewind', title: 'Try another plan', text: 'Go back to a decision, choose differently, and compare both timelines side by side.' },
];

const FEATURES = [
  {
    img: '/mascot/fankouch-thinking.webp', w: 458, h: 520,
    title: 'Real trade-offs, not quiz answers',
    text: 'Power, water and oxygen depend on each other. Saving one system can starve another, and the simulation shows exactly how.',
  },
  {
    img: '/mascot/fankouch-exploring.webp', w: 520, h: 454,
    title: 'An autopsy built from evidence',
    text: 'Every explanation comes from the mission log: which decision, at which hour, with which value. No made-up stories.',
  },
  {
    img: '/mascot/fankouch-celebrating.webp', w: 487, h: 520,
    title: 'Rewind and get it right',
    text: 'Same storm, same fault, same rules. Change one decision and see the difference between two timelines.',
  },
];

const AUDIENCES = [
  { title: 'Students, 12 to 18', text: `Learn systems thinking by running a base instead of memorising facts. Try it for ${GUEST_MINUTES} minutes as a guest.` },
  { title: 'Teachers', text: 'A ready-made 30-minute activity with a debrief that shows why each student decided what they did.' },
  { title: 'Schools, camps and museums', text: 'A memorable space-engineering experience that runs in a browser, even offline.' },
];

const FAQ = [
  { q: 'Is this real NASA data?', a: 'No. MissionLab is a simplified educational model. The ideas come from published NASA life-support research, but every number is a fictional gameplay value. NASA Space Apps inspired the concept; we are not affiliated with NASA.' },
  { q: 'Do students need an account?', a: `Not to try it: anyone can play as a guest for ${GUEST_MINUTES} minutes. A free account removes the time limit and keeps your progress.` },
  { q: 'What is Stardust?', a: CURRENCY.explainer },
  { q: 'Can the outcome be different each time?', a: 'Only if your decisions are different. The simulation is deterministic: the same choices always lead to the same result, which is what makes comparing two timelines fair.' },
  { q: 'Does it need a powerful computer?', a: 'No. It runs in a modern browser on a normal school laptop. If 3D isn’t available, the mission still works from the module list.' },
];

export function LandingSections() {
  return (
    <>
      <section id="how" className="border-t border-space-line py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 grid gap-3">
            <span className="eyebrow">How it works</span>
            <h2 className="font-display text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold">One mission, four moves</h2>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.tag} className="grid content-start gap-2.5 rounded-lg border border-space-line bg-space-2 p-6">
                <span className="font-data text-[13px] font-bold text-flare">{s.tag}</span>
                <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                <p className="text-[15px] text-dust">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-space-line py-20">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="grid content-start gap-4 rounded-lg border border-space-line bg-space-2 p-6">
              <div className="grid h-44 place-items-center rounded-md bg-[radial-gradient(circle_at_50%_65%,#24140f,#0e0b0c_75%)]">
                <Image src={f.img} alt="" width={f.w} height={f.h} className="max-h-36 w-auto" />
              </div>
              <h3 className="font-display text-xl font-semibold">{f.title}</h3>
              <p className="text-[15px] text-dust">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="teachers" className="border-t border-space-line py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 grid gap-3">
            <span className="eyebrow">Who it’s for</span>
            <h2 className="font-display text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold">Built for the classroom</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {AUDIENCES.map((a) => (
              <div key={a.title} className="grid content-start gap-2 border-t-2 border-flare pt-5">
                <h3 className="font-display text-xl font-semibold">{a.title}</h3>
                <p className="text-[15px] text-dust">{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="plans" className="border-t border-space-line py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 grid gap-3">
            <span className="eyebrow">Plans</span>
            <h2 className="font-display text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold">Free for learners. Built for schools.</h2>
            <p className="max-w-[62ch] text-dust">
              Prices are in <b className="text-cream">{CURRENCY.symbol} {CURRENCY.name}</b>, our fictional pilot currency. No real money is
              charged.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <article
                key={p.id}
                className={`relative grid content-start gap-4 rounded-lg border p-6 ${
                  p.highlighted ? 'border-flare bg-[linear-gradient(180deg,rgba(254,83,25,.10),#171213_40%)]' : 'border-space-line bg-space-2'
                }`}
              >
                {p.highlighted && (
                  <span className="absolute -top-3 left-6 rounded-full bg-flare px-2.5 py-0.5 font-data text-[11px] font-bold uppercase tracking-wider text-flare-ink">
                    Most popular
                  </span>
                )}
                <div>
                  <h3 className="font-display text-xl font-semibold">{p.name}</h3>
                  <p className="text-[13px] text-dust-2">{p.audience}</p>
                </div>
                <div>
                  <p className="font-data text-3xl font-bold tabular" aria-label={`${formatPrice(p.price)} ${p.cadence ?? ''}`}>
                    {p.price ? (
                      <>
                        <span className="mr-1 text-flare">{CURRENCY.symbol}</span>
                        {p.price.toLocaleString('en-US')}
                      </>
                    ) : (
                      formatPrice(p.price)
                    )}
                    {p.cadence && <span className="ml-1.5 font-body text-sm font-normal text-dust-2">{p.cadence}</span>}
                  </p>
                  {!!p.price && <p className="font-data text-[11px] uppercase tracking-wider text-dust-2">{CURRENCY.name}</p>}
                </div>
                <p className="text-sm text-dust">{p.description}</p>
                <ul className="grid gap-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-ok" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={p.cta.href} className={p.highlighted ? 'btn-primary mt-2' : 'btn-secondary mt-2'}>
                  {p.cta.label}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="border-t border-space-line py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-[1fr_1.5fr]">
          <div className="grid content-start gap-3">
            <span className="eyebrow">FAQ</span>
            <h2 className="font-display text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold">Good questions</h2>
          </div>
          <div className="grid gap-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-md border border-space-line bg-space-2 px-5 py-4">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="mr-2 inline-block text-flare transition group-open:rotate-45">+</span>
                  {f.q}
                </summary>
                <p className="mt-3 text-[15px] text-dust">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-space-line py-20">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 text-center sm:px-6 md:flex-row md:text-left">
          <Image src="/mascot/fankouch-flying.webp" alt="" width={520} height={471} className="h-40 w-auto" />
          <div className="grid flex-1 gap-3">
            <h2 className="font-display text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold">The storm is coming. Ready?</h2>
            <p className="text-dust">No download. Try {GUEST_MINUTES} minutes as a guest, or create a free account for unlimited play.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/mission" className="btn-primary">Try as guest · {GUEST_MINUTES} min</Link>
            <Link href="/signup" className="btn-secondary">Create an account</Link>
          </div>
        </div>
      </section>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-space-line py-10 text-[13px] text-dust-2">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
        <Image src="/brand/logo-mark.png" alt="MissionLab" width={51} height={28} className="h-7 w-auto opacity-90" />
        <span>MissionLab · LUMEN 2.0 · Kammoun, Habib, Amina</span>
        <span>Concept inspired by NASA Space Apps 2026. Not affiliated with NASA.</span>
      </div>
    </footer>
  );
}
