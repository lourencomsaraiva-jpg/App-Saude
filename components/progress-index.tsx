"use client";
/**
 * Índice de evolução: número principal da semana, gráfico semanal (0–100) e um cartão por componente
 * com valor, variação e mini-gráfico. Uma só série por gráfico, um eixo, tooltip em todos.
 */
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDatePt } from "@/lib/calc/dates";
import { fmt } from "@/lib/calc/numbers";
import { formatMinutes } from "@/lib/calc/sleep";
import { COMPONENTS, type ComponentKey, type ProgressWeek } from "@/lib/calc/progress";
import { useColors } from "./charts";

const DETAIL: Record<ComponentKey, (w: ProgressWeek) => string> = {
  peso: (w) => (w.raw.weight_delta === null ? "Precisa de ≥2 pesagens nesta e na semana anterior" : `${fmt(w.raw.weight_avg, 1)} kg · ${w.raw.weight_delta > 0 ? "+" : ""}${fmt(w.raw.weight_delta, 1)} kg/sem.`),
  nutricao: (w) => `${w.raw.food_days} dias registados · kcal, proteína e fibra vs. alvo`,
  sono: (w) => (w.raw.sleep_avg_min === null ? "Sem dados" : `${formatMinutes(w.raw.sleep_avg_min)} por noite`),
  treino: (w) => (w.raw.plan_total ? `${w.raw.plan_done} de ${w.raw.plan_total} treinos planeados` : "Sem treinos planeados"),
  eficiencia: (w) => (w.raw.cardiac_cost === null ? "Sem corridas" : `Custo cardíaco ${fmt(w.raw.cardiac_cost, 1)} (menor = melhor)`),
  recuperacao: (w) => [w.raw.rhr !== null ? `FC rep. ${fmt(w.raw.rhr)}` : null, w.raw.hrv !== null ? `VFC ${fmt(w.raw.hrv)}` : null].filter(Boolean).join(" · ") || "Sem dados",
  passos: (w) => (w.raw.steps === null ? "Sem dados" : `${fmt(w.raw.steps)} passos/dia`),
};

function verdict(v: number) {
  if (v >= 80) return "Muito bem";
  if (v >= 65) return "Bem";
  if (v >= 50) return "Razoável";
  return "A melhorar";
}

function Delta({ now, prev }: { now: number | null; prev: number | null }) {
  if (now === null || prev === null) return null;
  const d = now - prev;
  if (d === 0) return <span className="text-xs text-muted">= semana anterior</span>;
  return <span className="num text-xs text-muted">{d > 0 ? "▲" : "▼"} {Math.abs(d)} vs. semana anterior</span>;
}

export function ProgressIndex({ weeks }: { weeks: ProgressWeek[] }) {
  const c = useColors();
  const withIdx = weeks.filter((w) => w.index !== null);
  if (!withIdx.length) return null;
  const cur = withIdx[withIdx.length - 1];
  const prev = withIdx.length > 1 ? withIdx[withIdx.length - 2] : null;
  const data = weeks.map((w) => ({ week: w.week_start, index: w.index, ...w.parts }));
  const axis = c ? { stroke: c.line, tick: { fill: c.muted, fontSize: 11 }, tickLine: false } : {};

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Índice de evolução</h2>
        <p className="mt-0.5 text-xs text-muted">0–100 por semana: média de peso, nutrição, sono, treino, eficiência, recuperação e passos (os que têm dados). Últimas 12 semanas.</p>
      </div>

      <div className="flex items-end gap-3">
        <div className="num text-5xl font-semibold leading-none">{cur.index}</div>
        <div className="pb-0.5">
          <div className="text-sm font-medium">{verdict(cur.index!)}</div>
          <div className="text-xs text-muted">Semana de {formatDatePt(cur.week_start)}</div>
          <Delta now={cur.index} prev={prev?.index ?? null} />
        </div>
      </div>

      <div className="h-48 w-full">
        {c && (
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="week" tickFormatter={(v) => formatDatePt(v)} {...axis} minTickGap={16} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} {...axis} axisLine={false} width={36} />
              <ReferenceLine y={50} stroke={c.ref} strokeDasharray="4 4" />
              <Tooltip
                cursor={{ stroke: c.ref }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
                  if (!active || !p) return null;
                  return (
                    <div className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs shadow-sm">
                      <div className="mb-0.5 font-semibold">Semana de {formatDatePt(p.week)} · índice {p.index ?? "—"}</div>
                      {COMPONENTS.map(([k, name]) => (
                        <div key={k} className="num flex gap-3">
                          <span className="text-muted">{name}</span>
                          <span className="ml-auto font-medium">{p[k] ?? "—"}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Line dataKey="index" name="Índice" stroke={c.s1} strokeWidth={2} dot={{ r: 4, fill: c.s1, stroke: c.card, strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {COMPONENTS.map(([k, name]) => {
          const now = cur.parts[k];
          const before = prev?.parts[k] ?? null;
          const series = weeks.map((w) => ({ week: w.week_start, v: w.parts[k] }));
          return (
            <div key={k} className="flex items-center gap-3 rounded-lg border border-line p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="num ml-auto text-lg font-semibold">{now ?? "—"}</span>
                </div>
                <div className="truncate text-xs text-muted">{DETAIL[k](cur)}</div>
                <Delta now={now} prev={before} />
              </div>
              <div className="h-10 w-24 shrink-0">
                {c && (
                  <ResponsiveContainer>
                    <LineChart data={series} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip
                        cursor={false}
                        content={({ active, payload }) => {
                          const p = payload?.[0]?.payload as { week: string; v: number | null } | undefined;
                          if (!active || !p) return null;
                          return <div className="num rounded border border-line bg-card px-2 py-1 text-xs shadow-sm">{formatDatePt(p.week)}: {p.v ?? "—"}</div>;
                        }}
                      />
                      <Line dataKey="v" stroke={c.s1} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
