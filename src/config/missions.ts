/**
 * Mission catalogue: the single list of missions teachers can assign and students can play.
 *
 * `id` must equal the engine's `MissionConfig.scenarioId`, because finished runs are saved with that id
 * and matched back to assignments. To publish a new mission: build its config, add (or update) its entry
 * here and set `status: 'available'` with the route that starts it. See docs/19-MISSION-CATALOG.md.
 */

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

export const MISSIONS: MissionCatalogEntry[] = [
  {
    id: 'mission-01-red-storm',
    number: '01',
    title: 'The Red Storm',
    summary: 'A dust storm cuts solar power to 4 kW and the water recycler fails. Keep four crew safe for 72 hours.',
    concepts: ['Power budgets', 'Energy storage', 'Water recycling', 'Fault diagnosis'],
    minutes: 15,
    status: 'available',
    href: '/mission',
    image: '/mascot/fankouch-thinking.webp',
  },
  {
    id: 'mission-02-eclss-cascade',
    number: '02',
    title: 'Atmospheric Cascade',
    summary: 'The CO₂ reduction reactor fails. Carbon dioxide rises while oxygen generation is constrained.',
    concepts: ['Partial pressure', 'CO₂ scrubbing', 'Chemical reactions'],
    minutes: 15,
    status: 'coming-soon',
    href: '/mission',
    image: '/mascot/fankouch-surprised.webp',
  },
  {
    id: 'mission-03-solar-proton-event',
    number: '03',
    title: 'The Solar Proton Event',
    summary: 'A solar particle storm sends the crew to the shelter while systems must keep running remotely.',
    concepts: ['Radiation shielding', 'Remote operations', 'Load shedding'],
    minutes: 15,
    status: 'coming-soon',
    href: '/mission',
    image: '/mascot/fankouch-working.webp',
  },
  {
    id: 'mission-04-hydroponic-crash',
    number: '04',
    title: 'Hydroponic Nitrogen Crash',
    summary: 'The greenhouse biofilter crashes and crops start to fail, threatening future food supplies.',
    concepts: ['Nitrogen cycle', 'Closed ecosystems', 'Biological buffers'],
    minutes: 15,
    status: 'coming-soon',
    href: '/mission',
    image: '/mascot/fankouch-exploring.webp',
  },
  {
    id: 'mission-05-comms-blackout',
    number: '05',
    title: 'Earth Blackout',
    summary: 'Solar conjunction blocks contact with Earth for 14 days. Every decision is yours.',
    concepts: ['Autonomy', 'Delayed feedback', 'Contingency reserves'],
    minutes: 20,
    status: 'coming-soon',
    href: '/mission',
    image: '/mascot/fankouch-flying.webp',
  },
];

export const AVAILABLE_MISSIONS = MISSIONS.filter((m) => m.status === 'available');

export function getMission(id: string): MissionCatalogEntry | undefined {
  return MISSIONS.find((m) => m.id === id);
}

/** Display title for a saved run, even if the mission was later removed from the catalogue. */
export function missionTitle(id: string): string {
  const m = getMission(id);
  return m ? `${m.number} · ${m.title}` : id;
}
