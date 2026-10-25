'use client';

/**
 * Web Audio API procedural sound synthesizer for MissionLab.
 * Zero external audio file dependencies — 100% offline-ready, responsive,
 * and compliant with browser autoplay restrictions.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private volume: number = 0.5;
  private ambientGain: GainNode | null = null;
  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientPlaying: boolean = false;
  private ambientStopTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedMute = localStorage.getItem('missionlab_sound_muted');
        if (savedMute !== null) {
          this.muted = savedMute === 'true';
        }
        const savedVol = localStorage.getItem('missionlab_sound_volume');
        if (savedVol !== null) {
          const v = parseFloat(savedVol);
          if (!isNaN(v) && v >= 0 && v <= 1) this.volume = v;
        }
      } catch {
        // storage disabled
      }
    }
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('missionlab_sound_muted', String(muted));
      } catch {}
    }
    if (muted && this.ambientGain) {
      this.ambientGain.gain.setValueAtTime(0, this.ctx?.currentTime ?? 0);
    } else if (!muted && this.ambientGain && this.ambientPlaying) {
      this.ambientGain.gain.setValueAtTime(0.04 * this.volume, this.ctx?.currentTime ?? 0);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('missionlab_sound_volume', String(this.volume));
      } catch {}
    }
    if (!this.muted && this.ambientGain && this.ambientPlaying) {
      this.ambientGain.gain.setValueAtTime(0.04 * this.volume, this.ctx?.currentTime ?? 0);
    }
  }

  /** Subtle UI button click */
  public playClick() {
    if (this.muted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08 * this.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.04);
    } catch {}
  }

  /** Electrical switch / breaker toggle */
  public playSwitch(enabled: boolean) {
    if (this.muted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const freq = enabled ? 340 : 220;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(enabled ? 520 : 160, ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.12 * this.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.07);
    } catch {}
  }

  /** Mechanical tool / latch / bolt sound */
  public playToolAction() {
    if (this.muted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const bufferSize = ctx.sampleRate * 0.05;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, ctx.currentTime);
      filter.Q.setValueAtTime(3, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15 * this.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start(ctx.currentTime);
      whiteNoise.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  /** Success chime for verified task completion */
  public playSuccess() {
    if (this.muted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.09);

        const startTime = ctx.currentTime + idx * 0.09;
        gain.gain.setValueAtTime(0.1 * this.volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.28);
      });
    } catch {}
  }

  /** Warning chime for critical condition or failed verification */
  public playWarning() {
    if (this.muted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(370, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.09 * this.volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }

  /** Gentle low-frequency habitat ventilation hum */
  public startAmbientHum() {
    if (this.ambientStopTimer) { clearTimeout(this.ambientStopTimer); this.ambientStopTimer = null; }
    if (this.ambientPlaying) {
      if (this.ctx && this.ambientGain) {
        this.ambientGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.ambientGain.gain.linearRampToValueAtTime(this.muted ? 0 : .035 * this.volume, this.ctx.currentTime + .2);
      }
      return;
    }
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(58, ctx.currentTime);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(116, ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, ctx.currentTime);

      const targetGain = this.muted ? 0 : 0.035 * this.volume;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 2.0);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();

      this.ambientOsc1 = osc1;
      this.ambientOsc2 = osc2;
      this.ambientFilter = filter;
      this.ambientGain = gain;
      this.ambientPlaying = true;
    } catch {}
  }

  public stopAmbientHum() {
    if (!this.ambientPlaying || !this.ctx) return;
    try {
      if (this.ambientGain) {
        this.ambientGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      }
      if (this.ambientStopTimer) clearTimeout(this.ambientStopTimer);
      this.ambientStopTimer = setTimeout(() => {
        this.ambientStopTimer = null;
        try {
          this.ambientOsc1?.stop();
          this.ambientOsc2?.stop();
          this.ambientOsc1?.disconnect();
          this.ambientOsc2?.disconnect();
        } catch {}
        this.ambientPlaying = false;
        this.ambientOsc1 = null;
        this.ambientOsc2 = null;
        this.ambientGain = null;
        this.ambientFilter = null;
      }, 550);
    } catch {
      this.ambientPlaying = false;
    }
  }
}

export const soundManager = new SoundManager();
