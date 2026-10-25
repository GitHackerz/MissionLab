'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Lightbulb, Mic, MicOff, Repeat2, Send, Settings2, Sparkles, Square, Volume2, VolumeX } from 'lucide-react';
import { useExploreStore } from '@/features/explore/store';
import { useMissionStore } from '@/state/missionStore';
import { isTypingTarget } from '@/features/explore/input/useGameInput';
import { NOVA_CONCEPTS } from '../targets';
import { selectNovaMode, useNovaStore } from '../state/store';
import { ask, repeat, start, startListening, stop, stopListening, stopSpeaking, voiceInputSupported } from '../state/runtime';
import { speechSupported } from '../audio/speech';
import { MAX_MESSAGE_CHARS } from '../ai/schemas';

const MODE_LABEL = { idle: 'Ready', listening: 'Listening…', thinking: 'Thinking…', speaking: 'Speaking', guiding: 'Guiding', warning: 'Alert', offline: 'Offline tutor', error: 'Reconnecting' } as const;
const DOT = { idle: 'bg-cyan-300', listening: 'bg-cyan-200 animate-pulse', thinking: 'bg-indigo-300 animate-pulse', speaking: 'bg-cyan-200 animate-pulse', guiding: 'bg-emerald-300', warning: 'bg-amber-300', offline: 'bg-slate-400', error: 'bg-red-300' } as const;
const EMOTION_EDGE = { neutral: 'border-l-cyan-300', curious: 'border-l-sky-300', encouraging: 'border-l-emerald-300', concerned: 'border-l-amber-300' } as const;

/**
 * NOVA's minimal interface. The companion lives in the 3D world; this is only the part a screen has to
 * carry: subtitles, a concept card, and a few contextual actions. No permanent chat panel.
 */
