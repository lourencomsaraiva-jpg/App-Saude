import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_ENERGY_SETTINGS as S } from "../calc/energy";
import { summarizeDay } from "../calc/day";
import { DEFAULT_PHASES } from "../defaults";
import type { DayView } from "../data/days";
import { mapSeedEntry, type SeedEntry } from "./seed";
import { compareWithFile } from "./verify";

/** Simula o caminho da app (mapear → guardar → somar) sem base de dados. */
function simulate(entries: SeedEntry[]): DayView[] {
  return entries.map((e) => {
    const m = mapSeedEntry(e);
    const summary = summarizeDay(
      { date: m.day.date, items: [m.mealItem], activityKcalRaw: m.activity ? [m.activity.kcal_raw] : [], exerciseKcalRawOverride: m.day.exercise_kcal_raw_override },
      S,
      DEFAULT_PHASES,
    );
    return { date: m.day.date, summary, weight_kg: m.day.weight_kg, sleep: m.sleep ? { total_min: m.sleep.total_min } : null } as unknown as DayView;
  });
}

const FIXTURE: SeedEntry[] = [
  { data: "2026-07-30", peso: "82.6", caloriasConsumidas: "1774", gastoNormal: "2417", gastoExercicio: "530", proteina: "140", hidratos: "", gordura: "", fibra: "", distancia: "6.47", ritmo: "5:39", fc: "144", sono: "8:26", notas: "Treino fácil cumprido." },
  { data: "2026-07-31", peso: "83.0", caloriasConsumidas: "1742", gastoNormal: "2417", gastoExercicio: "229", distancia: "9", fc: "81 (ciclismo) / 132 (força)", sono: "8:45", notas: "Ciclismo recuperação + força." },
  { data: "2026-11-10", caloriasConsumidas: "2600", gastoNormal: "2417", gastoExercicio: "934", proteina: "160.4", hidratos: "300.2", gordura: "60.1", fibra: "25.5", sono: "7:35 (profundo 1:37, leve 4:49, REM 1:09, acordado 27min)" },
  { data: "2026-11-12", caloriasConsumidas: "1250", gastoNormal: "2417", gastoExercicio: "663", proteina: "100.6", hidratos: "144.8", gordura: "27.5", fibra: "7.5", distancia: "9.37", ritmo: "5:36", fc: "138" },
];

describe("importação do histórico", () => {
  it("mapeia um dia de corrida", () => {
    const m = mapSeedEntry(FIXTURE[0]);
    expect(m.activity?.type).toBe("corrida");
    expect(m.activity?.distance_m).toBe(6470);
    expect(m.activity?.avg_hr).toBe(144);
    expect(m.day.exercise_kcal_raw_override).toBe(530);
    expect(m.mealItem.carbs_g).toBeNull();
  });
  it("natação (ritmo por 100 m) não é corrida", () => {
    expect(mapSeedEntry({ data: "2026-08-23", distancia: "1.00", ritmo: "1:13/100m", fc: "109 (máx 122)" }).activity?.type).toBe("natação");
  });
  it("dia de bicicleta + força", () => {
    expect(mapSeedEntry(FIXTURE[1]).activity?.type).toBe("bicicleta");
  });
  it("sono com fases", () => {
    const s = mapSeedEntry(FIXTURE[2]).sleep!;
    expect(s.day_date).toBe("2026-11-10");
    expect([s.total_min, s.deep_min, s.light_min, s.rem_min, s.awake_min]).toEqual([455, 97, 289, 69, 27]);
  });
  it("totais e saldos coincidem com o ficheiro (fixture)", () => {
    expect(compareWithFile(FIXTURE, simulate(FIXTURE), S)).toEqual([]);
  });
  it("10/11: saldo = 2600 − 2417 − 887", () => {
    expect(simulate([FIXTURE[2]])[0].summary.balance_kcal).toBe(2600 - 2417 - 887);
  });

  const realPath = "data/seed_entries.json";
  it.runIf(existsSync(realPath))("totais e saldos coincidem com o ficheiro real (data/seed_entries.json)", () => {
    const entries = JSON.parse(readFileSync(realPath, "utf8")) as SeedEntry[];
    expect(compareWithFile(entries, simulate(entries), S)).toEqual([]);
  });
});
