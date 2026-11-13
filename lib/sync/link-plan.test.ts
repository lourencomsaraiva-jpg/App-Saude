import { describe, expect, it } from "vitest";
import { computeLinks } from "./link-plan";

describe("planeado vs realizado automático", () => {
  const planned = [
    { id: "ter", date: "2026-11-03", type: "qualidade" },
    { id: "qua", date: "2026-11-04", type: "força" },
    { id: "qui", date: "2026-11-05", type: "fácil" },
    { id: "sex", date: "2026-11-06", type: "força" },
    { id: "sab", date: "2026-11-07", type: "fácil" },
    { id: "dom", date: "2026-11-08", type: "longo" },
    { id: "seg2", date: "2026-11-10", type: "qualidade" },
  ];
  it("mesmo dia primeiro; corrida de sexta conta para o fácil de sábado", () => {
    const acts = [
      { id: "a1", type: "corrida", local_date: "2026-11-03", planned_workout_id: null },
      { id: "a2", type: "força", local_date: "2026-11-04", planned_workout_id: null },
      { id: "a3", type: "corrida", local_date: "2026-11-05", planned_workout_id: null },
      { id: "a4", type: "corrida", local_date: "2026-11-06", planned_workout_id: null },
      { id: "a5", type: "corrida", local_date: "2026-11-08", planned_workout_id: null },
    ];
    expect(computeLinks(acts, planned)).toEqual([
      { activityId: "a1", plannedId: "ter" },
      { activityId: "a2", plannedId: "qua" },
      { activityId: "a3", plannedId: "qui" },
      { activityId: "a5", plannedId: "dom" },
      { activityId: "a4", plannedId: "sab" },
    ]);
  });
  it("não atravessa a semana", () => {
    expect(computeLinks([{ id: "x", type: "corrida", local_date: "2026-11-08", planned_workout_id: "dom" }, { id: "y", type: "corrida", local_date: "2026-11-09", planned_workout_id: null }], planned.filter((p) => p.id !== "seg2"))).toEqual([]);
  });
  it("força feita na quinta conta para a força de quarta ou sexta", () => {
    expect(computeLinks([{ id: "f", type: "força", local_date: "2026-11-05", planned_workout_id: null }], planned)).toEqual([{ activityId: "f", plannedId: "qua" }]);
  });
});
