import { describe, expect, it } from "vitest";
import {
  ReactionEngine,
  randomDelay,
  secondsLabel,
  FEEDBACK_MS,
} from "./engine";
import type { Scheduler } from "./engine";

function harness(random = 0.5) {
  let time = 0,
    nextId = 0,
    randomValue = random;
  const delays = new Map<number, { callback: () => void; ms: number }>();
  const frames = new Map<number, () => void>();
  const scheduler: Scheduler = {
    now: () => time,
    random: () => randomValue,
    delay: (callback, ms) => {
      const id = ++nextId;
      delays.set(id, { callback, ms });
      return id;
    },
    cancelDelay: (id) => {
      delays.delete(id);
    },
    frame: (callback) => {
      const id = ++nextId;
      frames.set(id, callback);
      return id;
    },
    cancelFrame: (id) => {
      frames.delete(id);
    },
  };
  const engine = new ReactionEngine(scheduler);
  const due = () => {
    const tasks = [...delays.values()];
    delays.clear();
    tasks.forEach((task) => task.callback());
  };
  const paint = () => {
    const tasks = [...frames.values()];
    frames.clear();
    tasks.forEach((callback) => callback());
  };
  return {
    engine,
    delays,
    frames,
    due,
    paint,
    time: (value: number) => {
      time = value;
    },
    random: (value: number) => {
      randomValue = value;
    },
    signal: () => {
      due();
      paint();
    },
    react: (ms: number) => {
      time += ms;
      engine.tap();
    },
  };
}

