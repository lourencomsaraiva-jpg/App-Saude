/**
 * Comentários automáticos de treinador/nutricionista, gerados por regras a partir dos números da app
 * (sem IA: instantâneos, sem enviar dados, nunca inventam valores). Português europeu, tom direto.
 */
import { fmt, round1 } from "../calc/numbers";
import { formatPace } from "../calc/running";

type N = number | null | undefined;
const v = (x: N) => (typeof x === "number" && Number.isFinite(x) ? x : 0);

export interface FoodCommentInput {
  hour: number; // hora local da última entrada
  entry: { kcal: number; protein_g: N; carbs_g: N; fat_g: N; fiber_g: N }; // soma das entradas recentes
  remaining: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };
  target: { kcal: number; protein_g: number };
  todayWorkout?: { type: string; title: string; done: boolean } | null;
  tomorrowWorkout?: { type: string; title: string } | null;
  phaseNote?: string | null;
  /** Só a avaliação do que foi comido (o plano do resto do dia aparece à parte). */
  assessOnly?: boolean;
}

/** Sugestões de proteína magra (valores da tabela pessoal). */
const PROTEIN_OPTIONS = [
  { name: "150 g de peito de frango", kcal: 248, p: 46.5 },
  { name: "1 iogurte de proteína Continente", kcal: 138.5, p: 20 },
  { name: "1 scoop de whey", kcal: 118, p: 24.5 },
  { name: "1 gelatina de proteína Lidl", kcal: 40, p: 10 },
];

function proteinSuggestion(kcalLeft: number, pLeft: number): string | null {
  if (pLeft < 10) return null;
  const fits = PROTEIN_OPTIONS.filter((o) => o.kcal <= Math.max(kcalLeft, 60));
  const best = fits.sort((a, b) => b.p - a.p)[0] ?? PROTEIN_OPTIONS[PROTEIN_OPTIONS.length - 1];
  return `${best.name} (≈${fmt(best.kcal)} kcal, ${fmt(best.p, 1)} g P)`;
}

export function foodComment(i: FoodCommentInput): string[] {
  const out: string[] = [];
  const kcal = v(i.entry.kcal);
  const p = v(i.entry.protein_g);
  const c = v(i.entry.carbs_g);
  const f = v(i.entry.fat_g);
  const fib = v(i.entry.fiber_g);
  const r = i.remaining;

  // 1) avaliação do que acabou de comer
  if (kcal >= 150) {
    const protPct = kcal > 0 ? (p * 4) / kcal : 0;
    if (p >= 30) out.push(`Boa dose de proteína nesta refeição (${fmt(p, 1)} g).`);
    else if (protPct < 0.08 && c + f > 0 && kcal >= 200) out.push(`Isto foi sobretudo hidratos e gordura (${fmt(kcal)} kcal, só ${fmt(p, 1)} g de proteína): conta como snack, não como refeição.`);
    else if (p < 15 && kcal >= 350) out.push(`Pouca proteína para ${fmt(kcal)} kcal (${fmt(p, 1)} g). Junta uma fonte de proteína na próxima refeição.`);
    if (fib >= 6) out.push(`Bom contributo de fibra (${fmt(fib, 1)} g).`);
  }

  if (i.assessOnly) {
    if (r.kcal < -100) out.push(`Já passaste o alvo do dia em ${fmt(-r.kcal)} kcal — o que conta é a média semanal, não um dia.`);
    else if (r.fat_g < -5) out.push(`A gordura já passou o alvo em ${fmt(-r.fat_g, 1)} g.`);
    if (!out.length) out.push(`Registado: ${fmt(kcal)} kcal, ${fmt(p, 1)} g de proteína.`);
    return out.slice(0, 3);
  }

  // 2) estado do dia
  if (r.kcal < -100) {
    out.push(`Já passaste o alvo do dia em ${fmt(-r.kcal)} kcal. Fecha o dia sem mais snacks — o que conta é a média semanal, não um dia.`);
  } else {
    const ps = r.protein_g > 0 ? proteinSuggestion(r.kcal, r.protein_g) : null;
    if (r.protein_g > 25 && r.kcal < 400) {
      out.push(`Restam ${fmt(Math.max(r.kcal, 0))} kcal e faltam ${fmt(r.protein_g, 1)} g de proteína: escolhe proteína magra${ps ? `, por exemplo ${ps}` : ""}.`);
    } else if (r.kcal >= 0) {
      out.push(`Para o resto do dia: ${fmt(r.kcal)} kcal, ${fmt(Math.max(r.protein_g, 0), 1)} g de proteína${r.carbs_g > 0 ? `, ${fmt(r.carbs_g)} g de hidratos` : ""}.`);
      if (r.protein_g > 40 && ps) out.push(`Para a proteína em falta: ${ps}.`);
    }
    if (r.fat_g < -5) out.push(`A gordura já passou o alvo em ${fmt(-r.fat_g, 1)} g — o resto do dia, magro.`);
  }

  // 3) fibra ao fim do dia
  if (i.hour >= 17 && r.fiber_g > 15) out.push(`Faltam ${fmt(r.fiber_g)} g de fibra: legumes, fruta ou leguminosas ao jantar.`);

  // 4) contexto de treino e fase
  const hard = ["longo", "qualidade", "prova"];
  if (i.tomorrowWorkout && hard.includes(i.tomorrowWorkout.type)) {
    out.push(`Amanhã tens ${i.tomorrowWorkout.title.replace(/^🏁\s*/, "")}: garante hidratos hoje ao jantar${r.carbs_g > 0 ? ` (faltam ${fmt(r.carbs_g)} g)` : ""}.`);
  } else if (i.todayWorkout && hard.includes(i.todayWorkout.type) && !i.todayWorkout.done) {
    out.push(`Ainda tens ${i.todayWorkout.title} hoje: não comas pesado nas 2 h antes.`);
  }
  if (i.phaseNote && /carga de hidratos/i.test(i.phaseNote)) out.push("Fase de carga: prioriza hidratos e conta com +1 a 1,5 kg de água na balança — é normal.");

  return out.slice(0, 4);
}

