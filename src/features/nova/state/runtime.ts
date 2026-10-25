/**
 * NOVA runtime: wires mission events, the tutor, voice and the scene-facing store together.
 * One instance per habitat session (start/stop from the dock component). Everything it does to the
 * game is presentation: it reads mission state and writes only to the NOVA store.
 */
import { useMissionStore } from '@/state/missionStore';
import { useExploreStore } from '@/features/explore/store';
import type { MissionState } from '@/simulation/types';
import { getGuidance } from '@/simulation/training/guidance';
import { buildLearnerContext, type ViewState } from '../ai/context';
import { NOVA_INTRO } from '../ai/fallback';
import { askNova, buildRequest, probeAi } from '../ai/tutor';
import { getVoice } from '../audio/speech';
import { listenOnce, recognitionCtor, type ListenError, type Listener } from '../audio/recognition';
import { DEFAULT_GATE, EventLedger, deriveEvents, gateDecision, type NovaEvent } from '../events';
import { useNovaStore, loadPrefs } from './store';
import type { HintLevel, NovaIntent, NovaReply, NovaResponse } from '../types';

const MIN_THINK_MS = 450;

const ledger = new EventLedger();
let prev: MissionState | null = null;
let lastStage: string | null = null;
let lastEvidence = 0;
let pending: NovaEvent | null = null;
let lastDeliveredAt = 0;
let abort: AbortController | null = null;
let subtitleTimer: ReturnType<typeof setTimeout> | null = null;
let warnTimer: ReturnType<typeof setTimeout> | null = null;
let errorTimer: ReturnType<typeof setTimeout> | null = null;
let conceptTimer: ReturnType<typeof setTimeout> | null = null;
let tick: ReturnType<typeof setInterval> | null = null;
let unsubscribe: (() => void) | null = null;
let listener: Listener | null = null;
let lastSpoken = '';
let running = false;
let cleanupWindow: (() => void) | null = null;
let introTimer: ReturnType<typeof setTimeout> | null = null;

const store = () => useNovaStore.getState();

function viewState(): ViewState {
  const ex = useExploreStore.getState();
  return { room: ex.room, activeInteractableId: ex.activeInteractableId, nearbyId: ex.nearbyId };
}

function interacting(): boolean {
  const m = useExploreStore.getState().mode;
  return m === 'task' || m === 'transitioning';
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((res) => {
    const t = setTimeout(res, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); res(); }, { once: true });
  });
}

/** Shows (and, if allowed, speaks) a reply. Subtitles always work; speech is best effort. */
export function deliver(reply: NovaResponse & { source?: NovaReply['source'] }, opts: { speak?: boolean; warning?: boolean } = {}) {
  const s = store();
  const text = reply.followUpQuestion ? `${reply.message} ${reply.followUpQuestion}` : reply.message;
  lastSpoken = text;
  lastDeliveredAt = Date.now();
  s.say({ text: reply.message, emotion: reply.emotion, source: reply.source ?? 'authored', followUp: reply.followUpQuestion });
  s.pushHistory('nova', text);
  s.guide(reply.visualAction);
  if (reply.visualAction.type === 'show_concept') {
    if (conceptTimer) clearTimeout(conceptTimer);
    conceptTimer = setTimeout(() => store().patch({ conceptId: null }), 16_000);
  }
  if (opts.warning) {
    s.patch({ warning: true });
    if (warnTimer) clearTimeout(warnTimer);
    warnTimer = setTimeout(() => store().patch({ warning: false }), 7_000);
  }
  let spoke = false;
  if ((opts.speak ?? true) && !s.muted && !s.textOnly) {
    try {
      spoke = getVoice().speak(text, {
        volume: s.volume,
        onStart: () => store().patch({ speaking: true }),
        onEnd: () => store().patch({ speaking: false }),
      });
    } catch {
      spoke = false; // speech is best effort; the subtitle is already showing
    }
  } else getVoice().stop();
  if (!spoke) store().patch({ speaking: false });
  if (subtitleTimer) clearTimeout(subtitleTimer);
  const hold = Math.min(16_000, Math.max(6_000, text.length * 65));
  subtitleTimer = setTimeout(() => {
    // Keep the subtitle while still speaking; the speech end schedules a short tail.
    if (store().speaking) subtitleTimer = setTimeout(() => store().patch({ subtitle: null }), 2_500);
    else store().patch({ subtitle: null });
  }, hold);
}

