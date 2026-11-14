import { describe, expect, it } from "vitest";
import { nutritionDayScore, progressIndex, weightScore, type ProgressDay } from "./progress";

const day = (date: string, o: Partial<ProgressDay> = {}): ProgressDay => ({
  date, weight_kg: null, steps: null, resting_hr: null, hrv: null, sleep_min: null, sleep_score: null,
  has_food: false, kcal: 0, kcal_target: 2400, protein_g: null, protein_target: 155, fiber_g: null, fiber_target: 30, run_cardiac_costs: [], ...o,
});

describe("índice de evolução", () => {
  it("peso: ritmo de perda", () => {
    expect(weightScore(-0.5, false)).toBe(100);
    expect(weightScore(0, false)).toBe(50);
    expect(weightScore(0.5, false)).toBe(0);
    expect(weightScore(-0.125, false)).toBe(75);
    expect(weightScore(-1.5, false)).toBe(70);
    expect(weightScore(0, true)).toBe(100);
  });
  it("nutrição: kcal no alvo, proteína e fibra", () => {
    expect(nutritionDayScore({ kcal: 2400, kcal_target: 2400, protein_g: 155, protein_target: 155, fiber_g: 30, fiber_target: 30 })).toBe(100);
    expect(nutritionDayScore({ kcal: 3120, kcal_target: 2400, protein_g: 155, protein_target: 155, fiber_g: null, fiber_target: 30 })).toBeCloseTo(37.5, 1);
    expect(nutritionDayScore({ kcal: 0, kcal_target: 2400, protein_g: null, protein_target: 155, fiber_g: null, fiber_target: 30 })).toBeNull();
  });
  it("semana: média dos componentes com dados; treino até hoje", () => {
    const days = [
      day("2026-11-02", { weight_kg: 81, sleep_min: 450, steps: 10000 }),
      day("2026-11-03", { weight_kg: 81 }),
      day("2026-11-09", { weight_kg: 80.5, sleep_min: 300, steps: 5000 }),
      day("2026-11-10", { weight_kg: 80.5 }),
    ];
    const planned = [
      { date: "2026-11-10", type: "fácil", status: "feito" },
      { date: "2026-11-11", type: "força", status: "planeado" },
      { date: "2026-11-13", type: "fácil", status: "planeado" },
      { date: "2026-11-09", type: "descanso", status: "planeado" },
    ];
    const w = progressIndex(days, planned, { today: "2026-11-12", goalWeightKg: 76 });
    expect(w[0].parts).toMatchObject({ peso: null, sono: 100, passos: 100, treino: null });
    expect(w[0].index).toBe(100);
    expect(w[1].parts).toMatchObject({ peso: 100, sono: 0, passos: 50, treino: 50 });
    expect(w[1].raw.weight_delta).toBe(-0.5);
    expect(w[1].index).toBe(50);
  });
});
