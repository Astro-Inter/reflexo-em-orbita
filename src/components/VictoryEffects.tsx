import type { CSSProperties } from "react";

// Deterministic decoration keeps the game's random alert generator independent.
export function VictoryEffects() {
  return (
    <div className="victory-effects" aria-hidden="true">
      <div className="victory-ring victory-ring-first" />
      <div className="victory-ring victory-ring-second" />
      <div className="victory-burst">
        {Array.from({ length: 18 }, (_, index) => (
          <i key={index} style={{ "--i": index } as CSSProperties} />
        ))}
      </div>
      <div className="victory-confetti">
        {Array.from({ length: 64 }, (_, index) => (
          <i
            key={index}
            style={
              {
                "--x": `${(index * 47 + 13) % 101}%`,
                "--drift": `${((index * 31) % 181) - 90}px`,
                "--delay": `${((index * 17) % 15) * 0.08}s`,
                "--duration": `${3.2 + ((index * 7) % 14) * 0.12}s`,
                "--turn": `${(index % 2 ? 1 : -1) * (360 + (index % 4) * 180)}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
