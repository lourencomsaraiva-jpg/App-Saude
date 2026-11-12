import { describe, expect, it } from "vitest";
import { groupByKeys } from "./db-utils";

describe("upsert agrupado", () => {
  it("separa linhas com colunas diferentes (não apaga peso manual)", () => {
    const g = groupByKeys([
      { user_id: "u", date: "2026-11-10", steps: 1 },
      { user_id: "u", date: "2026-11-11", steps: 2, weight_kg: 78 },
      { date: "2026-11-12", user_id: "u", steps: 3 },
    ]);
    expect(g).toHaveLength(2);
    expect(g[0]).toHaveLength(2);
  });
});
