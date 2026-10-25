'use client';

import { useCallback, useEffect, useState } from 'react';

export interface PwaState {
  isOnline: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  offlineReady: boolean;
  cachingProgress: number | null; // null if not currently caching, 0..100 when caching
  cachingStatusText: string;
  promptInstall: () => Promise<boolean>;
  prepareForOfflinePlay: () => Promise<boolean>;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const OFFLINE_CACHE_NAME = 'missionlab-v1-offline';
const ESSENTIAL_ASSETS = [
  '/',
  '/mission',
  '/models/astronaut.glb',
  '/brand/logo-full.png',
  '/brand/logo-mark.png',
  '/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

export function usePwa(): PwaState {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [offlineReady, setOfflineReady] = useState<boolean>(false);
  const [cachingProgress, setCachingProgress] = useState<number | null>(null);
  const [cachingStatusText, setCachingStatusText] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Check if running in standalone mode (installed PWA)
    const isStandalone =
      (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);


    // Register service worker if supported
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // Check update
          reg.update().catch(() => {});
        })
        .catch(() => {});
    }

    // Capture install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check existing offline cache readiness
    if ('caches' in window) {
      caches.has(OFFLINE_CACHE_NAME).then((exists) => {
        if (exists) {
          caches.open(OFFLINE_CACHE_NAME).then((cache) => {
            cache.match('/models/astronaut.glb').then((res) => {
              if (res) setOfflineReady(true);
            });
          });
        }
      });
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [deferredPrompt]);

  const prepareForOfflinePlay = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('caches' in window)) {
      setCachingStatusText('Offline cache is not supported in this browser.');
      return false;
    }

    try {
      setCachingProgress(5);
      setCachingStatusText('Initializing offline storage...');

      const cache = await caches.open(OFFLINE_CACHE_NAME);
      const total = ESSENTIAL_ASSETS.length;
      let loaded = 0;

      for (const asset of ESSENTIAL_ASSETS) {
        setCachingStatusText(`Caching: ${asset}`);
        try {
          const response = await fetch(asset, { cache: 'no-cache' });
          if (response.ok) {
            await cache.put(asset, response.clone());
          }
        } catch (err) {
          console.warn(`Failed to cache ${asset}:`, err);
        }
        loaded++;
        setCachingProgress(Math.round(10 + (loaded / total) * 85));
      }

      // Also cache any currently loaded script and stylesheet tags
      const resourceUrls = Array.from(document.querySelectorAll<HTMLLinkElement | HTMLScriptElement>('link[rel="stylesheet"], script[src]'))
        .map((el) => (el as HTMLLinkElement).href || (el as HTMLScriptElement).src)
        .filter((url) => url && url.startsWith(window.location.origin));

      for (const resUrl of resourceUrls) {
        try {
          const res = await fetch(resUrl, { cache: 'no-cache' });
          if (res.ok) await cache.put(resUrl, res.clone());
        } catch {}
      }

      setCachingProgress(100);
      setCachingStatusText('Offline content ready. You can now play without internet!');
      setOfflineReady(true);

      setTimeout(() => {
        setCachingProgress(null);
      }, 3500);

      return true;
    } catch {
      setCachingStatusText('Error caching offline assets. Check network connection.');
      setCachingProgress(null);
      return false;
    }

  }, []);

  return {
    isOnline,
    isInstallable: !!deferredPrompt,
    isInstalled,
    offlineReady,
    cachingProgress,
    cachingStatusText,
    promptInstall,
    prepareForOfflinePlay,
  };
}
