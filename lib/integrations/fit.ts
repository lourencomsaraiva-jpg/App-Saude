/**
 * Upload manual de ficheiros .FIT (fallback). Sessão, voltas, parciais de 1 km calculados
 * a partir dos registos e rumo por km a partir do GPS.
 */
import FitParser from "fit-file-parser";
import { localDateInTz } from "../calc/dates";
import { round1 } from "../calc/numbers";
import { bearing, kmSplits, type TrackPoint } from "../calc/running";
import { mapActivityType } from "./intervals";

type Rec = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const time = (v: unknown) => (v instanceof Date ? v.getTime() : typeof v === "string" || typeof v === "number" ? new Date(v).getTime() : NaN);

export interface ParsedFitLike {
  sessions?: Rec[];
  laps?: Rec[];
  records?: Rec[];
}

export function mapFit(data: ParsedFitLike, tz = process.env.APP_TIMEZONE || "Europe/Lisbon") {
  const s = data.sessions?.[0] ?? {};
  const records = data.records ?? [];
  const startMs = time(s.start_time ?? records[0]?.timestamp);
  if (!Number.isFinite(startMs)) throw new Error("Ficheiro FIT sem hora de início.");
  const start = new Date(startMs);

  const points: TrackPoint[] = records
    .map((r) => ({
      t: (time(r.timestamp) - startMs) / 1000,
      dist: num(r.distance) ?? NaN,
      hr: num(r.heart_rate),
      alt: num(r.enhanced_altitude) ?? num(r.altitude),
      lat: num(r.position_lat),
      lon: num(r.position_long),
    }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.dist));

  const sport = String(s.sport ?? "");
  const activity = {
    external_id: `fit-${startMs}`,
    source: "fit" as const,
    name: `FIT ${sport || "atividade"}`,
    type: mapActivityType(sport === "running" ? "run" : sport === "cycling" ? "ride" : sport === "training" ? "strength" : sport),
    start_time: start.toISOString(),
    local_date: localDateInTz(start, tz),
    distance_m: num(s.total_distance) !== null ? round1(Number(s.total_distance)) : null,
    duration_s: num(s.total_elapsed_time),
    moving_time_s: num(s.total_timer_time),
    avg_hr: num(s.avg_heart_rate),
    max_hr: num(s.max_heart_rate),
    kcal_raw: num(s.total_calories),
    ascent_m: num(s.total_ascent),
    descent_m: num(s.total_descent),
    training_effect: num(s.total_training_effect),
  };

  const laps = (data.laps ?? []).map((l, i) => {
    const lapStart = time(l.start_time);
    const lapEnd = lapStart + (num(l.total_elapsed_time) ?? num(l.total_timer_time) ?? Infinity) * 1000;
    const geo = points.filter((p) => p.lat !== null && startMs + p.t * 1000 >= lapStart && startMs + p.t * 1000 <= lapEnd);
    return {
      kind: "lap" as const,
      idx: i + 1,
      label: null,
      distance_m: num(l.total_distance),
      duration_s: num(l.total_timer_time) ?? num(l.total_elapsed_time),
      avg_hr: num(l.avg_heart_rate),
      max_hr: num(l.max_heart_rate),
      ascent_m: num(l.total_ascent),
      descent_m: num(l.total_descent),
      bearing_deg: geo.length >= 2 ? bearing(geo[0].lat!, geo[0].lon!, geo[geo.length - 1].lat!, geo[geo.length - 1].lon!) : null,
    };
  });
  const splits = kmSplits(points).map((sp) => ({ kind: "km_split" as const, label: null, ...sp }));
  return { activity, laps, splits };
}

export async function parseFit(buffer: ArrayBuffer) {
  const parser = new FitParser({ force: true, mode: "list", lengthUnit: "m", speedUnit: "m/s" });
  const data = (await parser.parseAsync(buffer)) as unknown as ParsedFitLike;
  return mapFit(data);
}
