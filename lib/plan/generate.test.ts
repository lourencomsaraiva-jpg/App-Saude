import { describe, expect, it } from "vitest";
import { generatePlan, weeklyCompliance } from "./generate";

const profile = { easy_pace_min_s: 330, easy_pace_max_s: 355, easy_hr_max: 150, threshold_hr_min: 162, threshold_hr_max: 175, goal_hm_s: 5400, goal_10k_s: 2400 };

describe("plano até 20/12/2026", () => {
  const plan = generatePlan(profile);
  it("vai de 09/11 a 20/12, um treino por dia", () => {
    expect(plan[0].date).toBe("2026-11-09");
    expect(plan[plan.length - 1].date).toBe("2026-12-20");
    expect(plan).toHaveLength(42);
  });
  it("provas nas datas certas", () => {
    expect(plan.find((w) => w.date === "2026-11-28")?.type).toBe("prova");
    expect(plan.find((w) => w.date === "2026-12-20")?.type).toBe("prova");
  });
  it("12/11 é fácil de 9 km a 5:30–5:55, FC < 150", () => {
    const w = plan.find((x) => x.date === "2026-11-12")!;
    expect(w.type).toBe("fácil");
    expect(w.distance_km).toBe(9);
    expect(w.target_pace_min_s).toBe(330);
    expect(w.target_hr_max).toBe(150);
  });
  it("segundas são descanso", () => {
    expect(plan.filter((w) => w.date === "2026-11-16" || w.date === "2026-12-07").every((w) => w.type === "descanso")).toBe(true);
  });
  it("~80 % fácil / 20 % intenso (sem contar os dias de prova)", () => {
    const runs = plan.filter((w) => ["fácil", "longo", "qualidade"].includes(w.type));
    const total = runs.reduce((s, w) => s + (w.distance_km ?? 0), 0);
    // km intensos: séries das sessões de qualidade (reps × 1 km) e blocos a ritmo de prova nos longos
    const hard = runs.reduce((s, w) => {
      const serie = w.structure.find((x) => x.kind === "série");
      if (w.type === "qualidade") return s + (serie?.repeat ?? 0);
      const block = serie?.description.match(/^(\d+) km/);
      return s + (w.type === "longo" && block ? Number(block[1]) : 0);
    }, 0);
    expect(hard / total).toBeGreaterThan(0.12);
    expect(hard / total).toBeLessThanOrEqual(0.22);
  });
});

describe("cumprimento semanal", () => {
  it("conta feitos sobre planeados, sem descansos", () => {
    expect(
      weeklyCompliance([
        { week_index: 1, type: "descanso", status: "planeado" },
        { week_index: 1, type: "fácil", status: "feito" },
        { week_index: 1, type: "qualidade", status: "falhado" },
      ]),
    ).toEqual([{ week_index: 1, planned: 2, done: 1, pct: 50 }]);
  });
});
