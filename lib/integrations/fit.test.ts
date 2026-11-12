import { describe, expect, it } from "vitest";
import { mapFit } from "./fit";

describe("FIT", () => {
  it("mapeia sessão, voltas e parciais por km com rumo", () => {
    const start = new Date("2026-11-12T07:01:00Z");
    const records = Array.from({ length: 401 }, (_, i) => ({
      timestamp: new Date(start.getTime() + i * 1500),
      distance: i * 5, // 2 km
      heart_rate: 140,
      altitude: 10,
      position_lat: 38.7,
      position_long: -9.2 + i * 1e-5, // para Este
    }));
    const r = mapFit(
      {
        sessions: [{ start_time: start, sport: "running", total_distance: 2000, total_elapsed_time: 600, total_timer_time: 600, avg_heart_rate: 140, max_heart_rate: 150, total_calories: 150, total_ascent: 3 }],
        laps: [{ start_time: start, total_distance: 2000, total_timer_time: 600, avg_heart_rate: 140 }],
        records,
      },
      "Europe/Lisbon",
    );
    expect(r.activity).toMatchObject({ type: "corrida", local_date: "2026-11-12", distance_m: 2000, kcal_raw: 150, external_id: `fit-${start.getTime()}` });
    expect(r.splits).toHaveLength(2);
    expect(r.splits[0]).toMatchObject({ idx: 1, distance_m: 1000, duration_s: 300, avg_hr: 140, bearing_deg: 90 });
    expect(r.laps[0].bearing_deg).toBe(90);
  });
});
