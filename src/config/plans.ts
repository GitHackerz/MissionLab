/**
 * Pricing plans shown on the landing page.
 *
 * Prices use MissionLab's fictional currency (Stardust) during the hackathon pilot: no real money,
 * no payment processing anywhere in the app. Tiers are DRAFTS from docs/14-SAAS-ROADMAP.md.
 * This is the only file to edit when the final plans and currency are decided.
 */

export interface Currency {
  name: string;
  /** Glyph shown before amounts. The four-point star is the brand star from the logo and Fankouch's suit. */
  symbol: string;
  code: string;
  explainer: string;
}

export const CURRENCY: Currency = {
  name: 'Stardust',
  symbol: '✦',
  code: 'STD',
  explainer:
    'Stardust (✦) is MissionLab’s fictional currency for the pilot. Prices show how plans compare.',
};

export interface Plan {
  id: string;
  name: string;
  audience: string;
  /** Price in Stardust; 0 = free, null = custom quote. */
  price: number | null;
  cadence?: string;
  description: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
}

export function formatPrice(price: number | null): string {
  if (price === null) return 'Custom';
  if (price === 0) return 'Free';
  return `${CURRENCY.symbol} ${price.toLocaleString('en-US')}`;
}

export const PLANS: Plan[] = [
  {
    id: 'explorer',
    name: 'Explorer',
    audience: 'Individual learners',
    price: 0,
    description: 'Play the first mission and learn how a Mars habitat stays alive.',
    features: ['Mission 01: The Red Storm', 'Mission Autopsy after every run', 'Rewind and compare two timelines', 'Free account, unlimited play'],
    cta: { label: 'Start free', href: '/signup' },
  },
  {
    id: 'classroom',
    name: 'Classroom',
    audience: 'One teacher, up to 35 students',
    price: 299,
    cadence: 'per year',
    description: 'Run MissionLab as a class activity and see how each student reasoned.',
    features: ['Everything in Explorer', 'Full mission catalogue as it grows', 'Student progress and decision history', 'Printable debriefs for class discussion'],
    cta: { label: 'Join the pilot', href: '/signup?plan=classroom' },
    highlighted: true,
  },
  {
    id: 'academy',
    name: 'Academy',
    audience: 'A science department, up to 300 students',
    price: 1499,
    cadence: 'per year',
    description: 'Several teachers, shared classes and difficulty settings.',
    features: ['Everything in Classroom', 'Multiple teachers and classes', 'School sign-in', 'Custom difficulty settings'],
    cta: { label: 'Join the pilot', href: '/signup?plan=academy' },
  },
  {
    id: 'museum',
    name: 'Museum & camps',
    audience: 'Science centres and space camps',
    price: null,
    description: 'Kiosk mode and offline installs for workshops and events.',
    features: ['Multi-station kiosk mode', 'Offline installation', 'Facilitator controls', 'Co-branding'],
    cta: { label: 'Talk to us', href: '/signup?plan=museum' },
  },
];
