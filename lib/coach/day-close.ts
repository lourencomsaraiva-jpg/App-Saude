/**
 * Comentário de fecho do dia (treinador + nutricionista), gerado por regras a partir dos números da app.
 * Sem IA: nunca inventa valores. Português europeu, curto e direto.
 */
import { fmt } from "../calc/numbers";
import { formatPace } from "../calc/running";
import { formatMinutes } from "../calc/sleep";

export interface DayCloseInput {
  has_food: boolean;
  kcal: number;
  kcal_target: number;
  protein_g: number | null;
  protein_target: number;
  fiber_g: number | null;
  fiber_target: number;
  sleep_min: number | null;
  weight_kg: number | null;
  runs: Array<{ km: number; pace: number | null; avg_hr: number | null }>;
  strength_done: boolean;
  planned: Array<{ type: string; title: string; status: string; score: number | null }>;
}

const clean = (t: string) => t.replace(/^🏁\s*|^🎯\s*/u, "");

export function dayCloseComment(d: DayCloseInput): string {
  const good: string[] = [];
  const fix: string[] = [];
  const facts: string[] = [];

  // --- treino
  const plannedRun = d.planned.find((p) => !["força", "descanso"].includes(p.type));
  const plannedStrength = d.planned.find((p) => p.type === "força");
  const restDay = d.planned.length > 0 && d.planned.every((p) => p.type === "descanso");
  const run = [...d.runs].sort((a, b) => b.km - a.km)[0];
  if (run) facts.push(`Corrida: ${fmt(run.km, 1)} km${run.pace ? ` a ${formatPace(run.pace)}/km` : ""}${run.avg_hr ? `, FC ${run.avg_hr}` : ""}.`);
  if (plannedRun) {
    if (plannedRun.status !== "feito") fix.push(`ficou por fazer: ${clean(plannedRun.title)}`);
    else if (plannedRun.score !== null) {
      if (plannedRun.score >= 85) good.push(`treino bem executado (${plannedRun.score}/100)`);
      else if (plannedRun.score >= 65) facts.push(`Execução do treino ${plannedRun.score}/100: perto do plano, com desvios.`);
      else fix.push(`execução do treino ${plannedRun.score}/100 — longe do que o plano pedia (distância, ritmo ou FC)`);
    }
  }
  if (plannedStrength) {
    if (plannedStrength.status === "feito" || d.strength_done) good.push("força feita");
    else fix.push("força por fazer");
  }
  if (restDay && !run) good.push("descanso respeitado");
  if (restDay && run) fix.push("correste num dia de descanso");

  // --- alimentação
  if (!d.has_food) fix.push("sem registo de comida");
  else {
    const diff = d.kcal - d.kcal_target;
    const rel = d.kcal_target ? diff / d.kcal_target : 0;
    facts.push(`Comeste ${fmt(d.kcal)} kcal (alvo ${fmt(d.kcal_target)}, ${diff > 0 ? "+" : ""}${fmt(diff)}).`);
    if (Math.abs(rel) <= 0.1) good.push("calorias no alvo");
    else if (rel > 0.1) fix.push(`${fmt(diff)} kcal acima do alvo`);
    else if (rel < -0.2) fix.push(`${fmt(-diff)} kcal abaixo do alvo — défice grande demais para recuperar bem`);
    if (d.protein_g !== null) {
      if (d.protein_g >= d.protein_target) good.push(`proteína cumprida (${fmt(d.protein_g)} g)`);
      else if (d.protein_g < d.protein_target * 0.85) fix.push(`proteína curta (${fmt(d.protein_g)} de ${fmt(d.protein_target)} g)`);
    }
    if (d.fiber_g !== null && d.fiber_g > 0 && d.fiber_g < d.fiber_target * 0.7) fix.push(`fibra baixa (${fmt(d.fiber_g)} de ${fmt(d.fiber_target)} g)`);
  }

  // --- sono e peso
  if (d.sleep_min !== null) {
    if (d.sleep_min < 390) fix.push(`sono curto (${formatMinutes(d.sleep_min)})`);
    else if (d.sleep_min >= 450) good.push(`bom sono (${formatMinutes(d.sleep_min)})`);
  }
  if (d.weight_kg !== null) facts.push(`Peso ${fmt(d.weight_kg, 1)} kg.`);

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const verdict = !fix.length ? "Dia sólido." : fix.length >= 3 ? "Dia a corrigir." : good.length > fix.length ? "Bom dia, com um ponto a afinar." : "Dia razoável.";
  const parts = [verdict, ...facts];
  if (good.length) parts.push(`${cap(good.join(", "))}.`);
  if (fix.length) parts.push(`A corrigir: ${fix.join("; ")}.`);
  return parts.join(" ");
}
