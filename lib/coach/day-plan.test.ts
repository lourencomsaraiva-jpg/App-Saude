import { describe, expect, it } from "vitest";
import { DEFAULT_FOODS } from "../defaults";
import { mealLine, planMeals, trainingLines } from "./day-plan";

const foods = DEFAULT_FOODS.map(({ favorite: _f, ...f }) => (void _f, f));

describe("plano de refeições até ao fim do dia", () => {
  it("às 18h com 900 kcal / 60 P / 100 H / 20 G / 15 F: jantar que fecha os alvos", () => {
    const { meals, after } = planMeals(18, { kcal: 900, protein_g: 60, carbs_g: 100, fat_g: 20, fiber_g: 15 }, foods);
    expect(meals).toHaveLength(1);
    expect(meals[0].label).toBe("Jantar");
    const line = mealLine(meals[0]);
    expect(line).toContain("de peito de frango grelhado");
    expect(line).toContain("de sopa de legumes");
    expect(line).toContain("de arroz branco cozido");
    expect(after.kcal).toBeGreaterThan(-100); // não ultrapassa o alvo em mais de ~10 %
    expect(after.protein_g).toBeLessThan(15);
  });
  it("às 12h: lanche + jantar", () => {
    const { meals } = planMeals(12, { kcal: 1400, protein_g: 90, carbs_g: 180, fat_g: 35, fiber_g: 20 }, foods);
    expect(meals.map((m) => m.label)).toEqual(["Lanche", "Jantar"]);
    expect(mealLine(meals[0])).toContain("Iogurte proteína");
  });
  it("às 22h só uma ceia leve de proteína", () => {
    const { meals } = planMeals(22, { kcal: 168, protein_g: 34.6, carbs_g: 40.9, fat_g: -1.5, fiber_g: 16 }, foods);
    expect(meals).toHaveLength(1);
    expect(mealLine(meals[0])).toMatch(/^Ceia leve: 1 × (Whey|Iogurte proteína Continente)/);
  });
  it("alvo já passado: nada, salvo fome com proteína em falta", () => {
    expect(planMeals(20, { kcal: -200, protein_g: 5, carbs_g: -30, fat_g: -10, fiber_g: 3 }, foods).meals).toEqual([]);
  });
});

describe("treino até ao fim do dia", () => {
  it("força por fazer e longo amanhã", () => {
    const l = trainingLines({ hour: 18, today: [{ type: "força", title: "Força — Estabilidade + Braços", status: "planeado", firstStep: "~25 min" }], doneTypes: [], tomorrow: { type: "fácil", title: "9km a fácil" } });
    expect(l[0]).toBe("Ainda tens: Força — Estabilidade + Braços (~25 min).");
    expect(l[1]).toBe("Amanhã: 9km a fácil.");
  });
  it("corrida feita", () => {
    expect(trainingLines({ hour: 10, today: [{ type: "fácil", title: "9km a fácil", status: "planeado" }], doneTypes: ["corrida"] })[0]).toBe("✓ 9km a fácil — feito.");
  });
});
