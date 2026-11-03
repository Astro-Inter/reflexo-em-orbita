/** Small procedural soundscape. AudioContext is only created after a user gesture. */
export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private focusOscillator: OscillatorNode | null = null;
  private focusGain: GainNode | null = null;
  private focusLfo: OscillatorNode | null = null;
  private focusLfoGain: GainNode | null = null;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.master && this.context) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(enabled ? 1 : 0.0001, now, 0.035);
    }
    if (!enabled) this.stopFocus();
  }

  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        const AudioContextClass =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextClass) return;
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.gain.value = 1;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended") void this.context.resume();
    } catch {
      // Sound is an enhancement; unsupported or blocked audio must not affect play.
    }
  }

  private tone(
    frequency: number,
    duration: number,
    options: { endFrequency?: number; volume?: number; type?: OscillatorType; delay?: number } = {},
  ) {
    if (!this.enabled || !this.context || !this.master) return;
    const context = this.context;
    const at = context.currentTime + (options.delay ?? 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(frequency, at);
    if (options.endFrequency)
      oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, at + duration);
    const volume = Math.min(0.9, (options.volume ?? 0.12) * 1.7);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + Math.min(0.025, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }

  ui() {
    this.tone(620, 0.055, { endFrequency: 780, volume: 0.035 });
  }

  startMatch() {
    this.tone(392, 0.14, { endFrequency: 523, volume: 0.075 });
    this.tone(523, 0.16, { endFrequency: 659, volume: 0.07, delay: 0.11 });
  }

  startFocus() {
    this.stopFocus();
    if (!this.enabled || !this.context || !this.master) return;
    try {
      const context = this.context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 196;
      gain.gain.value = 0.0001;
      gain.gain.setTargetAtTime(0.11, context.currentTime, 0.6);
      lfo.type = "sine";
      lfo.frequency.value = 0.32;
      lfoGain.gain.value = 0.026;
      oscillator.connect(gain);
      gain.connect(this.master);
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      oscillator.start();
      lfo.start();
      this.focusOscillator = oscillator;
      this.focusGain = gain;
      this.focusLfo = lfo;
      this.focusLfoGain = lfoGain;
      // A quiet, regular pulse gives the waiting phase a little tension.
      this.tone(294, 0.11, { endFrequency: 220, volume: 0.06 });
    } catch {
      this.stopFocus();
    }
  }

  cue() {
    this.stopFocus();
    this.tone(740, 0.16, { endFrequency: 988, volume: 0.16, type: "triangle" });
    this.tone(988, 0.22, { endFrequency: 1318, volume: 0.19, type: "triangle", delay: 0.14 });
  }

  early() {
    this.stopFocus();
    this.tone(280, 0.18, { endFrequency: 170, volume: 0.12, type: "triangle" });
  }

  slow() {
    this.stopFocus();
    this.tone(420, 0.22, { endFrequency: 240, volume: 0.1, type: "triangle" });
  }

  win() {
    this.stopFocus();
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) =>
      this.tone(frequency, 0.25, {
        endFrequency: frequency * 1.015,
        volume: 0.14,
        type: "triangle",
        delay: index * 0.105,
      }),
    );
    this.cheer(0.3);
    this.cheer(0.98);
    this.cheer(1.66);
  }

  private cheer(delay: number) {
    if (!this.enabled || !this.context || !this.master) return;
    const context = this.context;
    const at = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const harmonic = context.createOscillator();
    const gain = context.createGain();
    const harmonicGain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(520, at);
    oscillator.frequency.exponentialRampToValueAtTime(880, at + 0.15);
    oscillator.frequency.exponentialRampToValueAtTime(690, at + 0.25);
    oscillator.frequency.exponentialRampToValueAtTime(1180, at + 0.48);
    harmonic.type = "sine";
    harmonic.frequency.setValueAtTime(780, at);
    harmonic.frequency.exponentialRampToValueAtTime(1770, at + 0.48);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.2, at + 0.06);
    gain.gain.setTargetAtTime(0.13, at + 0.08, 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.53);
    harmonicGain.gain.setValueAtTime(0.0001, at);
    harmonicGain.gain.exponentialRampToValueAtTime(0.045, at + 0.08);
    harmonicGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
    oscillator.connect(gain);
    harmonic.connect(harmonicGain);
    gain.connect(this.master);
    harmonicGain.connect(this.master);
    oscillator.start(at);
    harmonic.start(at);
    oscillator.stop(at + 0.56);
    harmonic.stop(at + 0.54);
  }

  lose() {
    this.stopFocus();
    this.tone(392, 0.3, { endFrequency: 250, volume: 0.1, type: "triangle" });
    this.tone(250, 0.38, { endFrequency: 165, volume: 0.09, type: "triangle", delay: 0.2 });
  }

  interrupt() {
    this.stopFocus();
    this.tone(330, 0.16, { endFrequency: 220, volume: 0.08 });
  }

  stopFocus() {
    const now = this.context?.currentTime ?? 0;
    if (this.focusGain && this.context) {
      try {
        this.focusGain.gain.cancelScheduledValues(now);
        this.focusGain.gain.setTargetAtTime(0.0001, now, 0.045);
      } catch {
        // Nodes may already have been stopped by the browser.
      }
    }
    [this.focusOscillator, this.focusLfo].forEach((node) => {
      try {
        node?.stop(now + 0.25);
      } catch {
        // Stopping a node twice is harmless, but Web Audio throws for it.
      }
    });
    this.focusOscillator = null;
    this.focusGain = null;
    this.focusLfo = null;
    this.focusLfoGain = null;
  }

  dispose() {
    this.stopFocus();
    if (this.context) void this.context.close();
    this.context = null;
    this.master = null;
  }
}
