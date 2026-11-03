import { describe, expect, it } from "vitest";
import {
  INITIAL_RANKING,
  RANKING_PASSWORD,
  RANKING_STORAGE_KEY,
  addRankingEntry,
  qualifiesForRanking,
  readRanking,
  resetRanking,
  writeRanking,
} from "./ranking";
import type { RankingStorage } from "./ranking";

function memoryStorage(): RankingStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

describe("local ranking", () => {
  it("seeds the three initial names and preserves them in browser storage", () => {
    const storage = memoryStorage();
    expect(readRanking(storage)).toEqual(INITIAL_RANKING);
    expect(readRanking(storage)).toEqual([
      { id: "seed-astrinhozinho", name: "ASTRINHOZINHO", milliseconds: 99, difficulty: null },
      { id: "seed-astrinho", name: "ASTRINHO", milliseconds: 125, difficulty: null },
      { id: "seed-astrao", name: "ASTRÃO", milliseconds: 150, difficulty: null },
    ]);
    expect(storage.getItem(RANKING_STORAGE_KEY)).not.toBeNull();
  });

  it("inserts a qualifying result in time order and keeps only ten", () => {
    let entries = [...INITIAL_RANKING];
    const first = addRankingEntry(entries, "  Bia  Astro ", 75, "sun", "bia");
    entries = first.entries;
    expect(first.position).toBe(1);
    expect(entries[0]).toMatchObject({ id: "bia", name: "Bia Astro", milliseconds: 75 });
    for (let index = 0; index < 12; index++) {
      entries = addRankingEntry(entries, `Jogador ${index}`, 260 + index, "moon", `id-${index}`).entries;
    }
    expect(entries).toHaveLength(10);
    expect(entries.map((entry) => entry.milliseconds)).toEqual(
      [...entries].map((entry) => entry.milliseconds).sort((a, b) => a - b),
    );
  });

  it("only prompts when the score can enter the top ten", () => {
    const full = Array.from({ length: 10 }, (_, index) => ({
      id: `id-${index}`,
      name: `Jogador ${index}`,
      milliseconds: 200 + index,
      difficulty: "sun" as const,
    }));
    expect(qualifiesForRanking(209, full)).toBe(false);
    expect(qualifiesForRanking(208, full)).toBe(true);
    expect(qualifiesForRanking(1000, INITIAL_RANKING)).toBe(true);
  });

  it("sanitizes names and declines a blank or nonqualifying insertion", () => {
    expect(addRankingEntry(INITIAL_RANKING, " \n ", 200, "astro", "blank").position).toBeNull();
    expect(
      addRankingEntry(INITIAL_RANKING, "<Luna>\u0000", 100, "astro", "clean")
        .entries.find((entry) => entry.name === "<Luna>")?.name,
    ).toBe("<Luna>");
  });

  it("persists entries and restores the seeded ranking only with the exact password", () => {
    const storage = memoryStorage();
    const custom = addRankingEntry(INITIAL_RANKING, "Luna", 80, "astro", "luna").entries;
    writeRanking(custom, storage);
    expect(readRanking(storage).some((entry) => entry.name === "Luna")).toBe(true);
    expect(resetRanking("astro@2026", storage)).toBeNull();
    expect(readRanking(storage).some((entry) => entry.name === "Luna")).toBe(true);
    expect(resetRanking(` ${RANKING_PASSWORD} `, storage)).toBeNull();
    expect(readRanking(storage).some((entry) => entry.name === "Luna")).toBe(true);
    expect(resetRanking(RANKING_PASSWORD, storage)).toEqual(INITIAL_RANKING);
    expect(readRanking(storage)).toEqual(INITIAL_RANKING);
  });

  it("reinitializes malformed saved data", () => {
    const storage = memoryStorage();
    storage.setItem(RANKING_STORAGE_KEY, "not json");
    expect(readRanking(storage)).toEqual(INITIAL_RANKING);
    expect(JSON.parse(storage.getItem(RANKING_STORAGE_KEY)!).version).toBe(1);
  });

  it("migrates old seeded times without removing player scores", () => {
    const storage = memoryStorage();
    const previousSeed = INITIAL_RANKING.map((entry) => ({
      ...entry,
      milliseconds: 321,
    }));
    const previousScore = {
      id: "saved-player",
      name: "Jogador",
      milliseconds: 230,
      difficulty: "sun" as const,
    };
    storage.setItem(
      RANKING_STORAGE_KEY,
      JSON.stringify({ version: 1, entries: [...previousSeed, previousScore] }),
    );
    const migrated = readRanking(storage);
    expect(migrated.slice(0, 3).map(({ milliseconds }) => milliseconds)).toEqual([
      99, 125, 150,
    ]);
    expect(migrated.find(({ id }) => id === "saved-player")).toEqual(previousScore);
  });
});
