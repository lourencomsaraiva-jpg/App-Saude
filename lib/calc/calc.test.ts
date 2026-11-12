import { describe, expect, it } from "vitest";
import { DEFAULT_PHASES } from "../defaults";
import {
  DEFAULT_ENERGY_SETTINGS as S,
  addDays,
  adjustedExercise,
  basePhaseKcal,
  bearing,
  caloricBalance,
  cardiacCost,
  checkKcalConsistency,
  formatMinutes,
  formatPace,
  kcalTarget,
  kmSplits,
  macroTargets,
  parseMultiplier,
  parsePace,
  parseSleepText,
  recipeTotals,
  remaining,
  riegelProjection,
  round1,
  scaleNutrients,
  sleepDayForWakeDate,
  sum,
  sumNutrients,
  summarizeDay,
  validateSleep,
  weekStart,
  weeklyWeightAverages,
} from "./index";

describe("exercício ajustado", () => {
  it("10/11/2026: Garmin 934 → 887", () => {
    expect(adjustedExercise(934, "2026-11-10", S)).toBe(887);
  });
  it("12/11/2026: Garmin 663 → 630", () => {
    expect(adjustedExercise(663, "2026-11-12", S)).toBe(630);
  });
  it("aplica-se a partir de 12/10/2026 inclusive", () => {
    expect(adjustedExercise(500, "2026-10-12", S)).toBe(475);
  });
  it("antes de 12/10/2026 usa o valor bruto", () => {
    expect(adjustedExercise(934, "2026-10-11", S)).toBe(934);
  });
  it("sem exercício é 0", () => {
    expect(adjustedExercise(0, "2026-11-10", S)).toBe(0);
  });
});

describe("fases calóricas", () => {
  it("até 15/11 base 2050", () => {
    expect(basePhaseKcal("2026-11-10", DEFAULT_PHASES, S)).toBe(2050);
    expect(basePhaseKcal("2026-11-15", DEFAULT_PHASES, S)).toBe(2050);
    expect(basePhaseKcal("2026-08-01", DEFAULT_PHASES, S)).toBe(2050);
  });
  it("exceção de um dia 07/11 → 2250", () => {
    expect(basePhaseKcal("2026-11-07", DEFAULT_PHASES, S)).toBe(2250);
    expect(basePhaseKcal("2026-11-06", DEFAULT_PHASES, S)).toBe(2050);
    expect(basePhaseKcal("2026-11-08", DEFAULT_PHASES, S)).toBe(2050);
  });
  it("afinamento 16–24/11 → 2250", () => {
    expect(basePhaseKcal("2026-11-16", DEFAULT_PHASES, S)).toBe(2250);
    expect(basePhaseKcal("2026-11-24", DEFAULT_PHASES, S)).toBe(2250);
  });
  it("carga 25–28/11 → 2417", () => {
    expect(basePhaseKcal("2026-11-25", DEFAULT_PHASES, S)).toBe(2417);
    expect(basePhaseKcal("2026-11-28", DEFAULT_PHASES, S)).toBe(2417);
  });
  it("29/11 em diante → 2050", () => {
    expect(basePhaseKcal("2026-11-29", DEFAULT_PHASES, S)).toBe(2050);
    expect(basePhaseKcal("2027-01-15", DEFAULT_PHASES, S)).toBe(2050);
  });
});

