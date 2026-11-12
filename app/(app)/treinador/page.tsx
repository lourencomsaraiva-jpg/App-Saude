import { requireUser } from "@/lib/auth";
import { formatDatePt, addDays } from "@/lib/calc/dates";
import { formatDuration, formatPace } from "@/lib/calc/running";
import { Markdown } from "@/components/markdown";
import { PageHeader, Section } from "@/components/ui";
import { Chat, Projection, ReviewActions, RunReview } from "./client";

interface Change { action: string; workout_id?: string; date?: string; title?: string; distance_km?: number; type?: string; reason: string }

export default async function TreinadorPage() {
  const { supabase } = await requireUser();
  const [{ data: msgs }, { data: reviews }, { data: projections }, { data: workouts }] = await Promise.all([
    supabase.from("coach_messages").select("id, role, content, created_at").eq("kind", "chat").order("created_at", { ascending: false }).limit(40),
    supabase.from("weekly_reviews").select("*").order("week_start", { ascending: false }).limit(4),
    supabase.from("coach_messages").select("id, content, created_at").eq("kind", "projection").order("created_at", { ascending: false }).limit(1),
    supabase.from("planned_workouts").select("id, date, title"),
  ]);
  const wById = new Map((workouts ?? []).map((w) => [w.id, w]));
  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  return (
    <div className="space-y-4">
      <PageHeader title="Treinador" subtitle="Analisa os teus dados reais. Não inventa números." />
      {!hasKey && <p className="rounded-lg bg-soft p-3 text-sm text-warn">Falta ANTHROPIC_API_KEY nas variáveis de ambiente da Vercel.</p>}

      <Chat initial={((msgs ?? []) as Array<{ id: string; role: "user" | "assistant"; content: string }>).reverse()} />

      <Section title="Revisão semanal" right={<RunReview />}>
        <div id="revisao" className="space-y-4">
          {(reviews ?? []).length === 0 && <p className="text-sm text-muted">Ainda sem revisões. É gerada ao domingo à noite (cron) ou a pedido.</p>}
          {(reviews ?? []).map((r) => (
            <article key={r.id} className="rounded-lg border border-line p-3">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Semana {formatDatePt(r.week_start)}–{formatDatePt(addDays(r.week_start, 6))}</h3>
                <span className={`chip ${r.status === "aceite" ? "text-good" : r.status === "rejeitada" ? "text-bad" : "text-warn"}`}>{r.status}</span>
              </div>
              <Markdown>{r.review_md}</Markdown>
              {(r.proposal as Change[]).length > 0 && (
                <div className="mt-2">
                  <h4 className="text-xs font-semibold">Proposta de ajuste</h4>
                  <ul className="mt-1 space-y-1 text-xs">
                    {(r.proposal as Change[]).map((c, i) => {
                      const w = c.workout_id ? wById.get(c.workout_id) : null;
                      return (
                        <li key={i} className="rounded bg-soft p-1.5">
                          <b>{c.action === "update" ? "Alterar" : c.action === "add" ? "Adicionar" : "Remover"}</b>{" "}
                          {w ? `${formatDatePt(w.date)} ${w.title}` : ""}
                          {c.date ? ` → ${formatDatePt(c.date)}` : ""}
                          {c.title ? ` · ${c.title}` : ""}
                          {c.distance_km ? ` · ${c.distance_km} km` : ""}
                          <div className="text-muted">{c.reason}</div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {r.status === "pendente" && <ReviewActions id={r.id} />}
            </article>
          ))}
        </div>
      </Section>

      <Section title="Projeção de prova">
        <Projection last={projections?.[0]?.content ?? null} />
        <p className="mt-2 text-xs text-muted">Objetivos: meia &lt; {formatDuration(5400)} ({formatPace(5400 / 60 / 21.0975)}/km) · 10 km &lt; {formatDuration(2400)} ({formatPace(4)}/km).</p>
      </Section>
    </div>
  );
}
