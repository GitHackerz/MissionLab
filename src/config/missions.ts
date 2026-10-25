/**
 * Mission catalogue for teachers and students (assignments, dashboards, history).
 *
 * Playable missions come straight from the simulation's mission registry
 * (src/simulation/missions/registry.ts): adding a mission there makes it assignable here automatically.
 * `id` equals the engine's scenarioId, which is how finished runs are matched to assignments.
 * Entries below the registry are announced as "coming soon" and can't be assigned or played.
 */
import { MISSIONS as REGISTRY } from '@/simulation/missions/registry';

export type MissionStatus = 'available' | 'coming-soon';

export interface MissionCatalogEntry {
  id: string;
  number: string;
  title: string;
  summary: string;
  concepts: string[];
  /** Typical classroom time, in minutes. */
  minutes: number;
  status: MissionStatus;
  /** Where "Play" goes. Only used when available. */
  href: string;
  /** Fankouch pose shown on the mission card. */
  image: string;
}

const PRESENTATION: Record<string, { image: string; minutes: number; concepts: string[] }> = {
  'mission-01-red-storm': { image: '/mascot/fankouch-thinking.webp', minutes: 15, concepts: ['Power budgets', 'Energy storage', 'Water recycling', 'Fault diagnosis'] },
  'mission-02-pressure-drop': { image: '/mascot/fankouch-surprised.webp', minutes: 15, concepts: ['Ideal gas law', 'Compartment isolation', 'Sensor evidence'] },
  'mission-03-silent-air': { image: '/mascot/fankouch-exploring.webp', minutes: 20, concepts: ['CO₂ removal', 'Ventilation', 'Instrument drift'] },
};

const PLAYABLE: MissionCatalogEntry[] = REGISTRY.map((m) => ({
  id: m.id,
  number: m.number,
  title: m.title,
  summary: m.briefing,
  concepts: PRESENTATION[m.id]?.concepts ?? [],
  minutes: PRESENTATION[m.id]?.minutes ?? 15,
  status: 'available',
  href: `/mission?m=${m.id}`,
  image: PRESENTATION[m.id]?.image ?? '/mascot/fankouch-thinking.webp',
}));

const COMING_SOON: MissionCatalogEntry[] = [
  {
    id: 'mission-04-solar-proton-event',
    number: '04',
    title: 'The Solar Proton Event',
    summary: 'A solar particle storm sends the crew to the shelter while systems must keep running remotely.',
    concepts: ['Radiation shielding', 'Remote operations', 'Load shedding'],
    minutes: 15,
    status: 'coming-soon',
    href: '/mission',
    image: '/mascot/fankouch-working.webp',
  },
  {
    id: 'mission-05-hydroponic-crash',
    number: '05',
    title: 'Hydroponic Nitrogen Crash',
    summary: 'The greenhouse biofilter crashes and crops start to fail, threatening future food supplies.',
    concepts: ['Nitrogen cycle', 'Closed ecosystems', 'Biological buffers'],
    minutes: 15,
    status: 'coming-soon',
    href: '/mission',
    image: '/mascot/fankouch-sad.webp',
  },
  {
    id: 'mission-06-comms-blackout',
    number: '06',
    title: 'Earth Blackout',
    summary: 'Solar conjunction blocks contact with Earth for 14 days. Every decision is yours.',
    concepts: ['Autonomy', 'Delayed feedback', 'Contingency reserves'],
    minutes: 20,
    status: 'coming-soon',
    href: '/mission',
    image: '/mascot/fankouch-flying.webp',
  },
];

export const MISSIONS: MissionCatalogEntry[] = [...PLAYABLE, ...COMING_SOON];

export const AVAILABLE_MISSIONS = MISSIONS.filter((m) => m.status === 'available');

export function getMission(id: string): MissionCatalogEntry | undefined {
  return MISSIONS.find((m) => m.id === id);
}

/** Display title for a saved run, even if the mission was later removed from the catalogue. */
export function missionTitle(id: string): string {
  const m = getMission(id);
  return m ? `${m.number} · ${m.title}` : id;
}
