import { describe, expect, it } from "vitest";
import { distanceScore, workKm, workoutExecution } from "./execution";

const km = (paceS: number, hr: number) => ({ distance_m: 1000, duration_s: paceS, avg_hr: hr });

describe("execução vs plano", () => {
  it("distância", () => {
    expect(distanceScore(10, 10.5)).toBe(1);
    expect(distanceScore(6, 10)).toBe(0);
    expect(distanceScore(14.6, 11.5)).toBeCloseTo(0.66, 2);
  });
  it("km de trabalho pelo título", () => {
    expect(workKm("4×2000m a RHM", 14)).toBe(8);
    expect(workKm("2×5km a RHM", 15)).toBe(10);
    expect(workKm("Longo 18 km: 10 fácil + 8 a ritmo de meia", 18)).toBe(8);
    expect(workKm("Longo 10km: últimos 3 a ritmo 10 km", 12.5)).toBe(3);
  });
  it("fácil perfeito = 100; fácil com FC alta e km a mais perde pontos", () => {
    const p = { type: "fácil", title: "8km a fácil", distance_km: 10.5, target_pace_min_s: 330, target_pace_max_s: 355, target_hr_max: 150 };
    expect(workoutExecution(p, { distance_m: 10200, avg_hr: 138 }, Array(10).fill(km(340, 138)))).toBe(100);
    const bad = workoutExecution(p, { distance_m: 14600, avg_hr: 155 }, [...Array(10).fill(km(340, 145)), ...Array(4).fill(km(320, 160))]);
    expect(bad).toBeLessThan(70);
  });
  it("séries: km no ritmo-alvo vs previstos", () => {
    const p = { type: "qualidade", title: "4×2000m a RHM", distance_km: 14, target_pace_min_s: 245, target_pace_max_s: 260, target_hr_max: 175 };
    const good = [...Array(3).fill(km(340, 130)), ...Array(8).fill(km(252, 165)), ...Array(3).fill(km(350, 140))];
    expect(workoutExecution(p, { distance_m: 14000, avg_hr: 160 }, good)).toBe(100);
    const slow = [...Array(3).fill(km(340, 130)), ...Array(8).fill(km(275, 165)), ...Array(3).fill(km(350, 140))];
    expect(workoutExecution(p, { distance_m: 14000, avg_hr: 160 }, slow)).toBe(60);
  });
  it("não feito = 0; força feita = 100", () => {
    const p = { type: "força", title: "Força", distance_km: null, target_pace_min_s: null, target_pace_max_s: null, target_hr_max: null };
    expect(workoutExecution(p, { distance_m: null, avg_hr: 90 }, [])).toBe(100);
    expect(workoutExecution({ ...p, type: "fácil" }, null, [])).toBe(0);
  });
});