describe("three-chance match", () => {
  it("starts idle without timers and chooses the full 3–6 second interval", () => {
    const h = harness();
    expect(h.engine.snapshot()).toMatchObject({
      phase: "IDLE",
      attempt: 0,
      outcome: null,
    });
    expect(h.delays.size).toBe(0);
    expect([randomDelay(0), randomDelay(0.5), randomDelay(1)]).toEqual([
      2000, 4000, 6000,
    ]);
    expect(randomDelay(-1)).toBe(2000);
    expect(randomDelay(2)).toBe(6000);
    h.engine.start();
    expect([...h.delays.values()][0].ms).toBe(4500);
  });
  it("does not show the alert before its animation frame", () => {
    const h = harness();
    h.engine.start();
    h.due();
    expect(h.engine.snapshot().phase).toBe("WAITING");
    h.paint();
    expect(h.engine.snapshot().phase).toBe("REACTION");
  });
  it("measures from the visual commit and excludes rendering time", () => {
    const h = harness();
    h.engine.subscribe(() => {
      if (h.engine.snapshot().phase === "REACTION") h.time(4560);
    });
    h.engine.start();
    h.time(4500);
    h.signal();
    h.time(4803);
    h.engine.tap();
    expect(h.engine.snapshot()).toMatchObject({
      milliseconds: 243,
      outcome: "won",
      attempt: 1,
    });
  });
  it.each([
    [272, "RESULT", "won"],
    [273, "FEEDBACK", null],
    [274, "FEEDBACK", null],
  ] as const)(
    "classifies %s ms with a strict displayed-score threshold",
    (ms, phase, outcome) => {
      const h = harness();
      h.engine.start();
      h.signal();
      h.react(ms);
      expect(h.engine.snapshot()).toMatchObject({
        phase,
        outcome,
        milliseconds: ms,
      });
    },
  );
  it.each([
    [350, 349, "RESULT", "won"],
    [350, 350, "FEEDBACK", null],
    [273, 272, "RESULT", "won"],
    [273, 273, "FEEDBACK", null],
    [200, 199, "RESULT", "won"],
    [200, 200, "FEEDBACK", null],
  ] as const)(
    "uses the selected %s ms limit for a %s ms reaction",
    (threshold, ms, phase, outcome) => {
      const h = harness();
      h.engine.start(threshold);
      h.signal();
      h.react(ms);
      expect(h.engine.snapshot()).toMatchObject({
        phase,
        outcome,
        milliseconds: ms,
      });
    },
  );
  it("rounds the measured score before comparing the integer displayed to the player", () => {
    const h = harness();
    h.engine.start();
    h.signal();
    h.react(272.6);
    expect(h.engine.snapshot()).toMatchObject({
      phase: "FEEDBACK",
      milliseconds: 273,
    });
  });
  it("ends immediately on the first win without scheduling another alert", () => {
    const h = harness();
    h.engine.start();
    h.signal();
    h.react(150);
    h.engine.tap();
    h.engine.start();
    h.due();
    h.paint();
    expect(h.engine.snapshot()).toMatchObject({
      phase: "RESULT",
      outcome: "won",
      attempt: 1,
      milliseconds: 150,
    });
    expect(h.delays.size + h.frames.size).toBe(0);
  });
  it("shows sad feedback, ignores extra presses, then focuses with a new random delay", () => {
    const h = harness(0);
    h.engine.start();
    h.signal();
    h.react(400);
    expect([...h.delays.values()][0].ms).toBe(FEEDBACK_MS);
    h.engine.tap();
    expect(h.engine.snapshot().attempt).toBe(1);
    h.random(1);
    h.due();
    expect(h.engine.snapshot()).toMatchObject({
      phase: "WAITING",
      attempt: 2,
      milliseconds: null,
      reason: null,
    });
    expect([...h.delays.values()][0].ms).toBe(6000);
  });
  it.each([2, 3])(
    "allows a win on chance %s and cancels all remaining work",
    (winningAttempt) => {
      const h = harness();
      h.engine.start();
      for (let attempt = 1; attempt <= winningAttempt; attempt++) {
        h.signal();
        h.react(attempt === winningAttempt ? 200 : 400);
        if (attempt < winningAttempt) h.due();
      }
      expect(h.engine.snapshot()).toMatchObject({
        phase: "RESULT",
        outcome: "won",
        attempt: winningAttempt,
      });
      expect(h.delays.size + h.frames.size).toBe(0);
    },
  );
  it("stops after exactly three unsuccessful chances, without a fourth alert", () => {
    const h = harness();
    h.engine.start();
    for (let attempt = 1; attempt <= 3; attempt++) {
      h.signal();
      h.react(450);
      expect(h.engine.snapshot()).toMatchObject({ phase: "FEEDBACK", attempt });
      h.due();
    }
    h.due();
    h.paint();
    h.engine.tap();
    expect(h.engine.snapshot()).toMatchObject({
      phase: "RESULT",
      outcome: "lost",
      attempt: 3,
      milliseconds: 450,
    });
    expect(h.delays.size + h.frames.size).toBe(0);
  });
  it("consumes one chance for an early press without awarding a time", () => {
    const h = harness();
    h.engine.start();
    h.engine.tap();
    expect(h.engine.snapshot()).toMatchObject({
      phase: "FEEDBACK",
      attempt: 1,
      reason: "early",
      milliseconds: null,
    });
    h.due();
    expect(h.engine.snapshot()).toMatchObject({ phase: "WAITING", attempt: 2 });
  });
  it("an early press between timer expiry and paint cancels the pending signal", () => {
    const h = harness();
    h.engine.start();
    h.due();
    h.engine.tap();
    h.paint();
    expect(h.engine.snapshot()).toMatchObject({
      phase: "FEEDBACK",
      reason: "early",
    });
    expect(h.frames.size).toBe(0);
  });
  it("three early presses lose without a fabricated score", () => {
    const h = harness();
    h.engine.start();
    for (let index = 0; index < 3; index++) {
      h.engine.tap();
      h.due();
    }
    expect(h.engine.snapshot()).toMatchObject({
      phase: "RESULT",
      outcome: "lost",
      milliseconds: null,
      attempt: 3,
    });
  });
  it.each(["waiting", "reaction", "feedback"])(
    "invalidates focus loss during %s and cancels automatic continuation",
    (stage) => {
      const h = harness();
      h.engine.start();
      if (stage !== "waiting") h.signal();
      if (stage === "feedback") h.react(400);
      h.engine.interrupt();
      h.due();
      h.paint();
      h.engine.tap();
      expect(h.engine.snapshot()).toMatchObject({
        phase: "INTERRUPTED",
        milliseconds: null,
        outcome: null,
        reason: "interrupted",
      });
      expect(h.delays.size + h.frames.size).toBe(0);
    },
  );
  it("reset cancels stale callbacks, clears the match and restores three chances", () => {
    const h = harness();
    h.engine.start();
    const stale = [...h.delays.values()][0].callback;
    h.engine.reset();
    h.engine.start();
    stale();
    expect(h.frames.size).toBe(0);
    h.signal();
    h.react(400);
    const oldFeedback = [...h.delays.values()][0].callback;
    h.engine.reset();
    h.engine.start();
    oldFeedback();
    expect(h.engine.snapshot()).toMatchObject({
      phase: "WAITING",
      attempt: 1,
      outcome: null,
      milliseconds: null,
    });
  });
  it("supports twenty sequential participants without leaking timers", () => {
    const h = harness();
    for (let index = 0; index < 20; index++) {
      h.engine.start();
      h.signal();
      h.react(243);
      h.engine.reset();
      expect(h.engine.snapshot()).toMatchObject({
        phase: "IDLE",
        attempt: 0,
        milliseconds: null,
      });
      expect(h.delays.size + h.frames.size).toBe(0);
    }
  });
  it("ignores duplicate starts and idle presses; disposal removes callbacks", () => {
    const h = harness();
    h.engine.tap();
    expect(h.engine.snapshot().phase).toBe("IDLE");
    let calls = 0;
    const unsubscribe = h.engine.subscribe(() => calls++);
    h.engine.start();
    h.engine.start();
    expect(h.delays.size).toBe(1);
    unsubscribe();
    h.signal();
    expect(calls).toBe(1);
    h.react(400);
    h.engine.dispose();
    expect(h.delays.size + h.frames.size).toBe(0);
  });
  it("formats seconds in Portuguese", () => {
    expect(secondsLabel(243)).toBe("0,243 segundo");
    expect(secondsLabel(2500)).toBe("2,500 segundos");
  });
});