export async function ask(intent: NovaIntent, message?: string) {
  if (!running) return;
  abort?.abort();
  const ctl = new AbortController();
  abort = ctl;
  const s = store();
  getVoice().stop();
  const mission = useMissionStore.getState().missionState;
  const context = buildLearnerContext(mission, viewState());
  let level: HintLevel = 0;
  if (intent === 'hint') {
    level = s.hintStage === context.stage ? (Math.min(3, s.hintLevel + 1) as HintLevel) : 1;
    s.patch({ hintLevel: level, hintStage: context.stage });
  }
  if (message) s.pushHistory('student', message);
  s.patch({ thinking: true, error: false, subtitle: null });
  try {
    const [reply] = await Promise.all([askNova(buildRequest(intent, context, level, message), { signal: ctl.signal }), sleep(MIN_THINK_MS, ctl.signal)]);
    if (ctl.signal.aborted) return;
    store().patch({ thinking: false, aiOnline: reply.source === 'gemini' });
    deliver(reply);
  } catch {
    if (ctl.signal.aborted) return;
    // askNova does not throw; this is a last line of defence so NOVA never sticks in "thinking".
    store().patch({ thinking: false, error: true });
    if (errorTimer) clearTimeout(errorTimer);
    errorTimer = setTimeout(() => store().patch({ error: false }), 2_500);
    deliver({ message: 'I lost my link for a moment. Look at the objective panel and tell me what you want to find out.', emotion: 'neutral', hintLevel: 0, visualAction: { type: 'none' }, source: 'offline' });
  } finally {
    if (abort === ctl) abort = null;
  }
}

export function repeat() {
  if (lastSpoken) {
    const s = store();
    s.say({ text: lastSpoken, emotion: 'neutral', source: 'authored' });
    if (!s.muted && !s.textOnly) getVoice().speak(lastSpoken, { volume: s.volume, onStart: () => store().patch({ speaking: true }), onEnd: () => store().patch({ speaking: false }) });
  }
}

export function stopSpeaking() {
  getVoice().stop();
  store().patch({ speaking: false });
}

export function voiceInputSupported(): boolean {
  return recognitionCtor() !== null;
}

const LISTEN_MESSAGES: Record<ListenError, string> = {
  denied: 'Microphone permission was declined. You can type your question instead.',
  offline: 'Voice input needs a browser with a speech service (for example Chrome or Edge) and an internet connection. Type your question instead.',
  none: "I didn't catch that. Try again, or type your question.",
  unsupported: 'This browser has no voice input. Type your question instead.',
  'no-mic': 'No microphone was found. Check your input device, or type your question instead.',
  failed: 'Voice input failed. Type your question instead.',
};

export function startListening() {
  if (listener || !running) return;
  stopSpeaking();
  store().patch({ listening: true, error: false });
  listener = listenOnce({
    onText: (t) => { void ask('ask', t); },
    onError: (e, code) => { if (e !== 'none' || !store().thinking) store().say({ text: e === 'failed' && code ? `${LISTEN_MESSAGES[e]} (${code})` : LISTEN_MESSAGES[e], emotion: 'neutral', source: 'authored' }); },
    onEnd: () => { listener = null; store().patch({ listening: false }); },
  });
  if (!listener) store().patch({ listening: false });
}

export function stopListening() {
  listener?.stop();
  listener = null;
  store().patch({ listening: false });
}

