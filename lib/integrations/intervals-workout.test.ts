import { describe, expect, it } from "vitest";
import { buildAthletePlan } from "../plan/athlete-plan";
import { bodyLines, paceFromText, toIntervalsWorkout } from "./intervals-workout";

const plan = buildAthletePlan();
const w = (d: string) => {
  const x = plan.find((p) => p.date === d)!;
  return toIntervalsWorkout(x.title, x.structure).description;
};

describe("treino → formato Intervals.icu", () => {
  it("ritmos", () => {
    expect(paceFromText("8km a fácil (5:30-5:55/km)")).toBe("5:55-5:30/km Pace");
    expect(paceFromText("RHM 4:20/km")).toBe("4:20/km Pace");
    expect(paceFromText("a RHM ajustado")).toBe("4:25-4:10/km Pace");
  });
  it("sábado 14/11: 9km fácil", () => {
    expect(w("2026-11-14")).toBe(
      ["Aquecimento", "- 10m 6:15-5:55/km Pace", "", "Corpo", "- 9km 5:55-5:30/km Pace", "", "Desaquecimento", "- 5m 6:15-5:55/km Pace", "", "Distância total estimada ≈ 11,5 km (com aquecimento e desaquecimento)."].join("\n"),
    );
  });
  it("séries com recuperação", () => {
    expect(bodyLines("4×2000m a RHM ajustado −5s/km c/2min trote.")).toEqual(["4x", "- 2km 4:25-4:10/km Pace", "- 2m 6:15-5:55/km Pace"]);
    expect(bodyLines("6×400m (I: 3:40-3:55/km) c/200m trote + 4×1000m (R10: 3:55-4:10/km) c/90s trote.")).toEqual([
      "6x", "- 0.4km 3:55-3:40/km Pace", "- 0.2km 6:15-5:55/km Pace", "", "4x", "- 1km 4:10-3:55/km Pace", "- 90s 6:15-5:55/km Pace",
    ]);
  });
  it("longo composto 22 km", () => {
    expect(bodyLines("22km: 12km a fácil + 10km a RHM ajustado — LONGO MÁXIMO do ciclo")).toEqual(["- 12km 5:55-5:30/km Pace", "- 10km 4:25-4:10/km Pace"]);
  });
  it("últimos 3 km a ritmo de 10 km", () => {
    expect(bodyLines("10km: últimos 3km a Ritmo 10km (4:00-4:15/km)")).toEqual(["- 7km 5:55-5:30/km Pace", "- 3km 4:15-4:00/km Pace"]);
  });
  it("strides", () => {
    expect(bodyLines("4-6 strides ~20s progressivos (controlado)")).toEqual(["6x", "- 20s 4:10-3:55/km Pace", "- 60s 6:15-5:55/km Pace"]);
  });
  it("todos os treinos de corrida do plano geram texto", () => {
    for (const p of plan.filter((x) => ["fácil", "qualidade", "longo"].includes(x.type))) {
      const d = toIntervalsWorkout(p.title, p.structure).description;
      expect(d, p.date).toMatch(/Corpo\n(\d+x\n)?- /);
      expect(d, p.date).not.toMatch(/NaN|undefined/);
    }
  });
});
