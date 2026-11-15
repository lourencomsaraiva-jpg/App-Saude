/**
 * Qualidade de execução de um treino de corrida face ao plano (0–100).
 *
 *  Distância (30%)   100 entre 90% e 115% do planeado; 0 a 60% ou 150%
 *  Intensidade (40%) fácil/recuperação: % dos km abaixo do teto de FC e não mais rápidos do que a zona (−10 s)
 *                    séries/ritmo/longo com bloco rápido: km no ritmo-alvo (±5 s) / km de trabalho previstos;
 *                    km muito mais rápidos do que o alvo (>10 s) contam metade
 *  FC (30%)          FC média ≤ teto do plano = 100; −10 pontos por cada bpm acima
 * Componentes sem dados são ignorados. Força feita = 100; treino não feito = 0.
 */
export interface ExecPlanned {
  type: string;
  title: string;
  distance_km: number | null;
  target_pace_min_s: number | null; // mais rápido
  target_pace_max_s: number | null; // mais lento
  target_hr_max: number | null;
}
export interface ExecActivity {
  distance_m: number | null;
  avg_hr: number | null;
}
export interface ExecSplit {
  distance_m: number | null;
  duration_s: number | null;
  avg_hr: number | null;
}

const EASY = ["fácil", "recuperação"];
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function distanceScore(actualKm: number, plannedKm: number): number {
  const r = actualKm / plannedKm;
  if (r >= 0.9 && r <= 1.15) return 1;
  if (r < 0.9) return clamp01((r - 0.6) / 0.3);
  return clamp01((1.5 - r) / 0.35);
}

/** Km de trabalho previstos a partir do título: "4×2000m", "2×5km", "8 a ritmo de meia", "últimos 3". */
export function workKm(title: string, plannedKm: number | null): number | null {
  const t = title.toLowerCase();
  let total = 0;
  for (const m of t.matchAll(/(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*(km|m)\b/g)) total += Number(m[1]) * (m[3] === "km" ? Number(m[2].replace(",", ".")) : Number(m[2]) / 1000);
  if (total) return total;
  const fast = t.match(/(\d+(?:[.,]\d+)?)\s*(?:km\s*)?a\s*(?:ritmo|rhm|r10)/) ?? t.match(/[uú]ltimos\s*(\d+)/);
  if (fast) return Number(fast[1].replace(",", "."));
  return plannedKm ? plannedKm * 0.5 : null;
}

export function workoutExecution(p: ExecPlanned, a: ExecActivity | null, splits: ExecSplit[], easyHrMax = 150): number {
  if (p.type === "força") return a ? 100 : 0;
  if (!a) return 0;
  const parts: Array<[number, number]> = [];

  if (p.distance_km && a.distance_m) parts.push([distanceScore(a.distance_m / 1000, p.distance_km), 0.3]);

  const km = splits
    .filter((s) => s.distance_m && s.duration_s && s.distance_m >= 800)
    .map((s) => ({ pace: s.duration_s! / (s.distance_m! / 1000), hr: s.avg_hr }));
  const isEasy = EASY.includes(p.type) || (p.type === "longo" && (p.target_pace_min_s ?? 0) >= 320);
  const hrCap = p.target_hr_max ?? (isEasy ? easyHrMax : null);
  if (km.length) {
    if (isEasy) {
      const minPace = (p.target_pace_min_s ?? 330) - 10;
      const ok = km.filter((s) => (hrCap === null || s.hr === null || s.hr <= hrCap) && s.pace >= minPace).length;
      parts.push([ok / km.length, 0.4]);
    } else if (p.target_pace_min_s && p.target_pace_max_s) {
      const lo = p.target_pace_min_s - 5;
      const hi = p.target_pace_max_s + 5;
      const inZone = km.filter((s) => s.pace >= lo && s.pace <= hi).length;
      const tooFast = km.filter((s) => s.pace < p.target_pace_min_s! - 10).length;
      const expected = workKm(p.title, p.distance_km);
      if (expected) parts.push([clamp01((inZone + tooFast * 0.5) / Math.max(1, Math.floor(expected))), 0.4]);
    }
  }

  if (hrCap !== null && a.avg_hr !== null) parts.push([clamp01(1 - Math.max(0, a.avg_hr - hrCap) / 10), 0.3]);

  if (!parts.length) return 100; // feito, sem dados para avaliar
  const w = parts.reduce((s, [, x]) => s + x, 0);
  return Math.round((parts.reduce((s, [v, x]) => s + v * x, 0) / w) * 100);
}
