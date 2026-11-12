/**
 * Intervals.icu — fonte principal dos dados do Garmin.
 * API: https://intervals.icu/api/v1 · Basic Auth com utilizador "API_KEY" e password = chave pessoal.
 *
 * Os nomes dos campos foram confirmados pela documentação pública/comunidade; o mapeamento é defensivo
 * (campos em falta ficam null) e os registos completos ficam em activities.raw para auditoria.
 */
import { addDays, type ISODate } from "../calc/dates";
import { kmSplits, type TrackPoint } from "../calc/running";
import { round1 } from "../calc/numbers";
import { sleepDayForWakeDate } from "../calc/sleep";

const BASE = "https://intervals.icu/api/v1";

export interface IntervalsConfig {
  athleteId: string;
  apiKey: string;
}

export function intervalsConfigFromEnv(): IntervalsConfig | null {
  const athleteId = process.env.INTERVALS_ATHLETE_ID;
  const apiKey = process.env.INTERVALS_API_KEY;
  return athleteId && apiKey ? { athleteId, apiKey } : null;
}

async function get<T>(cfg: IntervalsConfig, path: string): Promise<T> {
  const auth = Buffer.from(`API_KEY:${cfg.apiKey}`).toString("base64");
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" }, signal: AbortSignal.timeout(25_000), cache: "no-store" });
  if (!res.ok) throw new Error(`Intervals.icu ${res.status} em ${path.split("?")[0]}`);
  return (await res.json()) as T;
}

// --------------------------------------------------------------------- tipos (parciais)
export type IcuActivity = Record<string, unknown> & {
  id: string | number;
  type?: string;
  name?: string;
  start_date_local?: string;
  start_date?: string;
  distance?: number | null;
  moving_time?: number | null;
  elapsed_time?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  calories?: number | null;
  total_elevation_gain?: number | null;
  total_elevation_loss?: number | null;
  icu_training_load?: number | null;
};

export type IcuWellness = Record<string, unknown> & {
  id: string; // data "YYYY-MM-DD"
  weight?: number | null;
  restingHR?: number | null;
  hrv?: number | null;
  steps?: number | null;
  sleepSecs?: number | null;
  sleepScore?: number | null;
  sleepQuality?: number | null;
};

export function mapActivityType(t: string | undefined): string {
  const x = (t ?? "").toLowerCase();
  if (/run/.test(x)) return "corrida";
  if (/ride|cycl|bike/.test(x)) return "bicicleta";
  if (/weight|strength|crossfit|workout|hiit/.test(x)) return "força";
  if (/walk|hike/.test(x)) return "caminhada";
  if (/swim/.test(x)) return "natação";
  return "outro";
}

const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const firstKey = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) {
    const v = numOrNull(o[k]);
    if (v !== null) return v;
  }
  return null;
};

export function mapActivity(a: IcuActivity) {
  const local = String(a.start_date_local ?? a.start_date ?? "");
  return {
    external_id: String(a.id),
    source: "intervals" as const,
    name: a.name ?? null,
    type: mapActivityType(a.type),
    start_time: a.start_date ?? (local ? local : null),
    local_date: local.slice(0, 10),
    distance_m: numOrNull(a.distance) !== null ? round1(Number(a.distance)) : null,
    duration_s: numOrNull(a.elapsed_time),
    moving_time_s: numOrNull(a.moving_time),
    avg_hr: numOrNull(a.average_heartrate) !== null ? Math.round(Number(a.average_heartrate)) : null,
    max_hr: numOrNull(a.max_heartrate) !== null ? Math.round(Number(a.max_heartrate)) : null,
    kcal_raw: numOrNull(a.calories),
    ascent_m: numOrNull(a.total_elevation_gain),
    descent_m: firstKey(a, ["total_elevation_loss", "total_descent"]),
    training_effect: firstKey(a, ["icu_aerobic_training_effect", "aerobic_training_effect", "training_effect"]),
    training_load: numOrNull(a.icu_training_load),
    raw: a,
  };
}

/** Campos de fases do sono, se existirem nesta versão da API (procura por nome). */
function stageMinutes(w: Record<string, unknown>, pattern: RegExp): number | null {
  for (const [k, v] of Object.entries(w)) {
    if (pattern.test(k) && numOrNull(v) !== null) {
      const n = Number(v);
      return /secs?$/i.test(k) ? Math.round(n / 60) : /min/i.test(k) ? Math.round(n) : Math.round(n / 60);
    }
  }
  return null;
}

