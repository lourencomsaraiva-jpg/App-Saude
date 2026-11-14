import { describe, expect, it } from "vitest";
import { buildUsage, rankFoods } from "./rank";

const foods = [
  { id: "pao", name: "Cacetinho branco", is_favorite: true },
  { id: "iog", name: "Iogurte proteína Auchan", is_favorite: true },
  { id: "fra", name: "Peito de frango grelhado", is_favorite: true },
  { id: "arr", name: "Arroz branco cozido", is_favorite: true },
  { id: "bac", name: "Bacalhau", is_favorite: false },
];

describe("favoritos por refeição", () => {
  it("conta usos por refeição, também pelo nome", () => {
    const u = buildUsage(
      [
        { food_id: "pao", description: "Cacetinho branco (100 g)", label: "pequeno-almoço" },
        { food_id: null, description: "Iogurte proteína Auchan (1 un.)", label: "pequeno-almoço" },
        { food_id: null, description: "Histórico importado", label: "histórico" },
      ],
      foods,
    );
    expect(u).toEqual({ "pequeno-almoço": { pao: 1, iog: 1 } });
  });
  it("mais usados nessa refeição primeiro; não favoritos usados também aparecem", () => {
    const u = { jantar: { bac: 3, arr: 1 }, almoço: { fra: 5 } };
    expect(rankFoods(foods, u, "jantar").map((f) => f.id)).toEqual(["bac", "arr", "fra", "pao", "iog"]);
  });
  it("sem histórico: típicos da refeição primeiro", () => {
    expect(rankFoods(foods, {}, "pequeno-almoço").map((f) => f.id).slice(0, 2)).toEqual(["pao", "iog"]);
    expect(rankFoods(foods, {}, "almoço").map((f) => f.id).slice(0, 2)).toEqual(["arr", "fra"]);
  });
});
