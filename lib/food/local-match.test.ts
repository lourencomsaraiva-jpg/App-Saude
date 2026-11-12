import { describe, expect, it } from "vitest";
import { DEFAULT_FOODS } from "../defaults";
import { matchLocal, parseQuantity, splitSegments } from "./local-match";

const foods = DEFAULT_FOODS.map((f, i) => ({ id: String(i), ...f }));

describe("reconhecimento local de comida", () => {
  it("divide segmentos", () => {
    expect(splitSegments("Dois mini kit kat e 50 gramas de gomas")).toEqual(["dois mini kit kat", "50 gramas de gomas"]);
  });
  it("quantidades", () => {
    expect(parseQuantity("50 gramas de gomas")).toEqual({ grams: 50, count: null });
    expect(parseQuantity("dois mini kit kat")).toEqual({ grams: null, count: 2 });
    expect(parseQuantity("arroz 200 g")).toEqual({ grams: 200, count: null });
  });
  it("Dois mini kit kat e 50 g de gomas", () => {
    const r = matchLocal("Dois mini kit kat e 50 gramas de gomas", foods);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0]).toMatchObject({ kcal: 120, protein_g: 1.6, carbs_g: 14.6, fat_g: 6, quantity: 2, unit: "un.", weight_confirmed: true });
    expect(r.unmatched).toEqual(["50 gramas de gomas"]);
  });
  it("arroz 200 g, frango 150 g, sopa", () => {
    const r = matchLocal("arroz 200 g, frango 150 g, sopa", foods);
    expect(r.unmatched).toEqual([]);
    expect(r.matched.map((m) => [m.kcal, m.quantity])).toEqual([[260, 200], [247.5, 150], [110, 300]]);
    expect(r.matched[2].weight_confirmed).toBe(false);
  });
  it("não confunde bolachas de manteiga com manteiga de amendoim", () => {
    expect(matchLocal("3 bolachas de manteiga", foods).matched).toHaveLength(0);
  });
  it("iogurte proteína auchan", () => {
    expect(matchLocal("iogurte auchan", foods).matched[0].kcal).toBe(212);
  });
});
