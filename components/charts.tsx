"use client";
/**
 * Gráficos do dashboard (Recharts). Cores lidas dos tokens CSS (claro/escuro), uma série por cor fixa,
 * alvos como linhas de referência neutras tracejadas, um único eixo Y por gráfico, tooltip em todos.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import type { Dashboard } from "@/lib/data/dashboard";
import { formatDatePt } from "@/lib/calc/dates";
import { fmt } from "@/lib/calc/numbers";
import { formatPace } from "@/lib/calc/running";

type Colors = Record<"s1" | "s2" | "s3" | "s4" | "grid" | "ref" | "muted" | "card" | "line" | "fg", string>;

export function readColors(): Colors {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return { s1: v("--series-1"), s2: v("--series-2"), s3: v("--series-3"), s4: v("--series-4"), grid: v("--chart-grid"), ref: v("--chart-ref"), muted: v("--muted"), card: v("--card"), line: v("--line"), fg: v("--fg") };
}

export function useColors() {
  const [c, setC] = useState<Colors | null>(null);
  useEffect(() => {
    const update = () => setC(readColors());
    update();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return c;
}

function Card({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <h3 className="text-sm font-semibold">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
      <div className="mt-2 h-56 w-full">{children}</div>
    </section>
  );
}

type TipRow = { name?: string | number; value?: unknown; color?: string; dataKey?: unknown; payload?: Record<string, unknown> };
export function Tip({ active, payload, label, fmtValue, fmtLabel }: { active?: boolean; payload?: TipRow[]; label?: unknown; fmtValue?: (v: number, key: string) => string; fmtLabel?: (l: unknown, p?: Record<string, unknown>) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs shadow-sm">
      <div className="mb-0.5 font-semibold">{fmtLabel ? fmtLabel(label, payload[0]?.payload) : typeof label === "string" ? formatDatePt(label) : String(label ?? "")}</div>
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p, i) => (
          <div key={i} className="num flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted">{p.name}</span>
            <span className="ml-auto font-medium">{fmtValue ? fmtValue(Number(p.value), String(p.dataKey)) : fmt(Number(p.value), 1)}</span>
          </div>
        ))}
    </div>
  );
}

const axis = (c: Colors) => ({ stroke: c.line, tick: { fill: c.muted, fontSize: 11 }, tickLine: false });
const dateTick = (d: string) => formatDatePt(d);

export function DashboardCharts({ data, goalWeight }: { data: Dashboard; goalWeight: number | null }) {
  const c = useColors();
  if (!c) return <div className="h-40" />;
  const d = data.daily;
  const common = { data: d, margin: { top: 8, right: 8, left: 0, bottom: 0 } };
  const grid = <CartesianGrid stroke={c.grid} vertical={false} />;
  const x = <XAxis dataKey="date" tickFormatter={dateTick} minTickGap={24} {...axis(c)} />;
  const legend = <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: c.muted }} />;
  const kinds: Array<[string, string]> = [["fácil", c.s1], ["qualidade", c.s2], ["longo", c.s3]];

  return (
    <div className="grid gap-4">
      <Card title="Peso" note={`Diário e média semanal (Seg–Dom)${goalWeight ? ` · objetivo ${fmt(goalWeight, 1)} kg` : ""}`}>
        <ResponsiveContainer>
          <ComposedChart {...common}>
            {grid}{x}
            <YAxis domain={["dataMin - 0.5", "dataMax + 0.5"]} tickFormatter={(v) => fmt(v, 1)} {...axis(c)} width={48} />
            <Tooltip content={<Tip fmtValue={(v) => `${fmt(v, 1)} kg`} />} />
            {legend}
            <Line dataKey="weight" name="Peso" stroke={c.s1} strokeWidth={0} dot={{ r: 3, fill: c.s1, stroke: c.card, strokeWidth: 1 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
            <Line dataKey="weight_week_avg" name="Média semanal" stroke={c.s2} strokeWidth={2} dot={false} connectNulls={false} type="stepAfter" isAnimationActive={false} />
            {goalWeight && <Line dataKey={() => goalWeight} name="Objetivo" stroke={c.ref} strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Calorias comidas vs alvo" note="Alvo = base da fase + exercício ajustado">
        <ResponsiveContainer>
          <ComposedChart {...common}>
            {grid}{x}
            <YAxis {...axis(c)} width={48} />
            <Tooltip content={<Tip fmtValue={(v) => `${fmt(v)} kcal`} />} />
            {legend}
            <Bar dataKey="kcal" name="Comidas" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
            <Line dataKey="target" name="Alvo" stroke={c.ref} strokeDasharray="4 4" strokeWidth={1.5} dot={false} type="stepAfter" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Saldo calórico diário" note="Comido − gasto base − exercício ajustado. Abaixo de zero = défice.">
        <ResponsiveContainer>
          <BarChart {...common}>
            {grid}{x}
            <YAxis {...axis(c)} width={48} />
            <Tooltip content={<Tip fmtValue={(v) => `${v > 0 ? "+" : ""}${fmt(v)} kcal`} />} />
            <Bar dataKey="balance" name="Saldo" radius={[4, 4, 4, 4]} maxBarSize={14} isAnimationActive={false}>
              {d.map((row) => <Cell key={row.date} fill={(row.balance ?? 0) > 0 ? c.s2 : c.s1} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["protein", "Proteína (g)"],
            ["carbs", "Hidratos (g)"],
            ["fat", "Gordura (g)"],
            ["fiber", "Fibra (g)"],
          ] as const
        ).map(([k, title]) => (
          <Card key={k} title={title} note="Barras: comido · tracejado: alvo">
            <ResponsiveContainer>
              <ComposedChart {...common}>
                {grid}{x}
                <YAxis {...axis(c)} width={40} />
                <Tooltip content={<Tip fmtValue={(v) => `${fmt(v, 1)} g`} />} />
                <Bar dataKey={k} name="Comido" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={10} isAnimationActive={false} />
                <Line dataKey={`${k}_target`} name="Alvo" stroke={c.ref} strokeDasharray="4 4" strokeWidth={1.5} dot={false} type="stepAfter" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        ))}
      </div>

      <Card title="Passos">
        <ResponsiveContainer>
          <BarChart {...common}>
            {grid}{x}
            <YAxis {...axis(c)} width={48} tickFormatter={(v) => (v >= 1000 ? `${fmt(v / 1000, 0)}k` : String(v))} />
            <Tooltip content={<Tip fmtValue={(v) => fmt(v)} />} />
            <Bar dataKey="steps" name="Passos" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Treinos por tipo (por semana)">
        <ResponsiveContainer>
          <BarChart data={data.workoutsByWeek} margin={common.margin}>
            {grid}
            <XAxis dataKey="week" tickFormatter={dateTick} {...axis(c)} />
            <YAxis allowDecimals={false} {...axis(c)} width={32} />
            <Tooltip content={<Tip fmtValue={(v) => fmt(v)} fmtLabel={(l) => `Semana de ${formatDatePt(String(l))}`} />} />
            {legend}
            {(
              [
                ["corrida", c.s1],
                ["força", c.s2],
                ["bicicleta", c.s3],
                ["outro", c.s4],
              ] as const
            ).map(([k, col], i, arr) => (
              <Bar key={k} dataKey={k} name={k} stackId="t" fill={col} stroke={c.card} strokeWidth={2} radius={i === arr.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={28} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Sono" note="Total por noite e média de 7 dias (horas)">
        <ResponsiveContainer>
          <ComposedChart {...common}>
            {grid}{x}
            <YAxis domain={[0, "dataMax + 1"]} {...axis(c)} width={32} />
            <Tooltip content={<Tip fmtValue={(v) => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, "0")} h`} />} />
            {legend}
            <Bar dataKey="sleep_h" name="Noite" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
            <Line dataKey="sleep_7d_h" name="Média 7 dias" stroke={c.s2} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Ritmo por tipo de treino" note="Mais alto = mais rápido">
        <ResponsiveContainer>
          <ScatterChart margin={common.margin}>
            {grid}
            <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(t) => formatDatePt(new Date(t).toISOString().slice(0, 10))} {...axis(c)} />
            <YAxis dataKey="pace" type="number" reversed domain={["dataMin - 0.1", "dataMax + 0.1"]} tickFormatter={(v) => formatPace(v)} {...axis(c)} width={40} />
            <ZAxis range={[60, 60]} />
            <Tooltip content={<Tip fmtLabel={(_, p) => `${formatDatePt(String(p?.date))} · ${fmt(Number(p?.km), 1)} km · FC ${p?.hr ?? "—"}`} fmtValue={(v, key) => (key === "pace" ? `${formatPace(v)}/km` : formatDatePt(new Date(v).toISOString().slice(0, 10)))} />} />
            {legend}
            {kinds.map(([k, col]) => (
              <Scatter key={k} name={k} data={data.runPoints.filter((r) => r.kind === k).map((r) => ({ ...r, t: Date.parse(r.date) }))} fill={col} stroke={c.card} strokeWidth={1.5} isAnimationActive={false} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Eficiência aeróbica: FC média vs ritmo" note="Cada ponto é uma corrida. Mais à direita e mais abaixo = mais eficiente.">
        <ResponsiveContainer>
          <ScatterChart margin={common.margin}>
            {grid}
            <XAxis dataKey="pace" type="number" reversed domain={["dataMin - 0.1", "dataMax + 0.1"]} tickFormatter={(v) => formatPace(v)} {...axis(c)} />
            <YAxis dataKey="hr" type="number" domain={["dataMin - 5", "dataMax + 5"]} {...axis(c)} width={40} />
            <ZAxis range={[60, 60]} />
            <Tooltip content={<Tip fmtLabel={(_, p) => `${formatDatePt(String(p?.date))} · ${fmt(Number(p?.km), 1)} km`} fmtValue={(v, key) => (key === "pace" ? `${formatPace(v)}/km` : `${fmt(v)} bpm`)} />} />
            {legend}
            {kinds.map(([k, col]) => (
              <Scatter key={k} name={k} data={data.runPoints.filter((r) => r.kind === k && r.hr)} fill={col} stroke={c.card} strokeWidth={1.5} isAnimationActive={false} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </Card>

      <Card title="FC a ritmo ~5:30/km ao longo do tempo" note="Corridas com ritmo médio entre 5:15 e 5:45/km. A descer = melhor forma aeróbica.">
        <ResponsiveContainer>
          <ComposedChart data={data.efficiency} margin={common.margin}>
            {grid}
            <XAxis dataKey="date" tickFormatter={dateTick} {...axis(c)} />
            <YAxis domain={["dataMin - 3", "dataMax + 3"]} {...axis(c)} width={40} />
            <Tooltip content={<Tip fmtValue={(v) => `${fmt(v)} bpm`} />} />
            <Line dataKey="hr" name="FC média" stroke={c.s1} strokeWidth={2} dot={{ r: 4, fill: c.s1, stroke: c.card, strokeWidth: 2 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
