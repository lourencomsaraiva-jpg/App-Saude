"use client";
import { useState } from "react";
import type { MealSaved } from "@/app/(app)/actions";
import { MealSummary } from "./meal-summary";

/** Cartão "Treinador": comentário à última atualização + plano até ao fim do dia. */
export function CoachCard({ seen, foodPlan, foodAfter, training, numbers, prompt }: { seen: string[]; foodPlan: string[]; foodAfter: string | null; training: string[]; numbers: MealSaved | null; prompt: string }) {
  const [showNumbers, setShowNumbers] = useState(false);
  return (
    <section className="card space-y-3">
      <h2 className="text-sm font-semibold text-accent">Treinador</h2>
      {seen.length > 0 && (
        <div>
          <div className="label mb-1">O que vi</div>
          <ul className="space-y-1.5 text-sm">{seen.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
      <div>
        <div className="label mb-1">Até ao fim do dia</div>
        <ul className="space-y-1.5 text-sm">
          {foodPlan.map((t, i) => <li key={`f${i}`}>🍽️ {t}</li>)}
          {foodAfter && <li className="text-xs text-muted">{foodAfter}</li>}
          {training.map((t, i) => <li key={`t${i}`}>🏃 {t}</li>)}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2">
        {numbers && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNumbers((v) => !v)}>{showNumbers ? "Esconder números" : "Ver números"}</button>}
        <a href={`https://claude.ai/new?q=${encodeURIComponent(prompt)}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Falar mais com o Claude ↗</a>
      </div>
      {showNumbers && numbers && <MealSummary s={numbers} onClose={() => setShowNumbers(false)} hideClaude />}
    </section>
  );
}