describe("alvo, macros, falta e saldo", () => {
  it("10/11: alvo = 2050 + 887 = 2937", () => {
    expect(kcalTarget("2026-11-10", 887, DEFAULT_PHASES, S)).toBe(2937);
  });
  it("dia sem exercício com base 2050: H 250, G 48, P 155, F 30", () => {
    expect(macroTargets(2050, 0, 2050, S)).toEqual({ kcal: 2050, protein_g: 155, carbs_g: 250, fat_g: 48, fiber_g: 30 });
  });
  it("dia com exercício: H = alvo×385/2747, G = alvo×65/2747", () => {
    const t = macroTargets(2937, 887, 2050, S);
    expect(t.carbs_g).toBe(round1((2937 * 385) / 2747)); // 411.6
    expect(t.fat_g).toBe(round1((2937 * 65) / 2747)); // 69.5
    expect(t.carbs_g).toBe(411.6);
    expect(t.fat_g).toBe(69.5);
  });
  it("saldo = comido − gasto base − exercício ajustado", () => {
    expect(caloricBalance(1250, 2417, 630)).toBe(-1797);
  });
  it("falta pode ser negativa (excedido)", () => {
    expect(remaining(155, 170.5)).toBe(-15.5);
  });
  it("resumo do dia 12/11/2026 (caso real)", () => {
    const d = summarizeDay(
      {
        date: "2026-11-12",
        items: [
          { kcal: 520, protein_g: 46.6, carbs_g: 69.8, fat_g: 4.5, fiber_g: 2.5 },
          { kcal: 730, protein_g: 54, carbs_g: 75, fat_g: 23, fiber_g: 5 },
        ],
        activityKcalRaw: [663],
      },
      S,
      DEFAULT_PHASES,
    );
    expect(d.eaten.kcal).toBe(1250);
    expect(d.eaten.protein_g).toBe(100.6);
    expect(d.exercise_kcal_adj).toBe(630);
    expect(d.target.kcal).toBe(2680);
    expect(d.remaining.kcal).toBe(1430);
    expect(d.remaining.protein_g).toBe(54.4);
    expect(d.balance_kcal).toBe(1250 - 2417 - 630);
    expect(d.protein_on_target).toBe(false);
  });
  it("o valor manual de exercício prevalece sobre as atividades", () => {
    const d = summarizeDay({ date: "2026-11-10", items: [], activityKcalRaw: [500, 100], exerciseKcalRawOverride: 934 }, S, DEFAULT_PHASES);
    expect(d.exercise_kcal_raw).toBe(934);
    expect(d.exercise_kcal_adj).toBe(887);
  });
});

describe("somas e arredondamentos", () => {
  it("soma valores guardados sem ruído de vírgula flutuante", () => {
    expect(sum([0.1, 0.2])).toBe(0.3);
    expect(sum([264, 44, 212])).toBe(520);
    expect(sum([9, 7.6, 30])).toBe(46.6);
  });
  it("macros desconhecidas ficam null", () => {
    const t = sumNutrients([{ kcal: 1774, protein_g: 140, carbs_g: null, fat_g: null, fiber_g: null }]);
    expect(t).toEqual({ kcal: 1774, protein_g: 140, carbs_g: null, fat_g: null, fiber_g: null });
  });
  it("multiplicador 3/5", () => {
    expect(parseMultiplier("3/5")).toBe(0.6);
    expect(parseMultiplier("0,5")).toBe(0.5);
    expect(scaleNutrients({ kcal: 212, protein_g: 30, carbs_g: 18.8, fat_g: 2, fiber_g: 0 }, 0.6)).toEqual({ kcal: 127.2, protein_g: 18, carbs_g: 11.3, fat_g: 1.2, fiber_g: 0 });
  });
});

describe("validação de estimativas (kcal ≈ 4P + 4H + 9G, 10 %)", () => {
  it("frango 165 kcal / 31 P / 0 H / 3,6 G passa", () => {
    expect(checkKcalConsistency({ kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0 }).ok).toBe(true);
  });
  it("estimativa incoerente fica a rever", () => {
    const c = checkKcalConsistency({ kcal: 500, protein_g: 10, carbs_g: 20, fat_g: 5, fiber_g: 0 });
    expect(c.ok).toBe(false);
    expect(c.expectedKcal).toBe(165);
  });
});

describe("receitas", () => {
  it("total e por porção (trança 12 fatias)", () => {
    const { total, perPortion } = recipeTotals(
      [
        { kcal: 1820, protein_g: 50, carbs_g: 300, fat_g: 40, fiber_g: 12 },
        { kcal: 400, protein_g: 20, carbs_g: 30, fat_g: 22, fiber_g: 0 },
      ],
      12,
    );
    expect(total.kcal).toBe(2220);
    expect(perPortion.kcal).toBe(185);
    expect(perPortion.protein_g).toBe(5.8);
  });
});

