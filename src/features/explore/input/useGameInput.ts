import { MutableRefObject, useEffect, useRef } from 'react';

export interface GameKeys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

export interface GameInputHandlers {
  onInteract: () => void;
  onEscape: () => void;
  onObjectives: () => void;
  objectivesEnabled?: boolean;
}

const MOVE: Record<string, keyof GameKeys> = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/**
 * Single, lifecycle-safe keyboard listener for the whole habitat.
 * - movement keys are only tracked while `movementEnabled` (exploration), and are cleared on blur or disable
 * - E fires once per press (key-repeat ignored) and never while typing or when `interactEnabled` is false
 * - Esc and Tab are routed to handlers, never reaching the page behind
 */
export function useGameInput(
  movementEnabled: boolean,
  interactEnabled: boolean,
  handlers: GameInputHandlers,
): MutableRefObject<GameKeys> {
  const keys = useRef<GameKeys>({ up: false, down: false, left: false, right: false, sprint: false });
  const h = useRef(handlers);
  const flags = useRef({ movementEnabled, interactEnabled });
  useEffect(() => {
    h.current = handlers;
    flags.current = { movementEnabled, interactEnabled };
  });

  useEffect(() => {
    if (!movementEnabled) clearKeys(keys.current);
  }, [movementEnabled]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Escape') {
        h.current.onEscape();
        e.preventDefault();
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.code === 'Tab') {
        if ((flags.current.movementEnabled || h.current.objectivesEnabled) && !(e.target instanceof HTMLElement && e.target.closest('button, a, summary'))) {
          e.preventDefault();
          if (!e.repeat) h.current.onObjectives();
        }
        return;
      }
      if (e.code === 'KeyE') {
        if (!e.repeat && flags.current.interactEnabled) h.current.onInteract();
        return;
      }
      const k = MOVE[e.code];
      if (k && flags.current.movementEnabled) {
        keys.current[k] = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = MOVE[e.code];
      if (k) keys.current[k] = false;
    };
    const reset = () => clearKeys(keys.current);
    const vis = () => {
      if (document.hidden) reset();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', vis);
      reset();
    };
  }, []);

  return keys;
}

function clearKeys(k: GameKeys) {
  k.up = k.down = k.left = k.right = k.sprint = false;
}
