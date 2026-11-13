import { describe, expect, it } from "vitest";
import { DEFAULT_FOODS } from "../defaults";
import { cleanName, itemToFood } from "./learn";
import { matchLocal } from "./local-match";

describe("aprender alimentos", () => {
  it("nome limpo", () => {
    expect(cleanName("Bolachas de manteiga (4 un.)")).toBe("Bolachas de manteiga");
    expect(cleanName("Gomas 50 g")).toBe("Gomas");
    expect(cleanName("~180g bifes de peru grelhados")).toBe("Bifes de peru grelhados");
  });
  it("por unidade", () => {
    expect(itemToFood({ description: "Bolachas de manteiga", quantity: 4, unit: "un.", kcal: 240, protein_g: 2.9, carbs_g: 31.2, fat_g: 11.5, fiber_g: 0.8 })).toEqual({
      name: "Bolachas de manteiga", serving: "1 un.", serving_g: null, kcal: 60, protein_g: 0.7, carbs_g: 7.8, fat_g: 2.9, fiber_g: 0.2,
    });
  });
  it("por 100 g", () => {
    expect(itemToFood({ description: "Gomas", quantity: 50, unit: "g", kcal: 170, protein_g: 3, carbs_g: 39, fat_g: 0, fiber_g: 0 })).toMatchObject({ serving: "100 g", serving_g: 100, kcal: 340, carbs_g: 78 });
  });
  it("não aprende estimativas incoerentes", () => {
    expect(itemToFood({ description: "Coisa", quantity: 1, unit: "un.", kcal: 500, protein_g: 1, carbs_g: 1, fat_g: 1, fiber_g: 0 })).toBeNull();
  });
  it("depois de aprendido, é reconhecido sem IA", () => {
    const foods = [...DEFAULT_FOODS.map((f, i) => ({ id: String(i), ...f })), { id: "x", ...itemToFood({ description: "Gomas", quantity: 50, unit: "g", kcal: 170, protein_g: 3, carbs_g: 39, fat_g: 0, fiber_g: 0 })! }];
    const r = matchLocal("Dois mini kit kat e 50 gramas de gomas", foods);
    expect(r.unmatched).toEqual([]);
    expect(r.matched[1]).toMatchObject({ kcal: 170, quantity: 50 });
  });
});