export function mapWellness(w: IcuWellness) {
  const date = String(w.id).slice(0, 10) as ISODate;
  const sleepSecs = numOrNull(w.sleepSecs);
  return {
    day: {
      date,
      weight_kg: numOrNull(w.weight) !== null ? round1(Number(w.weight)) : null,
      steps: numOrNull(w.steps),
      resting_hr: numOrNull(w.restingHR),
      hrv: numOrNull(w.hrv) !== null ? round1(Number(w.hrv)) : null,
    },
    sleep:
      sleepSecs && sleepSecs > 0
        ? {
            day_date: sleepDayForWakeDate(date),
            total_min: Math.round(sleepSecs / 60),
            deep_min: stageMinutes(w, /^sleep.*deep/i),
            light_min: stageMinutes(w, /^sleep.*light/i),
            rem_min: stageMinutes(w, /^sleep.*rem/i),
            awake_min: stageMinutes(w, /^sleep.*awake/i),
            score: numOrNull(w.sleepScore),
          }
        : null,
  };
}

type IcuStream = { type: string; data: number[]; data2?: number[] };

export function streamsToPoints(streams: IcuStream[]): TrackPoint[] {
  const by = (t: string) => streams.find((s) => s.type === t);
  const time = by("time")?.data ?? [];
  const dist = by("distance")?.data ?? [];
  const hr = by("heartrate")?.data ?? [];
  const alt = by("altitude")?.data ?? by("fixed_altitude")?.data ?? [];
  const ll = by("latlng");
  return time.map((t, i) => ({ t, dist: dist[i], hr: hr[i] ?? null, alt: alt[i] ?? null, lat: ll?.data?.[i] ?? null, lon: ll?.data2?.[i] ?? null }));
}

type IcuInterval = Record<string, unknown> & { type?: string; label?: string; distance?: number; moving_time?: number; elapsed_time?: number; average_heartrate?: number; max_heartrate?: number; total_elevation_gain?: number };

export function mapIntervals(list: IcuInterval[]) {
  return list.map((iv, i) => ({
    kind: "lap" as const,
    idx: i + 1,
    label: [iv.type, iv.label].filter(Boolean).join(" · ") || null,
    distance_m: numOrNull(iv.distance),
    duration_s: numOrNull(iv.moving_time) ?? numOrNull(iv.elapsed_time),
    avg_hr: numOrNull(iv.average_heartrate) !== null ? Math.round(Number(iv.average_heartrate)) : null,
    max_hr: numOrNull(iv.max_heartrate) !== null ? Math.round(Number(iv.max_heartrate)) : null,
    ascent_m: numOrNull(iv.total_elevation_gain),
    descent_m: firstKey(iv, ["total_elevation_loss"]),
    bearing_deg: null,
  }));
}

// --------------------------------------------------------------------- chamadas
export const fetchActivities = (cfg: IntervalsConfig, oldest: ISODate, newest: ISODate) =>
  get<IcuActivity[]>(cfg, `/athlete/${cfg.athleteId}/activities?oldest=${oldest}&newest=${newest}`);

export const fetchWellness = (cfg: IntervalsConfig, oldest: ISODate, newest: ISODate) =>
  get<IcuWellness[]>(cfg, `/athlete/${cfg.athleteId}/wellness?oldest=${oldest}&newest=${newest}`);

export async function fetchActivityDetail(cfg: IntervalsConfig, id: string) {
  const [intervals, streams] = await Promise.allSettled([
    get<{ icu_intervals?: IcuInterval[] } | IcuInterval[]>(cfg, `/activity/${id}/intervals`),
    get<IcuStream[]>(cfg, `/activity/${id}/streams?types=time,distance,heartrate,altitude,latlng`),
  ]);
  const laps = intervals.status === "fulfilled" ? mapIntervals(Array.isArray(intervals.value) ? intervals.value : intervals.value.icu_intervals ?? []) : [];
  const points = streams.status === "fulfilled" && Array.isArray(streams.value) ? streamsToPoints(streams.value) : [];
  const splits = kmSplits(points).map((s) => ({ kind: "km_split" as const, label: null, ...s }));
  return { laps, splits, errors: [intervals, streams].filter((r) => r.status === "rejected").map((r) => String((r as PromiseRejectedResult).reason)) };
}

/** Lê um registo de wellness e devolve os nomes dos campos (para confirmar o que existe na tua conta). */
export async function probeWellnessFields(cfg: IntervalsConfig, date: ISODate) {
  const list = await fetchWellness(cfg, addDays(date, -3), date);
  const keys = new Set<string>();
  for (const w of list) for (const [k, v] of Object.entries(w)) if (v !== null && v !== undefined) keys.add(k);
  return [...keys].sort();
}