export const NovaDock: React.FC = () => {
  const s = useNovaStore();
  const mode = selectNovaMode(s);
  const exploreMode = useExploreStore((x) => x.mode);
  const taskId = useExploreStore((x) => x.activeTaskId);
  const concluded = useMissionStore((x) => x.missionState.status === 'success' || x.missionState.status === 'failed');
  const [text, setText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const canTalk = typeof window !== 'undefined' && voiceInputSupported();

  useEffect(() => {
    start();
    return stop;
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.code !== 'KeyN' || e.repeat || isTypingTarget(e.target)) return;
      e.preventDefault();
      useNovaStore.getState().patch({ panelOpen: true });
      setTimeout(() => input.current?.focus(), 0);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    void ask('ask', t);
  };

  const inTask = exploreMode === 'task' || (exploreMode === 'transitioning' && taskId !== null);
  const place = exploreMode === 'debrief' || inTask ? 'left-3 bottom-3 max-md:bottom-auto max-md:top-14' : 'right-4 top-[7.5rem] sm:right-7 lg:top-24 max-sm:bottom-24 max-sm:top-auto max-sm:right-3';
  if (exploreMode === 'paused') return null;

  return (
    <section aria-label="NOVA assistant" className={`pointer-events-none absolute z-[45] flex w-[min(21rem,calc(100vw-1.5rem))] flex-col gap-2 max-sm:w-[calc(100vw-10.5rem)] ${place}`}>
      {s.subtitle && (
        <div role="status" aria-live="polite" className={`pointer-events-auto rounded border border-l-2 border-cyan-300/25 bg-[#07161d]/90 px-3 py-2 text-sm leading-snug text-cyan-50 shadow-xl backdrop-blur ${EMOTION_EDGE[s.subtitle.emotion]}`}>
          <p>{s.subtitle.text}</p>
          {s.subtitle.followUp && <p className="mt-1 text-cyan-200">{s.subtitle.followUp}</p>}
          <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-cyan-200/60">
            <span>{s.subtitle.source === 'gemini' ? 'NOVA · AI' : s.subtitle.source === 'offline' ? 'NOVA · offline tutor' : 'NOVA'}</span>
            <span className="flex gap-1">
              {s.speaking && <button type="button" aria-label="Stop speaking" onClick={stopSpeaking} className="rounded p-1 hover:bg-white/10"><Square size={12} /></button>}
              <button type="button" aria-label="Repeat last message" onClick={repeat} className="rounded p-1 hover:bg-white/10"><Repeat2 size={12} /></button>
            </span>
          </div>
        </div>
      )}
      {s.conceptId && NOVA_CONCEPTS[s.conceptId] && (
        <div className="pointer-events-auto rounded border border-cyan-300/30 bg-[#0a2430]/90 px-3 py-2 text-xs text-cyan-50 shadow-lg backdrop-blur">
          <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Concept · {NOVA_CONCEPTS[s.conceptId].title}</div>
          <p className="mt-1 leading-snug">{NOVA_CONCEPTS[s.conceptId].text}</p>
        </div>
      )}

      <div className="pointer-events-auto rounded border border-cyan-300/20 bg-[#07161d]/85 p-2 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-cyan-200" aria-live="off">
            <span aria-hidden className={`h-2 w-2 rounded-full ${DOT[mode]}`} />NOVA · {MODE_LABEL[mode]}
          </span>
          <button type="button" aria-label="NOVA voice and hint settings" aria-expanded={showSettings} onClick={() => setShowSettings((v) => !v)} className="rounded p-1 text-cyan-200/80 hover:bg-white/10"><Settings2 size={14} /></button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" className="game-button flex items-center gap-1.5" aria-pressed={s.panelOpen} onClick={() => { s.patch({ panelOpen: !s.panelOpen }); setTimeout(() => input.current?.focus(), 0); }}><Sparkles size={13} aria-hidden />Ask NOVA <kbd className="kbd">N</kbd></button>
          <button type="button" className="game-button flex items-center gap-1.5" disabled={concluded || s.thinking} onClick={() => void ask('hint')}><Lightbulb size={13} aria-hidden />Hint{s.hintLevel > 0 ? ` ${s.hintLevel}/3` : ''}</button>
          {concluded && <button type="button" className="game-button" disabled={s.thinking} onClick={() => void ask('debrief')}>Explain my result</button>}
        </div>
        {s.panelOpen && (
          <div className="mt-2 space-y-2">
            <form onSubmit={submit} className="flex gap-1.5">
              <label className="sr-only" htmlFor="nova-input">Ask NOVA a question</label>
              <input
                id="nova-input"
                ref={input}
                value={text}
                maxLength={MAX_MESSAGE_CHARS}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    // Close the box without also opening the pause menu.
                    e.stopPropagation();
                    s.patch({ panelOpen: false });
                    (e.target as HTMLElement).blur();
                  }
                }}
                placeholder="Why is the battery draining?"
                className="min-w-0 flex-1 rounded border border-cyan-300/25 bg-black/50 px-2 py-1.5 text-sm text-cyan-50 placeholder:text-cyan-100/35 focus:border-cyan-200 focus:outline-none"
              />
              {canTalk && (
                <button type="button" aria-label={s.listening ? 'Stop listening' : 'Speak your question'} aria-pressed={s.listening} onClick={() => (s.listening ? stopListening() : startListening())} className="game-button px-2">{s.listening ? <MicOff size={14} /> : <Mic size={14} />}</button>
              )}
              <button type="submit" aria-label="Send question" disabled={!text.trim() || s.thinking} className="game-button px-2"><Send size={14} /></button>
            </form>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="game-button" disabled={s.thinking} onClick={() => void ask('where')}>Where should I go?</button>
              <button type="button" className="game-button" disabled={s.thinking} onClick={() => void ask('explain')}>Explain this</button>
              <button type="button" className="game-button" disabled={s.thinking} onClick={() => void ask('reflect')}>Why did that happen?</button>
            </div>
            {s.listening && <p className="text-[11px] text-cyan-200" role="status">Microphone is on. Speak now.</p>}
          </div>
        )}
        {showSettings && (
          <div className="mt-2 space-y-2 border-t border-white/10 pt-2 text-xs text-cyan-50">
            <div className="flex items-center gap-2">
              <button type="button" className="game-button flex items-center gap-1.5" aria-pressed={s.muted} onClick={() => { s.patch({ muted: !s.muted }); if (!s.muted) stopSpeaking(); }}>{s.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}{s.muted ? 'Unmute' : 'Mute'}</button>
              <label className="flex flex-1 items-center gap-2">Volume
                <input type="range" min={0} max={1} step={0.1} value={s.volume} disabled={!speechSupported()} onChange={(e) => s.patch({ volume: Number(e.target.value) })} className="flex-1" />
              </label>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={s.textOnly} onChange={(e) => { s.patch({ textOnly: e.target.checked }); if (e.target.checked) stopSpeaking(); }} />Text only (no voice)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={s.proactive} onChange={(e) => s.patch({ proactive: e.target.checked })} />NOVA speaks up on important events</label>
            {!speechSupported() && <p className="text-amber-200">This browser has no speech output; subtitles are used.</p>}
            {s.history.length > 0 && (
              <details>
                <summary className="cursor-pointer text-cyan-200">Conversation</summary>
                <ol className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                  {s.history.map((h) => <li key={h.id} className={h.who === 'student' ? 'text-stone-300' : 'text-cyan-100'}><span className="font-mono text-[10px] uppercase">{h.who === 'student' ? 'You' : 'NOVA'}</span> {h.text}</li>)}
                </ol>
              </details>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
