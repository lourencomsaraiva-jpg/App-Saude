import { describe, expect, it } from "vitest";
import { mapActivity, mapActivityType, mapWellness, streamsToPoints } from "./intervals";

describe("Intervals.icu → app", () => {
  it("mapeia uma corrida", () => {
    const a = mapActivity({
      id: "i123",
      type: "Run",
      name: "Fácil",
      start_date_local: "2026-11-12T07:01:00",
      start_date: "2026-11-12T07:01:00Z",
      distance: 9370,
      moving_time: 3152,
      elapsed_time: 3200,
      average_heartrate: 138.4,
      max_heartrate: 167,
      calories: 663,
      total_elevation_gain: 144,
    });
    expect(a).toMatchObject({ external_id: "i123", type: "corrida", local_date: "2026-11-12", distance_m: 9370, avg_hr: 138, kcal_raw: 663, ascent_m: 144 });
  });
  it("tipos", () => {
    expect(mapActivityType("VirtualRide")).toBe("bicicleta");
    expect(mapActivityType("WeightTraining")).toBe("força");
    expect(mapActivityType("TrailRun")).toBe("corrida");
  });
  it("wellness: sono da manhã de X fica no dia X−1; fases quando existirem", () => {
    const w = mapWellness({ id: "2026-11-12", weight: 78.04, restingHR: 48, hrv: 62, steps: 11000, sleepSecs: 27300, sleepScore: 81, sleepDeepSecs: 5820 });
    expect(w.day).toEqual({ date: "2026-11-12", weight_kg: 78, steps: 11000, resting_hr: 48, hrv: 62 });
    expect(w.sleep).toMatchObject({ day_date: "2026-11-11", total_min: 455, deep_min: 97, light_min: null, score: 81 });
  });
  it("wellness sem sono", () => {
    expect(mapWellness({ id: "2026-11-12" }).sleep).toBeNull();
  });
  it("streams → pontos", () => {
    const p = streamsToPoints([
      { type: "time", data: [0, 1] },
      { type: "distance", data: [0, 3] },
      { type: "latlng", data: [38.7, 38.70003], data2: [-9.1, -9.1] },
    ]);
    expect(p[1]).toEqual({ t: 1, dist: 3, hr: null, alt: null, lat: 38.70003, lon: -9.1 });
  });
});
