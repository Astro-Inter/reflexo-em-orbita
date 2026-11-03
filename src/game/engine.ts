export type Phase =
  "IDLE" | "WAITING" | "REACTION" | "FEEDBACK" | "RESULT" | "INTERRUPTED";
export type Outcome = "won" | "lost" | null;
export type Snapshot = Readonly<{
  phase: Phase;
  attempt: number;
  milliseconds: number | null;
  outcome: Outcome;
  reason: "early" | "slow" | "interrupted" | null;
}>;
export interface Scheduler {
  now(): number;
  random(): number;
  delay(callback: () => void, milliseconds: number): number;
  cancelDelay(id: number): void;
  frame(callback: () => void): number;
  cancelFrame(id: number): void;
}
export const MAX_ATTEMPTS = 3;
export const WIN_THRESHOLD_MS = 273;
export const FEEDBACK_MS = 1500;
export const DIFFICULTIES = {
  moon: { name: "LUA", label: "Fácil", thresholdMs: 280 },
  sun: { name: "SOL", label: "Médio", thresholdMs: 250 },
  astro: { name: "ASTRO", label: "Difícil", thresholdMs: 230 },
} as const;
export type DifficultyId = keyof typeof DIFFICULTIES;
const idle: Snapshot = {
  phase: "IDLE",
  attempt: 0,
  milliseconds: null,
  outcome: null,
  reason: null,
};
export const randomDelay = (random: number) =>
  2000 + Math.min(1, Math.max(0, random)) * 4000;
export const secondsLabel = (ms: number) =>
  `${(ms / 1000).toFixed(3).replace(".", ",")} ${ms > 1000 ? "segundos" : "segundo"}`;

/** Owns a match of up to three attempts, independent of React and WebGL. */
export class ReactionEngine {
  private value: Snapshot = idle;
  private listeners = new Set<() => void>();
  private timer: number | null = null;
  private frame: number | null = null;
  private generation = 0;
  private presentedAt = 0;
  private winThresholdMs = WIN_THRESHOLD_MS;
  constructor(private scheduler: Scheduler) {}
  snapshot = () => this.value;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(value: Snapshot) {
    this.value = value;
    this.listeners.forEach((listener) => listener());
  }
  private cancel() {
    this.generation++;
    if (this.timer !== null) this.scheduler.cancelDelay(this.timer);
    if (this.frame !== null) this.scheduler.cancelFrame(this.frame);
    this.timer = this.frame = null;
  }
  start(winThresholdMs = WIN_THRESHOLD_MS) {
    if (this.value.phase === "IDLE") {
      this.winThresholdMs = winThresholdMs;
      this.beginAttempt(1);
    }
  }
  private beginAttempt(attempt: number) {
    this.cancel();
    const generation = this.generation;
    this.publish({
      phase: "WAITING",
      attempt,
      milliseconds: null,
      outcome: null,
      reason: null,
    });
    this.timer = this.scheduler.delay(() => {
      this.timer = null;
      if (generation !== this.generation) return;
      this.frame = this.scheduler.frame(() => {
        this.frame = null;
        if (generation !== this.generation || this.value.phase !== "WAITING")
          return;
        this.publish({ ...this.value, phase: "REACTION" });
        // Subscribers synchronously commit the DOM and visor in this rAF.
        // Start after submission, excluding that work from the reaction score.
        this.presentedAt = this.scheduler.now();
      });
    }, randomDelay(this.scheduler.random()));
  }
  tap(at = this.scheduler.now()) {
    if (this.value.phase === "WAITING") {
      this.fail("early", null);
    } else if (this.value.phase === "REACTION") {
      const milliseconds = Math.round(Math.max(0, at - this.presentedAt));
      if (milliseconds < this.winThresholdMs) {
        this.cancel();
        this.publish({
          ...this.value,
          phase: "RESULT",
          milliseconds,
          outcome: "won",
          reason: null,
        });
      } else this.fail("slow", milliseconds);
    }
  }
  private fail(reason: "early" | "slow", milliseconds: number | null) {
    this.cancel();
    const generation = this.generation;
    const attempt = this.value.attempt;
    this.publish({
      phase: "FEEDBACK",
      attempt,
      milliseconds,
      outcome: null,
      reason,
    });
    this.timer = this.scheduler.delay(() => {
      this.timer = null;
      if (generation !== this.generation) return;
      if (attempt < MAX_ATTEMPTS) this.beginAttempt(attempt + 1);
      else this.publish({ ...this.value, phase: "RESULT", outcome: "lost" });
    }, FEEDBACK_MS);
  }
  interrupt() {
    if (!["WAITING", "REACTION", "FEEDBACK"].includes(this.value.phase)) return;
    this.cancel();
    this.publish({
      ...this.value,
      phase: "INTERRUPTED",
      milliseconds: null,
      outcome: null,
      reason: "interrupted",
    });
  }
  reset() {
    this.cancel();
    this.publish(idle);
  }
  dispose() {
    this.cancel();
    this.listeners.clear();
  }
}
export const browserScheduler: Scheduler = {
  now: () => performance.now(),
  random: () => Math.random(),
  delay: (callback, ms) => window.setTimeout(callback, ms),
  cancelDelay: (id) => window.clearTimeout(id),
  frame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
};
