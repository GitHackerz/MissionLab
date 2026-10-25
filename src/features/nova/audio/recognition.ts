/** Push-to-talk through the browser's SpeechRecognition (Chrome/Edge/Safari). Needs a connection and permission. */
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type Ctor = new () => RecognitionLike;

export function recognitionCtor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type ListenError = 'denied' | 'offline' | 'none' | 'unsupported' | 'no-mic' | 'failed';

export interface Listener {
  stop(): void;
}

/** Starts one utterance. The microphone is only opened here, on an explicit user gesture, and closes at `onEnd`. */
export function listenOnce(handlers: { onText: (t: string) => void; onError: (e: ListenError, code?: string) => void; onEnd: () => void }): Listener | null {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    handlers.onError('unsupported');
    handlers.onEnd();
    return null;
  }
  const rec = new Ctor();
  rec.lang = 'en-US';
  rec.interimResults = false;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let got = false;
  let errored = false;
  rec.onresult = (e) => {
    const text = e.results[0]?.[0]?.transcript?.trim();
    if (text) {
      got = true;
      handlers.onText(text);
    }
  };
  rec.onerror = (e) => {
    errored = true;
    errored = true;
    // 'aborted' is our own stop() and is not a failure.
    if (e.error === 'aborted') return;
    handlers.onError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : e.error === 'network' ? 'offline' : e.error === 'no-speech' ? 'none' : e.error === 'audio-capture' ? 'no-mic' : 'failed', e.error);
  };
  rec.onend = () => {
    if (!got && !errored) handlers.onError('none');
    handlers.onEnd();
  };
  try {
    rec.start();
  } catch {
    handlers.onError('failed');
    handlers.onEnd();
    return null;
  }
  return { stop: () => rec.abort() };
}
