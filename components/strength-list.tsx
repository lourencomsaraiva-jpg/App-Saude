import type { StrengthSessionRow } from "@/lib/types";
import { fmt } from "@/lib/calc/numbers";

/** Lista compacta dos exercícios de uma sessão de força (para o dia no plano e no ecrã Hoje). */
export function StrengthList({ session }: { session: Pick<StrengthSessionRow, "name" | "notes" | "strength_exercises"> }) {
  const ex = [...(session.strength_exercises ?? [])].sort((a, b) => a.position - b.position);
  if (!ex.length) return null;
  return (
    <div className="mt-1.5 rounded-lg bg-soft p-2 text-xs">
      <ul className="space-y-1">
        {ex.map((e) => (
          <li key={e.id} className="flex items-baseline justify-between gap-2">
            <span>
              {e.superset && <span className="chip mr-1 bg-card">{e.superset}</span>}
              {e.name}
            </span>
            <span className="num shrink-0 text-muted">
              {e.sets ?? "—"} × {e.reps ?? "—"}
              {e.load_kg ? ` · ${fmt(Number(e.load_kg), 1)} kg` : ""}
            </span>
          </li>
        ))}
      </ul>
      {session.notes && <p className="mt-1.5 text-muted">{session.notes}</p>}
    </div>
  );
}