/** Called for every mission-state change. Cheap: a handful of comparisons. */
function onMission(m: MissionState) {
  const before = prev;
  prev = m;
  const reset = before && (m.hour < before.hour || m.branchId !== before.branchId || m.events.length < before.events.length);
  if (reset) {
    // Reset or rewind: drop stale guidance, speech and queued narration; do not re-narrate the past.
    abort?.abort();
    stopSpeaking();
    pending = null;
    store().reset();
    ledger.seed(deriveEvents(m));
    lastStage = getGuidance(m).stage;
    lastEvidence = m.training?.evidence.length ?? 0;
    return;
  }
  const stage = getGuidance(m).stage;
  const evidence = m.training?.evidence.length ?? 0;
  if (stage !== lastStage || evidence !== lastEvidence) {
    // The old pointer answered an old question.
    const g = store().guidance;
    if (g && lastStage !== null) store().patch({ guidance: null });
    if (stage !== lastStage) store().patch({ hintLevel: 0, hintStage: null, conceptId: null });
    lastStage = stage;
    lastEvidence = evidence;
  }
  for (const ev of ledger.fresh(deriveEvents(m))) {
    ledger.mark(ev.key);
    if (!pending || ev.priority > pending.priority) pending = ev;
  }
  flush();
}

function flush() {
  const g = store().guidance;
  if (g && Date.now() > g.until) store().patch({ guidance: null });
  if (!pending || !running) return;
  const s = store();
  const decision = gateDecision(pending, { now: Date.now(), lastDeliveredAt, interacting: false, proactiveEnabled: s.proactive, busy: s.thinking || s.speaking || s.listening }, DEFAULT_GATE);
  if (decision === 'drop') {
    pending = null;
    return;
  }
  if (decision === 'queue') return;
  const ev = pending;
  // During a focused task, deliver silently as a subtitle: never talk over an active manipulation.
  const quiet = interacting();
  if (quiet && ev.priority < 2) {
    pending = null;
    return;
  }
  pending = null;
  deliver({ message: ev.message, emotion: ev.emotion, hintLevel: 0, visualAction: ev.visualAction, source: 'authored' }, { speak: !quiet, warning: ev.warning });
}

export function start() {
  if (running) return;
  running = true;
  const prefs = loadPrefs();
  store().patch(prefs);
  store().reset();
  const m = useMissionStore.getState().missionState;
  prev = m;
  lastStage = getGuidance(m).stage;
  lastEvidence = m.training?.evidence.length ?? 0;
  const fresh = m.hour === 0 && m.training?.powerPlanAppliedHour == null;
  // A resumed session is not re-narrated; a fresh one gets the introduction, then its first objective.
  ledger.seed(fresh ? [] : deriveEvents(m));
  pending = null;
  lastDeliveredAt = 0;
  void probeAi().then((ok) => { if (running) store().patch({ aiOnline: ok && navigator.onLine }); });
  if (fresh) introTimer = setTimeout(() => { if (running) deliver(NOVA_INTRO); }, 900);
  unsubscribe = useMissionStore.subscribe((state, old) => {
    if (state.missionState !== old.missionState) onMission(state.missionState);
  });
  tick = setInterval(() => {
    flush();
    // Clear a pointer once the learner has opened the very station it points to.
    const g = store().guidance;
    const ex = useExploreStore.getState();
    if (g && ex.activeInteractableId && g.targetId === `station:${ex.activeInteractableId}`) store().patch({ guidance: null });
  }, 1_200);
  const goOffline = () => store().patch({ aiOnline: false });
  const goOnline = () => { void probeAi().then((ok) => { if (running) store().patch({ aiOnline: ok }); }); };
  window.addEventListener('offline', goOffline);
  window.addEventListener('online', goOnline);
  cleanupWindow = () => {
    window.removeEventListener('offline', goOffline);
    window.removeEventListener('online', goOnline);
  };
}

export function stop() {
  running = false;
  abort?.abort();
  abort = null;
  unsubscribe?.();
  unsubscribe = null;
  cleanupWindow?.();
  cleanupWindow = null;
  if (tick) clearInterval(tick);
  tick = null;
  for (const t of [subtitleTimer, warnTimer, errorTimer, conceptTimer, introTimer]) if (t) clearTimeout(t);
  subtitleTimer = warnTimer = errorTimer = conceptTimer = introTimer = null;
  stopListening();
  getVoice().stop();
  pending = null;
  prev = null;
  store().reset();
}
