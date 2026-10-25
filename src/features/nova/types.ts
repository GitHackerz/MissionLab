/** NOVA contracts. NOVA only ever suggests presentation: it can never change mission state. */

export type NovaMode = 'idle' | 'listening' | 'thinking' | 'speaking' | 'guiding' | 'warning' | 'offline' | 'error';

export type NovaEmotion = 'neutral' | 'curious' | 'encouraging' | 'concerned';

export type HintLevel = 0 | 1 | 2 | 3;

/** What the learner is asking for. `hint` escalates conceptual -> investigative -> directional. */
export type NovaIntent = 'ask' | 'hint' | 'explain' | 'where' | 'reflect' | 'debrief';

export type NovaVisualAction =
  | { type: 'highlight'; targetId: string }
  | { type: 'point'; targetId: string }
  | { type: 'show_concept'; conceptId: string }
  | { type: 'none' };

export interface NovaResponse {
  message: string;
  emotion: NovaEmotion;
  hintLevel: HintLevel;
  visualAction: NovaVisualAction;
  followUpQuestion?: string;
}

/** Where a response came from, so the UI can say whether it is online (Gemini) or the offline tutor. */
export type NovaSource = 'gemini' | 'offline' | 'authored';

export interface NovaReply extends NovaResponse {
  source: NovaSource;
}
