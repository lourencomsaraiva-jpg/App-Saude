"use client";
import { useState } from "react";
import type { MealSaved } from "@/app/(app)/actions";
import { MealSummary } from "./meal-summary";

/** Últimas entradas (2 h): tabela + caixa para comentar com o Claude. Pode ser escondida até à próxima entrada. */
export function RecentEntries({ s, stamp }: { s: MealSaved; stamp: string }) {
  const [hidden, setHidden] = useState<string | null>(null);
  if (hidden === stamp) return null;
  return (
    <section className="card !pt-2">
      <MealSummary s={s} onClose={() => setHidden(stamp)} />
    </section>
  );
}
