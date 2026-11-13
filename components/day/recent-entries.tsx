"use client";
import { useState } from "react";
import type { MealSaved } from "@/app/(app)/actions";
import { MealSummary, summaryText } from "./meal-summary";

/** Comentário do treinador sobre as entradas das últimas 2 h (números escondidos por defeito). */
export function RecentEntries({ s, stamp, tips }: { s: MealSaved; stamp: string; tips: string[] }) {
  const [hidden, setHidden] = useState<string | null>(null);
  const [numbers, setNumbers] = useState(false);
  if (hidden === stamp) return null;
  const prompt = `Usa o conector Treino & Nutrição. Acabei de registar (${s.label}):\n\n${summaryText(s)}\n\nComenta como meu treinador e nutricionista, de forma curta, e sugere o que comer no resto do dia.`;
  return (
    <section className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-accent">Treinador · {s.label}</div>
          <div className="text-xs text-muted">{s.items.map((i) => i.description).join(", ")}</div>
        </div>
        <button type="button" className="text-muted" onClick={() => setHidden(stamp)} aria-label="Fechar">✕</button>
      </div>
      <ul className="space-y-1.5 text-sm">
        {tips.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNumbers((v) => !v)}>{numbers ? "Esconder números" : "Ver números"}</button>
        <a href={`https://claude.ai/new?q=${encodeURIComponent(prompt)}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Falar mais com o Claude ↗</a>
      </div>
      {numbers && <MealSummary s={s} onClose={() => setNumbers(false)} hideClaude />}
    </section>
  );
}
