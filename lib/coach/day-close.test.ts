import { describe, expect, it } from "vitest";
import { dayCloseComment } from "./day-close";

const base = { has_food: true, kcal: 2600, kcal_target: 2680, protein_g: 160, protein_target: 155, fiber_g: 31, fiber_target: 30, sleep_min: 460, weight_kg: 79.4, runs: [], strength_done: false, planned: [] };

describe("comentário de fecho do dia", () => {
  it("dia sólido", () => {
    const c = dayCloseComment({ ...base, runs: [{ km: 9.37, pace: 5.6, avg_hr: 138 }], planned: [{ type: "fácil", title: "8km a fácil", status: "feito", score: 90 }] });
    expect(c).toBe("Dia sólido. Corrida: 9,4 km a 5:36/km, FC 138. Comeste 2600 kcal (alvo 2680, -80). Peso 79,4 kg. Treino bem executado (90/100), calorias no alvo, proteína cumprida (160 g), bom sono (7:40).");
  });
  it("aponta o que corrigir", () => {
    const c = dayCloseComment({ ...base, kcal: 3200, protein_g: 110, fiber_g: 12, sleep_min: 340, planned: [{ type: "qualidade", title: "4×2000m a RHM", status: "planeado", score: 0 }] });
    expect(c).toContain("Dia a corrigir.");
    expect(c).toContain("ficou por fazer: 4×2000m a RHM");
    expect(c).toContain("520 kcal acima do alvo");
    expect(c).toContain("proteína curta (110 de 155 g)");
    expect(c).toContain("sono curto (5:40)");
  });
  it("descanso e sem comida registada", () => {
    const c = dayCloseComment({ ...base, has_food: false, planned: [{ type: "descanso", title: "Descanso", status: "planeado", score: 0 }] });
    expect(c).toContain("Descanso respeitado");
    expect(c).toContain("sem registo de comida");
  });
});
