import { useEffect, type RefObject } from 'react';

/** Contain keyboard navigation in the visible dialog; restore the world on close. */
export function useDialogFocus(open: boolean, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = ref.current;
    frame?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey || !frame) return;
      const controls = Array.from(frame.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, a[href], [tabindex="0"]')).filter(el => el.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === frame)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === frame)) { event.preventDefault(); first.focus(); }
    };
    frame?.addEventListener('keydown', trap);
    return () => { frame?.removeEventListener('keydown', trap); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open, ref]);
}
