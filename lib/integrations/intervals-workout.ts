/**
 * Converte um treino planeado no formato de treino do Intervals.icu (workout builder), para ser
 * enviado ao calendário do Intervals e daí ao Garmin Connect / relógio.
 *
 * Formato: secções com linhas "- <duração|distância> <ritmo> Pace", blocos "Nx" para séries.
 * Ritmo absoluto: "5:55-5:30/km Pace" (do mais lento para o mais rápido).
 * Atenção: no Intervals "m" = minutos; distâncias em km (0.4km em vez de 400m).
 */
import type { WorkoutStep } from "../types";

const ZONE_PACE: Record<string, [string, string]> = {
  facil: ["5:30", "5:55"],
  lento: ["5:55", "6:15"],
  moderado: ["4:50", "5:10"],
  t: ["4:20", "4:40"],
  rhm: ["4:10", "4:25"],
  r10: ["3:55", "4:10"],
  i: ["3:40", "3:55"],
};

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** "5:30-5:55/km" → "5:55-5:30/km Pace" (Intervals: lento-rápido). */
function paceTarget(fast: string, slow: string) {
  return fast === slow ? `${fast}/km Pace` : `${slow}-${fast}/km Pace`;
}

/** Ritmo explícito no texto (m:ss-m:ss ou m:ss), senão pela zona mencionada. */
export function paceFromText(text: string, fallback: keyof typeof ZONE_PACE = "facil"): string {
  const t = norm(text);
  const range = t.match(/(\d:\d{2})\s*-\s*(\d:\d{2})\s*\/?\s*km/);
  if (range) {
    const [a, b] = [range[1], range[2]].sort(); // "4:10" < "4:25" em ordem alfabética para m:ss com 1 dígito
    return paceTarget(a, b);
  }
  const single = t.match(/(\d:\d{2})\s*\/\s*km/);
  if (single) return paceTarget(single[1], single[1]);
  if (/\brhm\b/.test(t)) return paceTarget(...ZONE_PACE.rhm);
  if (/\br10\b|ritmo 10 ?km/.test(t)) return paceTarget(...ZONE_PACE.r10);
  if (/\(i:|\bvo2/.test(t)) return paceTarget(...ZONE_PACE.i);
  if (/\(t:|\ba t\b|limiar|tempo continuo/.test(t)) return paceTarget(...ZONE_PACE.t);
  if (/moderado/.test(t)) return paceTarget(...ZONE_PACE.moderado);
  return paceTarget(...ZONE_PACE[fallback]);
}

/** "10min", "10-15min" → "10m" (usa o primeiro valor). */
function minutes(text: string): string | null {
  const m = norm(text).match(/(\d+)(?:\s*-\s*\d+)?\s*min/);
  return m ? `${m[1]}m` : null;
}

function distance(n: string, unit: string): string {
  const v = Number(n.replace(",", "."));
  if (unit === "km") return `${v}km`;
  return `${Math.round((v / 1000) * 100) / 100}km`; // metros → km
}

function recovery(text: string): string | null {
  const t = norm(text);
  const m = t.match(/c\/\s*(\d+)\s*(s|min|m)\b(?!\w)/);
  if (!m) return null;
  if (m[2] === "s") return `${m[1]}s`;
  if (m[2] === "min") return `${m[1]}m`;
  return distance(m[1], "m");
}

/** Linhas do corpo do treino. */
export function bodyLines(corpo: string): string[] {
  const t = norm(corpo);
  const lines: string[] = [];
  // séries: "6×400m (I: ...) c/200m trote + 4×1000m (R10: ...) c/90s trote"
  const parts = corpo.split(/\s\+\s(?=\d+\s*[×x])/);
  const reps = parts.map((p) => ({ p, m: norm(p).match(/(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*(km|m|min)\b/) }));
  if (reps.some((r) => r.m)) {
    for (const { p, m } of reps) {
      if (!m) continue;
      const work = m[3] === "min" ? `${m[2]}m` : distance(m[2], m[3]);
      const rec = recovery(p);
      lines.push("", `${m[1]}x`, `- ${work} ${paceFromText(p, "t")}`);
      if (rec) lines.push(`- ${rec} ${paceTarget(...ZONE_PACE.lento)}`);
    }
    return lines.slice(1);
  }
  // composto: "22km: 12km a fácil + 10km a RHM" / "16km: 10km a fácil (...) + 6km finais a RHM 4:20/km"
  const comp = [...corpo.matchAll(/(\d+(?:[.,]\d+)?)\s*km\s+(?:finais\s+)?a\s+([^+]+)/gi)];
  if (comp.length >= 2) {
    return comp.map((c) => `- ${distance(c[1], "km")} ${paceFromText(c[2], /fácil|facil/i.test(c[2]) ? "facil" : "rhm")}`);
  }
  // "10km: últimos 3km a Ritmo 10km (4:00-4:15/km)"
  const last = t.match(/(\d+)\s*km:\s*ultimos\s*(\d+)\s*km/);
  if (last) {
    const total = Number(last[1]);
    const fast = Number(last[2]);
    return [`- ${total - fast}km ${paceTarget(...ZONE_PACE.facil)}`, `- ${fast}km ${paceFromText(corpo.split(/ultimos|últimos/i)[1] ?? corpo, "r10")}`];
  }
  // tempo contínuo "20min (T: ...)" / "20min a fácil"
  const mins = t.match(/(\d+)(?:\s*-\s*\d+)?\s*min/);
  const km = t.match(/(\d+(?:[.,]\d+)?)(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*km/);
  if (km && (!mins || t.indexOf(km[0]) < t.indexOf(mins[0]))) lines.push(`- ${distance(km[1], "km")} ${paceFromText(corpo)}`);
  else if (mins) lines.push(`- ${mins[1]}m ${paceFromText(corpo, /\(t:|tempo/.test(t) ? "t" : "facil")}`);
  // strides
  const strides = t.match(/(\d+)(?:\s*-\s*(\d+))?\s*strides/);
  if (strides) lines.push(...(lines.length ? [""] : []), `${strides[2] ?? strides[1]}x`, `- 20s ${paceTarget(...ZONE_PACE.r10)}`, `- 60s ${paceTarget(...ZONE_PACE.lento)}`);
  return lines.length ? lines : [`- 20m ${paceTarget(...ZONE_PACE.facil)}`];
}

export interface IntervalsWorkout {
  name: string;
  description: string;
}

/** Texto do treino para o Intervals.icu a partir da estrutura do plano ("Aq:", "Corpo:", "Desaq:"). */
export function toIntervalsWorkout(title: string, structure: WorkoutStep[]): IntervalsWorkout {
  const find = (prefix: RegExp) => structure.map((s) => s.description).find((d) => prefix.test(d));
  const aq = find(/^aq:|^aquecimento/i) ?? structure.find((s) => s.kind === "aquecimento")?.description;
  const corpo = find(/^corpo:/i) ?? structure.find((s) => s.kind === "série" || s.kind === "contínuo")?.description ?? title;
  const desaq = find(/^desaq:|^retorno/i) ?? structure.find((s) => s.kind === "retorno à calma")?.description;
  const out: string[] = [];
  if (aq) out.push("Aquecimento", `- ${minutes(aq) ?? "10m"} ${paceFromText(aq, "lento")}`, "");
  out.push("Corpo", ...bodyLines(corpo.replace(/^corpo:\s*/i, "")), "");
  if (desaq) out.push("Desaquecimento", `- ${minutes(desaq) ?? "5m"} ${paceFromText(desaq, "lento")}`);
  const used = new Set([aq, corpo, desaq].filter(Boolean));
  const notes = structure.map((s) => s.description).filter((d) => !used.has(d) && !/^aq:|^corpo:|^desaq:/i.test(d));
  return { name: title, description: [out.join("\n").trim(), notes.length ? `\n${notes.join("\n")}` : ""].join("\n").trim() };
}
