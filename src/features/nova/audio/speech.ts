/**
 * Spoken output through the browser's Speech Synthesis, with a small testable state machine.
 * Speech is optional: subtitles never depend on it, and every failure ends in a clean "stopped".
 * The audio level is a restrained envelope tied to playback and word boundaries, not a real waveform.
 */
export type VoiceState = 'idle' | 'speaking';

export interface VoiceSynth {
  speak(u: SpeechSynthesisUtterance): void;
  cancel(): void;
  getVoices(): SpeechSynthesisVoice[];
}

export interface VoiceOptions {
  volume: number;
  onStart?: () => void;
  onEnd?: () => void;
}

/** Shared mutable level read by the renderer every frame (no React re-renders). */
export const novaAudioLevel = { value: 0 };

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  return en.find((v) => /natural|google|samantha|aria|jenny/i.test(v.name)) ?? en.find((v) => v.localService) ?? en[0];
}

/** Rough upper bound so a browser that never fires `end` cannot leave NOVA "speaking" forever. */
export function estimateSpeechMs(text: string): number {
  return Math.min(30_000, 1500 + text.length * 75);
}

export function createVoice(synth: VoiceSynth | null, Utterance: typeof SpeechSynthesisUtterance | null, timers: { set: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>; clear: (id: ReturnType<typeof setTimeout>) => void } = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) }) {
  let current: SpeechSynthesisUtterance | null = null;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let decay: ReturnType<typeof setInterval> | null = null;
  let finish: (() => void) | null = null;

  const clear = () => {
    if (watchdog) timers.clear(watchdog);
    watchdog = null;
    if (decay) clearInterval(decay);
    decay = null;
  };

  const end = (u: SpeechSynthesisUtterance) => {
    if (current !== u) return;
    current = null;
    clear();
    novaAudioLevel.value = 0;
    const cb = finish;
    finish = null;
    cb?.();
  };

  return {
    get supported() {
      return Boolean(synth && Utterance);
    },
    get state(): VoiceState {
      return current ? 'speaking' : 'idle';
    },
    /** Returns false when speech is unavailable (caller keeps showing subtitles). */
    speak(text: string, opts: VoiceOptions): boolean {
      if (!synth || !Utterance || opts.volume <= 0 || !text.trim()) return false;
      this.stop();
      const u = new Utterance(text);
      const voice = pickVoice(synth.getVoices());
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else u.lang = 'en-US';
      u.rate = 0.98;
      u.pitch = 1.05;
      u.volume = Math.min(1, Math.max(0, opts.volume));
      current = u;
      finish = opts.onEnd ?? null;
      u.onstart = () => {
        if (current !== u) return;
        novaAudioLevel.value = 0.5;
        opts.onStart?.();
        decay = setInterval(() => {
          novaAudioLevel.value = Math.max(0.28, novaAudioLevel.value * 0.88);
        }, 60);
      };
      u.onboundary = () => {
        if (current === u) novaAudioLevel.value = 0.9;
      };
      u.onend = () => end(u);
      u.onerror = () => end(u);
      watchdog = timers.set(() => {
        synth.cancel();
        end(u);
      }, estimateSpeechMs(text));
      try {
        synth.speak(u);
      } catch {
        end(u);
        return false;
      }
      return true;
    },
    stop() {
      const u = current;
      if (!u) return;
      try {
        synth?.cancel();
      } catch {
        // ignore: the state below is what matters
      }
      end(u);
    },
  };
}

export type NovaVoice = ReturnType<typeof createVoice>;

let shared: NovaVoice | null = null;
export function getVoice(): NovaVoice {
  shared ??= speechSupported() ? createVoice(window.speechSynthesis, SpeechSynthesisUtterance) : createVoice(null, null);
  return shared;
}
