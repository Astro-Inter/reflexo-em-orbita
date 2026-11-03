import { DIFFICULTIES } from "./engine";
import type { DifficultyId } from "./engine";

export const RANKING_STORAGE_KEY = "astro-reflexo-ranking-v1";
export const RANKING_PASSWORD = "Astro@2026";
export const RANKING_LIMIT = 10;

export type RankingEntry = Readonly<{
  id: string;
  name: string;
  milliseconds: number;
  difficulty: DifficultyId | null;
}>;
export interface RankingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export type AddRecordResult = Readonly<{
  entries: RankingEntry[];
  position: number | null;
}>;

export const INITIAL_RANKING: RankingEntry[] = [];

function browserStorage(): RankingStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sorted(entries: RankingEntry[]) {
  return [...entries]
    .map((entry, index) => ({ entry, index }))
    .sort(
      (left, right) =>
        left.entry.milliseconds - right.entry.milliseconds ||
        left.index - right.index,
    )
    .slice(0, RANKING_LIMIT)
    .map(({ entry }) => entry);
}

function isEntry(value: unknown): value is RankingEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.name === "string" &&
    entry.name.length > 0 &&
    Number.isInteger(entry.milliseconds) &&
    Number(entry.milliseconds) >= 0 &&
    (entry.difficulty === null ||
      Object.hasOwn(DIFFICULTIES, String(entry.difficulty)))
  );
}

export function readRanking(storage: RankingStorage | null = browserStorage()) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RANKING_STORAGE_KEY);
    if (raw === null) {
      writeRanking(INITIAL_RANKING, storage);
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as { version?: unknown }).version !== 1 ||
      !Array.isArray((parsed as { entries?: unknown }).entries) ||
      !(parsed as { entries: unknown[] }).entries.every(isEntry)
    ) {
      writeRanking(INITIAL_RANKING, storage);
      return [];
    }
    const storedEntries = (parsed as { entries: RankingEntry[] }).entries;
    const withoutSeeds = storedEntries.filter((entry) => !entry.id.startsWith("seed-"));
    const ordered = sorted(withoutSeeds);
    if (withoutSeeds.length !== storedEntries.length) writeRanking(ordered, storage);
    return ordered;
  } catch {
    writeRanking([], storage);
    return [];
  }
}

export function writeRanking(
  entries: RankingEntry[],
  storage: RankingStorage | null = browserStorage(),
) {
  const topEntries = sorted(entries);
  try {
    storage?.setItem(
      RANKING_STORAGE_KEY,
      JSON.stringify({ version: 1, entries: topEntries }),
    );
  } catch {
    // Keep the in-memory ranking available if browser storage is blocked/full.
  }
  return topEntries;
}

export function qualifiesForRanking(
  milliseconds: number,
  entries: RankingEntry[],
) {
  const current = sorted(entries);
  return (
    Number.isInteger(milliseconds) &&
    milliseconds >= 0 &&
    (current.length < RANKING_LIMIT ||
      milliseconds < current[RANKING_LIMIT - 1].milliseconds)
  );
}

export function addRankingEntry(
  entries: RankingEntry[],
  name: string,
  milliseconds: number,
  difficulty: DifficultyId,
  id: string = globalThis.crypto?.randomUUID?.() ?? `record-${Date.now()}`,
): AddRecordResult {
  const cleanName = name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
  if (!cleanName || !qualifiesForRanking(milliseconds, entries)) {
    return { entries: sorted(entries), position: null };
  }
  const next = sorted([
    ...entries,
    { id, name: cleanName, milliseconds, difficulty },
  ]);
  const position = next.findIndex((entry) => entry.id === id);
  return { entries: next, position: position === -1 ? null : position + 1 };
}

export function resetRanking(
  password: string,
  storage: RankingStorage | null = browserStorage(),
) {
  if (password !== RANKING_PASSWORD) return null;
  if (storage) {
    try {
      storage.removeItem(RANKING_STORAGE_KEY);
    } catch {
      // Re-seeding below still restores the current in-memory view.
    }
  }
  return writeRanking(INITIAL_RANKING, storage);
}