describe("sono", () => {
  it("interpreta o texto do histórico", () => {
    expect(parseSleepText("7:35 (profundo 1:37, leve 4:49, REM 1:09, acordado 27min)")).toEqual({
      total_min: 455,
      deep_min: 97,
      light_min: 289,
      rem_min: 69,
      awake_min: 27,
    });
  });
  it("acordado em h:mm e com '?'", () => {
    expect(parseSleepText("7:50 (profundo 2:10, leve 4:32, REM 1:08, acordado 1:06?)")?.awake_min).toBe(66);
  });
  it("só total", () => {
    expect(parseSleepText("8:26")).toEqual({ total_min: 506, deep_min: null, light_min: null, rem_min: null, awake_min: null });
  });
  it("valida profundo + leve + REM = total", () => {
    expect(validateSleep(parseSleepText("7:53 (profundo 2:03, leve 4:00, REM 1:50)")!).ok).toBe(true);
    const bad = validateSleep({ total_min: 455, deep_min: 90, light_min: 289, rem_min: 69, awake_min: null });
    expect(bad.ok).toBe(false);
    expect(bad.diffMin).toBe(-7);
  });
  it("noite que acaba na manhã de X fica no dia X−1", () => {
    expect(sleepDayForWakeDate("2026-11-12")).toBe("2026-11-11");
    expect(sleepDayForWakeDate("2026-11-01")).toBe("2026-10-31");
  });
  it("formata minutos", () => {
    expect(formatMinutes(455)).toBe("7:35");
  });
});

describe("corrida", () => {
  it("ritmo e custo cardíaco", () => {
    const p = parsePace("5:36")!;
    expect(round1(p)).toBe(5.6);
    expect(cardiacCost(138, p)).toBe(77.3);
    expect(formatPace(5.65)).toBe("5:39");
    expect(formatPace(4.9999)).toBe("5:00");
  });
  it("parciais por km a partir de registos", () => {
    const pts = Array.from({ length: 2101 }, (_, i) => ({ t: i * 0.3, dist: i, hr: 140 + (i > 1000 ? 10 : 0), alt: 10 + (i < 1000 ? i / 100 : 10), lat: 38.7 + i * 1e-5, lon: -9.1 }));
    const s = kmSplits(pts);
    expect(s).toHaveLength(3);
    expect(s[0].distance_m).toBe(1000);
    expect(s[0].duration_s).toBe(300);
    expect(s[0].ascent_m).toBe(10);
    expect(s[0].bearing_deg).toBe(0);
    expect(s[2].distance_m).toBe(100);
  });
  it("rumo para Este = 90°", () => {
    expect(bearing(38.7, -9.2, 38.7, -9.1)).toBe(90);
  });
  it("projeção de Riegel devolve intervalo ordenado", () => {
    const r = riegelProjection(10000, 42 * 60, 21097);
    expect(r.optimistic_s).toBeLessThan(r.central_s);
    expect(r.central_s).toBeLessThan(r.conservative_s);
  });
});

describe("peso semanal (Seg–Dom)", () => {
  it("média e Δ face à semana anterior", () => {
    const w = weeklyWeightAverages([
      { date: "2026-11-02", weight_kg: 79 },
      { date: "2026-11-04", weight_kg: 78.6 },
      { date: "2026-11-08", weight_kg: null },
      { date: "2026-11-09", weight_kg: 78.4 },
      { date: "2026-11-11", weight_kg: 78 },
    ]);
    expect(w).toEqual([
      { week_start: "2026-11-02", avg_kg: 78.8, count: 2, delta_kg: null },
      { week_start: "2026-11-09", avg_kg: 78.2, count: 2, delta_kg: -0.6 },
    ]);
  });
  it("semana começa à segunda", () => {
    expect(weekStart("2026-11-15")).toBe("2026-11-09");
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });
});
