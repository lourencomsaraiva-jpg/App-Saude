import { loadDays } from "../data/days";
import { loadSettings } from "../data/settings";
import type { DB } from "../types";
import type { SeedEntry } from "./seed";
import { compareWithFile } from "./verify";

/** Lê da base de dados os dias importados e compara com o ficheiro. */
export async function verifyImport(db: DB, entries: SeedEntry[], userId?: string) {
  if (!entries.length) return [];
  const dates = entries.map((e) => e.data).sort();
  const settings = await loadSettings(db, userId);
  const days = await loadDays(db, dates[0], dates[dates.length - 1], settings, true, userId);
  return compareWithFile(entries, days, settings.energy);
}
