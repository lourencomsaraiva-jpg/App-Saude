import { describe, expect, it } from "vitest";
import { foodComment, workoutComment } from "./comments";

describe("comentários de comida", () => {
  it("snack de bolachas e gomas ao fim do dia, véspera do longo", () => {
    const c = foodComment({
      hour: 21,
      entry: { kcal: 350, protein_g: 5.2, carbs_g: 62.4, fat_g: 8.6, fiber_g: 0.6 },
      remaining: { kcal: 168, protein_g: 34.6, carbs_g: 40.9, fat_g: -1.5, fiber_g: 16 },
      target: { kcal: 2148, protein_g: 155 },
      tomorrowWorkout: { type: "longo", title: "Longo 22km: 12 fácil + 10 a RHM — longo máximo" },
    }).join(" ");
    expect(c).toContain("sobretudo hidratos e gordura");
    expect(c).toContain("Restam 168 kcal e faltam 34,6 g de proteína");
    expect(c).toContain("1 scoop de whey (≈118 kcal, 24,5 g P)");
    expect(c).toContain("Amanhã tens Longo 22km");
  });
  it("passou o alvo", () => {
    expect(foodComment({ hour: 22, entry: { kcal: 500, protein_g: 10, carbs_g: 60, fat_g: 25, fiber_g: 2 }, remaining: { kcal: -300, protein_g: 0, carbs_g: -20, fat_g: -10, fiber_g: 5 }, target: { kcal: 2050, protein_g: 155 } }).join(" ")).toContain("Já passaste o alvo do dia em 300 kcal");
  });
  it("refeição com boa proteína", () => {
    expect(foodComment({ hour: 13, entry: { kcal: 730, protein_g: 54, carbs_g: 75, fat_g: 23, fiber_g: 5 }, remaining: { kcal: 1200, protein_g: 60, carbs_g: 150, fat_g: 20, fiber_g: 20 }, target: { kcal: 2680, protein_g: 155 } })[0]).toBe("Boa dose de proteína nesta refeição (54,0 g).");
  });
});

describe("comentários de treino", () => {
  it("fácil com FC controlada mas km acima do teto (12/11)", () => {
    const c = workoutComment({
      type: "corrida", distanceKm: 9.37, pace: 5.6, avgHr: 138, maxHr: 167, cardiacCost: 77.3, easyHrMax: 150,
      planned: { type: "fácil", title: "8km a fácil", distanceKm: 10.5, paceMinS: 330, paceMaxS: 355, hrMax: 150 },
      splits: [{ pace: 5.97, avgHr: 125 }, { pace: 5.6, avgHr: 140 }, { pace: 5.6, avgHr: 158 }],
      similarCardiacCost: 80.1,
      tomorrow: { type: "força", title: "Força — Estabilidade + Braços" },
    }).join(" ");
    expect(c).toContain("1 km passou do teto de 150");
    expect(c).toContain("Eficiência melhor do que a média recente");
    expect(c).toContain("Amanhã: Força — Estabilidade + Braços");
  });
  it("séries: km no ritmo-alvo", () => {
    const c = workoutComment({
      type: "corrida", distanceKm: 15, pace: 4.9, avgHr: 160, maxHr: 176, cardiacCost: 78, easyHrMax: 150,
      planned: { type: "qualidade", title: "2×5km a RHM", distanceKm: 15, paceMinS: 250, paceMaxS: 265, hrMax: 175 },
      splits: [{ pace: 5.8, avgHr: 130 }, { pace: 4.3, avgHr: 165 }, { pace: 4.25, avgHr: 168 }, { pace: 4.0, avgHr: 172 }],
    }).join(" ");
    expect(c).toContain("2 km ficaram no ritmo-alvo (4:10–4:25/km); 1 mais rápido do que o alvo");
  });
  it("força", () => {
    expect(workoutComment({ type: "força", distanceKm: null, pace: null, avgHr: null, maxHr: null, cardiacCost: null, splits: [], easyHrMax: 150 })[0]).toContain("Força feita");
  });
});
