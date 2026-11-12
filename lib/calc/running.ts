/**
 * Ritmos, custo cardíaco, parciais por km, rumo e projeção de prova.
 */
import { round1 } from "./numbers";

/** "5:39" → 5.65 (min/km decimal). Aceita texto com mais coisas, ex.: "5:29 (blocos ~4:45-5:00)". */
export function parsePace(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) + Number(m[2]) / 60;
}

/** Ritmo decimal (min/km) a partir de distância (m) e duração (s). */
export function paceFromDistance(distanceM: number | null | undefined, durationS: number | null | undefined): number | null {
  if (!distanceM || !durationS || distanceM <= 0) return null;
  return durationS / 60 / (distanceM / 1000);
}

/** 5.65 → "5:39". */
export function formatPace(pace: number | null | undefined): string {
  if (pace === null || pace === undefined || !Number.isFinite(pace) || pace <= 0) return "—";
  let min = Math.floor(pace);
  let sec = Math.round((pace - min) * 60);
  if (sec === 60) {
    min += 1;
    sec = 0;
  }
  return `${min}:${String(sec).padStart(2, "0")}`;
}

/** Segundos → "52:32" ou "1:36:24". */
export function formatDuration(totalS: number | null | undefined): string {
  if (totalS === null || totalS === undefined || !Number.isFinite(totalS)) return "—";
  const s = Math.round(totalS);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

/** "1:36:24" / "44:10" → segundos. */
export function parseDurationHms(text: string | null | undefined): number | null {
  if (!text) return null;
  const parts = text.trim().split(":").map(Number);
  if (parts.some((p) => !Number.isFinite(p))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

/** Custo cardíaco = FC média × ritmo (min/km decimal) ÷ 10. */
export function cardiacCost(avgHr: number | null | undefined, pace: number | null | undefined): number | null {
  if (!avgHr || !pace) return null;
  return round1((avgHr * pace) / 10);
}

/** Primeiro número de um texto de FC, ex.: "150 (máx 178)" → {avg:150, max:178}. */
export function parseHrText(text: string | null | undefined): { avg: number | null; max: number | null } {
  if (!text) return { avg: null, max: null };
  const avg = text.match(/\d{2,3}/);
  const max = text.match(/m[áa]x\.?\s*(\d{2,3})/i);
  return { avg: avg ? Number(avg[0]) : null, max: max ? Number(max[1]) : null };
}

/** Rumo inicial (graus, 0 = Norte) entre dois pontos. */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

export function compassPt(deg: number | null | undefined): string {
  if (deg === null || deg === undefined) return "—";
  const dirs = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return dirs[Math.round(deg / 45) % 8];
}

export interface TrackPoint {
  t: number; // segundos desde o início
  dist: number; // metros acumulados
  hr?: number | null;
  alt?: number | null;
  lat?: number | null;
  lon?: number | null;
}

export interface Split {
  idx: number;
  distance_m: number;
  duration_s: number;
  avg_hr: number | null;
  max_hr: number | null;
  ascent_m: number;
  descent_m: number;
  bearing_deg: number | null;
}

/** Parciais de 1 km (o último pode ser parcial) a partir dos registos. */
export function kmSplits(points: TrackPoint[], splitM = 1000): Split[] {
  const pts = points.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.dist)).sort((a, b) => a.t - b.t);
  if (pts.length < 2) return [];
  const splits: Split[] = [];
  let startIdx = 0;
  let nextMark = splitM;
  const close = (endIdx: number, isFinal: boolean) => {
    const seg = pts.slice(startIdx, endIdx + 1);
    if (seg.length < 2) return;
    const first = seg[0];
    const last = seg[seg.length - 1];
    const hrs = seg.map((p) => p.hr).filter((h): h is number => typeof h === "number" && h > 0);
    let asc = 0;
    let desc = 0;
    for (let i = 1; i < seg.length; i++) {
      const a = seg[i - 1].alt;
      const b = seg[i].alt;
      if (typeof a === "number" && typeof b === "number") {
        if (b > a) asc += b - a;
        else desc += a - b;
      }
    }
    const geo = seg.filter((p) => typeof p.lat === "number" && typeof p.lon === "number");
    const brg = geo.length >= 2 ? bearing(geo[0].lat!, geo[0].lon!, geo[geo.length - 1].lat!, geo[geo.length - 1].lon!) : null;
    const distance = last.dist - first.dist;
    if (isFinal && distance < 50) return;
    splits.push({
      idx: splits.length + 1,
      distance_m: round1(distance),
      duration_s: round1(last.t - first.t),
      avg_hr: hrs.length ? Math.round(hrs.reduce((x, y) => x + y, 0) / hrs.length) : null,
      max_hr: hrs.length ? Math.max(...hrs) : null,
      ascent_m: round1(asc),
      descent_m: round1(desc),
      bearing_deg: brg,
    });
    startIdx = endIdx;
  };
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].dist >= nextMark) {
      close(i, false);
      nextMark += splitM;
    }
  }
  if (startIdx < pts.length - 1) close(pts.length - 1, true);
  return splits;
}

/**
 * Projeção de prova pela fórmula de Riegel: t2 = t1 × (d2/d1)^k.
 * Devolve um intervalo usando k entre 1,04 (otimista) e 1,08 (conservador), centro 1,06.
 */
export function riegelProjection(knownDistanceM: number, knownTimeS: number, targetDistanceM: number) {
  const r = targetDistanceM / knownDistanceM;
  const at = (k: number) => Math.round(knownTimeS * Math.pow(r, k));
  return { optimistic_s: at(1.04), central_s: at(1.06), conservative_s: at(1.08) };
}

/**
 * Eficiência aeróbica: FC média em corridas cujo ritmo médio está perto de um ritmo de referência
 * (por omissão 5:30/km ± 15 s).
 */
export function hrAtReferencePace<T extends { pace: number | null; avg_hr: number | null }>(runs: T[], refPace = 5.5, tolMin = 0.25): T[] {
  return runs.filter((r) => r.pace !== null && r.avg_hr !== null && Math.abs(r.pace - refPace) <= tolMin);
}
