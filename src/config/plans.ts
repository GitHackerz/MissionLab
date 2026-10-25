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

/** What a teacher's plan unlocks. Enforced on the server (src/server/billing/entitlements.ts). */
export interface PlanLimits {
  /** Classes a teacher can own (sample classes never count). */
  maxClasses: number;
  /** Active students across all the teacher's classes. */
  maxStudents: number;
  /** Active assignments per class; null = unlimited, 0 = none. */
  maxAssignmentsPerClass: number | null;
  /** Assign a mission to chosen students instead of the whole class. */
  targetedAssignments: boolean;
  /** Activity tab: why missions ended early, recent missions. */
  insights: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  audience: string;
  /** Price in Stardust; 0 = free, null = custom quote. */
  price: number | null;
  cadence?: string;
  description: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
  /** Custom-quote plans can't be bought through checkout. */
  purchasable: boolean;
  limits: PlanLimits;
}

export type PlanId = 'explorer' | 'classroom' | 'academy' | 'museum';

/** Stardust every new account receives for the pilot, so teachers can try a paid plan. */
export const STARTING_STARDUST = 2000;

export function formatPrice(price: number | null): string {
  if (price === null) return 'Custom';
  if (price === 0) return 'Free';
  return `${CURRENCY.symbol} ${price.toLocaleString('en-US')}`;
}

export const PLANS: Plan[] = [
  {
    id: 'explorer',
    name: 'Explorer',
    audience: 'Learners and small groups',
    price: 0,
    description: 'Play the missions, and try MissionLab with a small group.',
    features: ['All available missions, unlimited play', 'Mission Autopsy and rewind', '1 class, up to 5 students', '1 whole-class assignment at a time'],
    cta: { label: 'Start free', href: '/signup' },
    purchasable: false,
    limits: { maxClasses: 1, maxStudents: 5, maxAssignmentsPerClass: 1, targetedAssignments: false, insights: false },
  },
  {
    id: 'classroom',
    name: 'Classroom',
    audience: 'One teacher, up to 35 students',
    price: 299,
    cadence: 'per year',
    description: 'Run MissionLab as a class activity and see how each student reasoned.',
    features: ['Everything in Explorer', '1 class, up to 35 students', 'Unlimited assignments, to the class or chosen students', 'Activity insights: why missions ended early'],
    cta: { label: 'Choose Classroom', href: '/billing/checkout?plan=classroom' },
    highlighted: true,
    purchasable: true,
    limits: { maxClasses: 1, maxStudents: 35, maxAssignmentsPerClass: null, targetedAssignments: true, insights: true },
  },
  {
    id: 'academy',
    name: 'Academy',
    audience: 'A science department, up to 300 students',
    price: 1499,
    cadence: 'per year',
    description: 'Several classes, shared insights and room for a whole department.',
    features: ['Everything in Classroom', 'Up to 10 classes', 'Up to 300 students', 'Department-wide insights'],
    cta: { label: 'Choose Academy', href: '/billing/checkout?plan=academy' },
    purchasable: true,
    limits: { maxClasses: 10, maxStudents: 300, maxAssignmentsPerClass: null, targetedAssignments: true, insights: true },
  },
  {
    id: 'museum',
    name: 'Museum & camps',
    audience: 'Science centres and space camps',
    price: null,
    description: 'Kiosk mode and offline installs for workshops and events.',
    features: ['Multi-station kiosk mode', 'Offline installation', 'Facilitator controls', 'Co-branding'],
    cta: { label: 'Talk to us', href: '/signup?plan=museum' },
    purchasable: false,
    limits: { maxClasses: 50, maxStudents: 5000, maxAssignmentsPerClass: null, targetedAssignments: true, insights: true },
  },
];

export function getPlan(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