// ---------------------------------------------------------------- treinos

export interface WorkoutCommentInput {
  type: string; // corrida, força, …
  distanceKm: number | null;
  pace: number | null; // min/km
  avgHr: number | null;
  maxHr: number | null;
  cardiacCost: number | null;
  planned?: { type: string; title: string; distanceKm: number | null; paceMinS: number | null; paceMaxS: number | null; hrMax: number | null } | null;
  splits: Array<{ pace: number | null; avgHr: number | null }>;
  similarCardiacCost?: number | null; // média dos treinos semelhantes recentes
  easyHrMax: number; // 150
  tomorrow?: { type: string; title: string } | null;
}

export function workoutComment(i: WorkoutCommentInput): string[] {
  const out: string[] = [];
  if (i.type === "força") {
    out.push("Força feita. Bom: é o que protege as pernas para o volume de corrida.");
    if (i.tomorrow) out.push(`A seguir: ${i.tomorrow.title.replace(/^🏁\s*/, "")}.`);
    return out;
  }
  if (i.type !== "corrida") {
    out.push("Treino registado.");
    return out;
  }
  const pl = i.planned;
  const isEasy = !pl || ["fácil", "longo", "recuperação"].includes(pl.type);

  // distância vs plano (o plano estima o total com aquecimento e desaquecimento)
  if (pl?.distanceKm && i.distanceKm) {
    const diff = (i.distanceKm - pl.distanceKm) / pl.distanceKm;
    if (diff < -0.15) out.push(`Ficaste curto na distância: ${fmt(i.distanceKm, 1)} km de ≈${fmt(pl.distanceKm, 1)} km planeados.`);
    else if (diff > 0.15) out.push(`Fizeste mais do que o plano: ${fmt(i.distanceKm, 1)} km de ≈${fmt(pl.distanceKm, 1)} km. Cuidado com o volume extra.`);
  }

  if (isEasy && pl?.type !== "longo") {
    const hrCap = pl?.hrMax ?? i.easyHrMax;
    const kmOver = i.splits.filter((s) => (s.avgHr ?? 0) > hrCap).length;
    if (i.avgHr && i.avgHr > hrCap) out.push(`FC média ${i.avgHr} acima do teto de ${hrCap} de um fácil — abranda; o fácil é para recuperar.`);
    else if (kmOver > 0) out.push(`FC média ${i.avgHr ?? "—"} bem controlada, mas ${kmOver} ${kmOver === 1 ? "km passou" : "km passaram"} do teto de ${hrCap}.`);
    else if (i.avgHr) out.push(`Fácil bem executado: FC média ${i.avgHr}, sempre abaixo de ${hrCap}.`);
    if (i.pace && i.pace < 5.4) out.push(`Ritmo médio ${formatPace(i.pace)}/km, mais rápido do que a zona fácil (5:30–5:55).`);
  } else if (pl && pl.paceMinS && pl.paceMaxS && i.splits.length) {
    const lo = pl.paceMinS / 60 - 5 / 60;
    const hi = pl.paceMaxS / 60 + 5 / 60;
    const inZone = i.splits.filter((s) => s.pace && s.pace >= lo && s.pace <= hi).length;
    const faster = i.splits.filter((s) => s.pace && s.pace < lo).length;
    out.push(`${inZone} ${inZone === 1 ? "km ficou" : "km ficaram"} no ritmo-alvo (${formatPace(pl.paceMinS / 60)}–${formatPace(pl.paceMaxS / 60)}/km)${faster ? `; ${faster} mais ${faster === 1 ? "rápido" : "rápidos"} do que o alvo — não te queimes nas séries` : ""}.`);
    if (i.maxHr && i.maxHr >= 180) out.push(`FC máx. ${i.maxHr}: esforço muito alto para um treino, perto do teu máximo (185).`);
  }

  if (pl?.type === "longo" && i.avgHr) out.push(`Longo com FC média ${i.avgHr}${i.pace ? ` a ${formatPace(i.pace)}/km` : ""}.`);

  if (i.cardiacCost && i.similarCardiacCost) {
    const d = round1(i.cardiacCost - i.similarCardiacCost);
    if (d <= -2) out.push(`Eficiência melhor do que a média recente (custo cardíaco ${fmt(i.cardiacCost, 1)} vs ${fmt(i.similarCardiacCost, 1)}).`);
    else if (d >= 3) out.push(`Custo cardíaco ${fmt(i.cardiacCost, 1)}, acima da tua média recente (${fmt(i.similarCardiacCost, 1)}): calor, vento, cansaço ou pouco sono?`);
  }

  out.push(isEasy ? "Recupera: proteína e hidratos na próxima refeição." : "Depois de um treino forte: proteína (25–40 g) e hidratos nas próximas 2 h.");
  if (i.tomorrow) out.push(`Amanhã: ${i.tomorrow.title.replace(/^🏁\s*/, "")}.`);
  return out.slice(0, 5);
}
