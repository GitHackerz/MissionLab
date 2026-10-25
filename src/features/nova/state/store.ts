import { create } from 'zustand';
import type { HintLevel, NovaEmotion, NovaMode, NovaSource, NovaVisualAction } from '../types';

export interface Subtitle {
  id: number;
  text: string;
  emotion: NovaEmotion;
  source: NovaSource;
  followUp?: string;
}

export interface HistoryLine {
  id: number;
  who: 'student' | 'nova';
  text: string;
}

export interface Guidance {
  kind: 'highlight' | 'point';
  targetId: string;
  /** Epoch ms after which the marker fades even if nothing else cleared it. */
  until: number;
}

export interface NovaPrefs {
  muted: boolean;
  volume: number;
  textOnly: boolean;
  proactive: boolean;
}

export interface NovaState extends NovaPrefs {
  listening: boolean;
  thinking: boolean;
  speaking: boolean;
  warning: boolean;
  error: boolean;
  /** Gemini reachable? null = not probed. Offline tutor is used when false. */
  aiOnline: boolean | null;
  subtitle: Subtitle | null;
  conceptId: string | null;
  guidance: Guidance | null;
  history: HistoryLine[];
  hintLevel: HintLevel;
  hintStage: string | null;
  panelOpen: boolean;

  patch: (p: Partial<Omit<NovaState, 'patch' | 'reset' | 'say' | 'guide' | 'pushHistory'>>) => void;
  say: (s: Omit<Subtitle, 'id'>) => void;
  guide: (a: NovaVisualAction, ttlMs?: number) => void;
  pushHistory: (who: HistoryLine['who'], text: string) => void;
  /** Clears all mission-bound guidance (mission reset, rewind, leaving the habitat). Preferences are kept. */
  reset: () => void;
}

const PREFS_KEY = 'missionlab_nova_prefs_v1';
const DEFAULT_PREFS: NovaPrefs = { muted: false, volume: 0.9, textOnly: false, proactive: true };

export function loadPrefs(): NovaPrefs {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<NovaPrefs>;
    return {
      muted: p.muted === true,
      volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : DEFAULT_PREFS.volume,
      textOnly: p.textOnly === true,
      proactive: p.proactive !== false,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(s: NovaPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ muted: s.muted, volume: s.volume, textOnly: s.textOnly, proactive: s.proactive }));
  } catch {
    // storage may be unavailable; preferences just will not persist
  }
}

let counter = 0;
const mission = {
  listening: false, thinking: false, speaking: false, warning: false, error: false,
  subtitle: null as Subtitle | null, conceptId: null as string | null, guidance: null as Guidance | null,
  history: [] as HistoryLine[], hintLevel: 0 as HintLevel, hintStage: null as string | null, panelOpen: false,
};

export const useNovaStore = create<NovaState>((set, get) => ({
  ...DEFAULT_PREFS,
  ...mission,
  aiOnline: null,

  patch: (p) => {
    set(p);
    if ('muted' in p || 'volume' in p || 'textOnly' in p || 'proactive' in p) savePrefs(get());
  },
  say: (s) => set({ subtitle: { ...s, id: ++counter } }),
  guide: (a, ttlMs = 40_000) => {
    if (a.type === 'highlight' || a.type === 'point') set({ guidance: { kind: a.type, targetId: a.targetId, until: Date.now() + ttlMs } });
    else if (a.type === 'show_concept') set({ conceptId: a.conceptId });
  },
  pushHistory: (who, text) => set((s) => ({ history: [...s.history, { id: ++counter, who, text }].slice(-24) })),
  reset: () => set({ ...mission, aiOnline: get().aiOnline }),
}));

/** Pure mapping from flags to the companion's visual state (priority order). */
export function selectNovaMode(s: Pick<NovaState, 'error' | 'listening' | 'thinking' | 'speaking' | 'warning' | 'guidance' | 'aiOnline'>): NovaMode {
  if (s.error) return 'error';
  if (s.listening) return 'listening';
  if (s.thinking) return 'thinking';
  if (s.speaking) return 'speaking';
  if (s.warning) return 'warning';
  if (s.guidance) return 'guiding';
  if (s.aiOnline === false) return 'offline';
  return 'idle';
}
