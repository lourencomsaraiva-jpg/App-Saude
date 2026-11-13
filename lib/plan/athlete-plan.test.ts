import { describe, expect, it } from "vitest";
import { weekdayMon0 } from "../calc/dates";
import { buildAthletePlan } from "./athlete-plan";

describe("plano do atleta (Ago–Dez 2026)", () => {
  const plan = buildAthletePlan();
  const on = (d: string) => plan.filter((w) => w.date === d);

  it("17 semanas, de 24/08 a 20/12, um registo por dia", () => {
    expect(plan).toHaveLength(17 * 7);
    expect(plan[0].date).toBe("2026-08-24");
    expect(plan[plan.length - 1].date).toBe("2026-12-20");
    expect(new Set(plan.map((w) => w.date)).size).toBe(plan.length);
  });
  it("provas nas datas certas", () => {
    expect(on("2026-09-13")[0]).toMatchObject({ type: "prova", title: "🏁 Corrida do Tejo 10km" });
    expect(on("2026-10-11")[0].title).toContain("Meia Maratona de Lisboa");
    expect(on("2026-11-28")[0]).toMatchObject({ type: "prova", distance_km: 21.1 });
    expect(on("2026-12-20")[0].title).toContain("Benfica");
  });
  it("semana tipo: seg descanso, qua/sex força", () => {
    for (const w of plan) {
      const dow = weekdayMon0(w.date);
      if (dow === 0) expect(w.type).toBe("descanso");
      if (dow === 2 || dow === 4) expect(w.type).toBe("força");
    }
  });
  it("semana 12: ter 10/11 2×5km a RHM; dom 15/11 longo máximo 22km", () => {
    expect(on("2026-11-10")[0].title).toBe("2×5km a RHM ajustado c/3min trote");
    expect(on("2026-11-12")[0]).toMatchObject({ type: "fácil", title: "8km a fácil (5:30-5:55/km)", target_hr_max: 150 });
    expect(on("2026-11-15")[0].title).toContain("longo máximo");
  });
  it("texto original fica na estrutura (aq, corpo, desaq)", () => {
    const s = on("2026-11-08")[0].structure.map((x) => x.description).join(" | ");
    expect(s).toContain("Se a FC passar de 175 antes do km 14, baixar para 4:30.");
  });
});
