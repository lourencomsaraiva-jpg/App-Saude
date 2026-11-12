import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { addDays, formatDatePt, todayInTz, weekdayShort } from "@/lib/calc/dates";
import { fmt } from "@/lib/calc/numbers";
import { formatPace } from "@/lib/calc/running";
import { formatMinutes } from "@/lib/calc/sleep";
import { loadDays } from "@/lib/data/days";
import { loadSettings } from "@/lib/data/settings";
import { PageHeader } from "@/components/ui";

export default async function DiarioPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { supabase } = await requireUser();
  const { dias } = await searchParams;
  const n = Math.min(Math.max(Number(dias) || 30, 7), 400);
  const end = todayInTz();
  const settings = await loadSettings(supabase);
  const days = await loadDays(supabase, addDays(end, -(n - 1)), end, settings);

  return (
    <div>
      <PageHeader title="Diário" subtitle={`Últimos ${n} dias · toca numa linha para editar`} right={<a href={`/api/export?formato=csv&dias=${n}`} className="btn btn-ghost btn-sm">CSV</a>} />
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="num w-full min-w-[1100px] text-xs">
          <thead className="text-left text-muted">
            <tr className="border-b border-line">
              {["Data", "Peso", "Comido", "Gasto base", "Exerc. bruto", "Exerc. aj.", "Saldo", "Prot", "Hidr", "Gord", "Fibra", "Dist.", "Ritmo", "FC", "Sono", "Notas"].map((h) => (
                <th key={h} className="px-1.5 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const s = d.summary;
              return (
                <tr key={d.date} className="border-b border-line align-top">
                  <td className="whitespace-nowrap px-1.5 py-2 font-medium">
                    <Link href={d.date === end ? "/" : `/dia/${d.date}`} className="text-accent">{weekdayShort(d.date)} {formatDatePt(d.date)}</Link>
                  </td>
                  <td className="px-1.5 py-2">{fmt(d.weight_kg, 1)}</td>
                  <td className="px-1.5 py-2">{d.has_food ? fmt(s.eaten.kcal) : "—"}</td>
                  <td className="px-1.5 py-2">{fmt(s.base_burn_kcal)}</td>
                  <td className="px-1.5 py-2">{s.exercise_kcal_raw ? fmt(s.exercise_kcal_raw) : "—"}</td>
                  <td className="px-1.5 py-2">{s.exercise_kcal_adj ? fmt(s.exercise_kcal_adj) : "—"}</td>
                  <td className={`px-1.5 py-2 ${s.balance_kcal > 0 ? "text-warn" : ""}`}>{d.has_food ? fmt(s.balance_kcal) : "—"}</td>
                  <td className={`px-1.5 py-2 ${s.protein_on_target ? "text-good" : ""}`}>{fmt(s.eaten.protein_g, 1)}</td>
                  <td className="px-1.5 py-2">{fmt(s.eaten.carbs_g, 1)}</td>
                  <td className="px-1.5 py-2">{fmt(s.eaten.fat_g, 1)}</td>
                  <td className="px-1.5 py-2">{fmt(s.eaten.fiber_g, 1)}</td>
                  <td className="px-1.5 py-2">{d.run_distance_km ? fmt(d.run_distance_km, 2) : d.activities.length ? d.activities.map((a) => a.type).join(", ") : "—"}</td>
                  <td className="px-1.5 py-2">{d.run_pace ? formatPace(d.run_pace) : "—"}</td>
                  <td className="px-1.5 py-2">{d.run_avg_hr ?? "—"}</td>
                  <td className="whitespace-nowrap px-1.5 py-2">{d.sleep ? formatMinutes(d.sleep.total_min) : "—"}</td>
                  <td className="max-w-[260px] px-1.5 py-2 text-muted"><span className="line-clamp-2">{d.notes ?? ""}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex gap-2">
        {[30, 90, 400].map((k) => (
          <Link key={k} href={`/diario?dias=${k}`} className={`btn btn-sm ${k === n ? "" : "btn-ghost"}`}>{k === 400 ? "Tudo" : `${k} dias`}</Link>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Sono: noite que começa nesse dia (convenção X−1). Exercício ajustado = bruto × {fmt(settings.energy.exerciseFactor, 2)} a partir de {formatDatePt(settings.energy.exerciseFactorStart, true)}.</p>
    </div>
  );
}
