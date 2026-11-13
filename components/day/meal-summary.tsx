"use client";
import type { MealSaved } from "@/app/(app)/actions";
import { fmt } from "@/lib/calc/numbers";

const COLS = [
  ["kcal", "kcal", 0],
  ["protein_g", "Prot", 1],
  ["carbs_g", "Hidr", 1],
  ["fat_g", "Gord", 1],
  ["fiber_g", "Fibra", 1],
] as const;

type Row = { kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null };

/** Texto da tabela (para enviar ao Claude). */
export function summaryText(s: MealSaved) {
  const line = (name: string, r: Row) => `| ${name} | ${COLS.map(([k, , d]) => fmt(r[k], d)).join(" | ")} |`;
  const t = s.target;
  return [
    `| Alimento | kcal | Prot | Hidr | Gord | Fibra |`,
    `|---|---|---|---|---|---|`,
    ...s.items.map((i) => line(i.description, i)),
    line("Total comido hoje", s.eaten),
    line(`Falta (alvo ${fmt(t.kcal)} kcal / ${fmt(t.protein_g)} P / ${fmt(t.carbs_g, 1)} H / ${fmt(t.fat_g, 1)} G / ${fmt(t.fiber_g)} F)`, s.remaining),
  ].join("\n");
}

/** Cartão mostrado logo depois de gravar uma refeição + caixa para comentar com o Claude. */
export function MealSummary({ s, onClose }: { s: MealSaved; onClose: () => void }) {
  const t = s.target;
  const cell = (v: number | null, d: number, neg = false) => (
    <td className={`px-1 py-1 text-right ${neg && v !== null && v < 0 ? "text-bad" : ""}`}>{fmt(v, d)}</td>
  );
  const prompt = `Usa o conector Treino & Nutrição. Acabei de registar (${s.label}):\n\n${summaryText(s)}\n\nComenta de forma curta e sugere o que comer no resto do dia para fechar os alvos.`;
  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-xl border border-accent p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold capitalize">Registado · {s.label}</h3>
          <button type="button" className="text-muted" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <div className="-mx-3 overflow-x-auto px-3">
          <table className="num w-full min-w-[420px] text-xs">
            <thead className="text-muted">
              <tr className="border-b border-line">
                <th className="py-1 text-left font-medium">Alimento</th>
                {COLS.map(([k, l]) => <th key={k} className="px-1 text-right font-medium">{l}</th>)}
              </tr>
            </thead>
            <tbody>
              {s.items.map((i, idx) => (
                <tr key={idx} className="border-b border-line">
                  <td className="py-1 pr-2">{i.description}</td>
                  {COLS.map(([k, , d]) => <td key={k} className="px-1 py-1 text-right">{fmt(i[k], d)}</td>)}
                </tr>
              ))}
              <tr className="border-b border-line font-semibold">
                <td className="py-1 pr-2">Total comido hoje</td>
                {COLS.map(([k, , d]) => cell(s.eaten[k], d))}
              </tr>
              <tr className="font-semibold text-accent">
                <td className="py-1 pr-2">
                  Falta <span className="font-normal text-muted">(alvo {fmt(t.kcal)} kcal / {fmt(t.protein_g)} P / {fmt(t.carbs_g, 1)} H / {fmt(t.fat_g, 1)} G / {fmt(t.fiber_g)} F)</span>
                </td>
                {COLS.map(([k, , d]) => cell(s.remaining[k], d, true))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-muted">Valores negativos em &quot;Falta&quot; = excedido.</p>
      </div>
      <a href={`https://claude.ai/new?q=${encodeURIComponent(prompt)}`} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-line bg-soft p-3 text-sm">
        <span className="font-semibold">Comentar com o Claude ↗</span>
        <span className="mt-0.5 block text-xs text-muted">Abre o teu chat com esta tabela para ele comentar e sugerir o resto do dia.</span>
      </a>
    </div>
  );
}
