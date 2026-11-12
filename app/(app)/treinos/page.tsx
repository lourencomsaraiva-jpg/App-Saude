import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { addDays, formatDatePt, todayInTz, weekdayShort } from "@/lib/calc/dates";
import { fmt } from "@/lib/calc/numbers";
import { cardiacCost, formatDuration, formatPace, paceFromDistance } from "@/lib/calc/running";
import type { ActivityRow } from "@/lib/types";
import { PageHeader, Section } from "@/components/ui";
import { SyncButton } from "@/components/sync-button";
import { FitUpload, ManualActivity } from "./forms";

export default async function TreinosPage() {
  const { supabase } = await requireUser();
  const since = addDays(todayInTz(), -120);
  const { data } = await supabase.from("activities").select("*").gte("local_date", since).order("local_date", { ascending: false }).order("start_time", { ascending: false });
  const acts = (data ?? []) as ActivityRow[];
  return (
    <div className="space-y-4">
      <PageHeader title="Treinos" subtitle="Últimos 120 dias" right={<SyncButton compact />} />
      <Section>
        <ul className="divide-y divide-line">
          {acts.map((a) => {
            const pace = paceFromDistance(a.distance_m, a.moving_time_s ?? a.duration_s);
            return (
              <li key={a.id}>
                <Link href={`/treinos/${a.id}`} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium capitalize">{a.name || a.type}</div>
                    <div className="text-xs text-muted">{weekdayShort(a.local_date)} {formatDatePt(a.local_date)} · {a.type}{a.source !== "intervals" ? ` · ${a.source === "seed" ? "histórico" : a.source}` : ""}</div>
                  </div>
                  <div className="num shrink-0 text-right text-xs">
                    <div className="text-sm font-semibold">{a.distance_m ? `${fmt(Number(a.distance_m) / 1000, 2)} km` : formatDuration(a.moving_time_s ?? a.duration_s)}</div>
                    <div className="text-muted">
                      {a.type === "corrida" && pace ? `${formatPace(pace)}/km` : ""}
                      {a.avg_hr ? ` · FC ${a.avg_hr}` : ""}
                      {a.type === "corrida" && cardiacCost(a.avg_hr, pace) ? ` · CC ${fmt(cardiacCost(a.avg_hr, pace), 1)}` : ""}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
          {acts.length === 0 && <li className="py-3 text-sm text-muted">Sem treinos. Sincroniza com o Intervals.icu ou carrega um ficheiro FIT.</li>}
        </ul>
      </Section>
      <Section title="Carregar ficheiro .FIT"><FitUpload /></Section>
      <Section title="Adicionar treino à mão"><ManualActivity /></Section>
    </div>
  );
}
