/**
 * Sincronização Intervals.icu → base de dados. Idempotente (upsert por external_id).
 * Regras:
 *  - nunca duplica treinos;
 *  - valores manuais (e do histórico) prevalecem: peso/passos manuais e sono manual/histórico não são substituídos;
 *  - campos escritos à mão nas atividades (condições, sensação, ligação ao plano, análise) não são tocados.
 */
import { addDays, todayInTz, type ISODate } from "../calc/dates";
import { fetchActivities, fetchActivityDetail, fetchWellness, mapActivity, mapWellness, type IntervalsConfig } from "../integrations/intervals";
import type { DB } from "../types";
import { linkActivitiesToPlan } from "./link-plan";
import { upsertGrouped } from "../db-utils";

export interface SyncResult {
  ok: boolean;
  imported: number;
  newActivityIds: string[];
  errors: string[];
}

export async function syncIntervals(
  db: DB,
  userId: string,
  cfg: IntervalsConfig,
  opts: { trigger: string; oldest?: ISODate; newest?: ISODate; detailLimit?: number } = { trigger: "manual" },
): Promise<SyncResult> {
  const newest = opts.newest ?? todayInTz();
  const oldest = opts.oldest ?? addDays(newest, -7);
  const errors: string[] = [];
  let imported = 0;
  const newActivityIds: string[] = [];

  const { data: log } = await db.from("sync_log").insert({ user_id: userId, source: "intervals", trigger: opts.trigger, status: "running", details: { oldest, newest } }).select("id").single();

  try {
    // ------------------------------------------------ atividades
    const raw = await fetchActivities(cfg, oldest, newest);
    const rows = raw.map(mapActivity).filter((a) => a.local_date);
    const { data: existing } = await db.from("activities").select("id, external_id").eq("user_id", userId).eq("source", "intervals").in("external_id", rows.length ? rows.map((r) => r.external_id) : ["-"]);
    const existingIds = new Set((existing ?? []).map((e: { external_id: string }) => e.external_id));

    if (rows.length) {
      const { data: upserted, error } = await db
        .from("activities")
        .upsert(rows.map((r) => ({ ...r, user_id: userId })), { onConflict: "user_id,source,external_id" })
        .select("id, external_id, local_date, type");
      if (error) throw new Error(`Atividades: ${error.message}`);
      imported += rows.length;
      const ups = (upserted ?? []) as Array<{ id: string; external_id: string; local_date: string; type: string }>;
      for (const u of ups) if (!existingIds.has(u.external_id)) newActivityIds.push(u.id);

      // Substitui as atividades-resumo do histórico nos dias em que já há dados reais.
      const dates = [...new Set(ups.map((u) => u.local_date))];
      await db.from("activities").delete().eq("user_id", userId).eq("source", "seed").in("local_date", dates);

      // Voltas e parciais por km (só para atividades novas ou sem parciais; limitado por execução).
      const { data: withLaps } = await db.from("activity_laps").select("activity_id").in("activity_id", ups.map((u) => u.id));
      const hasLaps = new Set((withLaps ?? []).map((l: { activity_id: string }) => l.activity_id));
      const needDetail = ups.filter((u) => !hasLaps.has(u.id) && (u.type === "corrida" || u.type === "bicicleta" || u.type === "caminhada")).slice(0, opts.detailLimit ?? 4);
      for (const u of needDetail) {
        try {
          const d = await fetchActivityDetail(cfg, u.external_id);
          errors.push(...d.errors.map((e) => `Detalhe ${u.external_id}: ${e}`));
          const lapRows = [...d.laps, ...d.splits].map((l) => ({ ...l, user_id: userId, activity_id: u.id }));
          if (lapRows.length) {
            const { error: le } = await db.from("activity_laps").upsert(lapRows, { onConflict: "activity_id,kind,idx" });
            if (le) errors.push(`Voltas ${u.external_id}: ${le.message}`);
          }
        } catch (e) {
          errors.push(`Detalhe ${u.external_id}: ${(e as Error).message}`);
        }
      }
    }

    // ------------------------------------------------ wellness (peso, passos, FC repouso, VFC, sono)
    const wellness = (await fetchWellness(cfg, oldest, newest)).map(mapWellness);
    if (wellness.length) {
      const dates = wellness.map((w) => w.day.date);
      const { data: days } = await db.from("days").select("date, weight_source, steps_source").eq("user_id", userId).in("date", dates);
      const dayByDate = new Map((days ?? []).map((d: { date: string; weight_source: string | null; steps_source: string | null }) => [d.date, d]));
      const dayRows = wellness
        .map(({ day }) => {
          const prev = dayByDate.get(day.date);
          const row: Record<string, unknown> = { user_id: userId, date: day.date };
          if (day.weight_kg !== null && (!prev || prev.weight_source === null || prev.weight_source === "intervals")) Object.assign(row, { weight_kg: day.weight_kg, weight_source: "intervals" });
          if (day.steps !== null && (!prev || prev.steps_source === null || prev.steps_source === "intervals")) Object.assign(row, { steps: day.steps, steps_source: "intervals" });
          if (day.resting_hr !== null) row.resting_hr = day.resting_hr;
          if (day.hrv !== null) row.hrv = day.hrv;
          return row;
        })
        .filter((r) => Object.keys(r).length > 2);
      if (dayRows.length) {
        const { error } = await upsertGrouped(db, "days", dayRows, "user_id,date");
        if (error) errors.push(`Dias: ${error.message}`);
        else imported += dayRows.length;
      }

      const sleeps = wellness.map((w) => w.sleep).filter((s): s is NonNullable<typeof s> => !!s);
      if (sleeps.length) {
        const { data: prevSleep } = await db.from("sleep").select("day_date, source").eq("user_id", userId).in("day_date", sleeps.map((s) => s.day_date));
        const locked = new Set((prevSleep ?? []).filter((s: { source: string }) => s.source !== "intervals").map((s: { day_date: string }) => s.day_date));
        const sleepRows = sleeps.filter((s) => !locked.has(s.day_date)).map((s) => ({ ...s, user_id: userId, source: "intervals" }));
        if (sleepRows.length) {
          const { error } = await db.from("sleep").upsert(sleepRows, { onConflict: "user_id,day_date" });
          if (error) errors.push(`Sono: ${error.message}`);
          else imported += sleepRows.length;
        }
      }
    }

    await linkActivitiesToPlan(db, userId, oldest, newest);

    const status = errors.length ? "partial" : "ok";
    if (log) await db.from("sync_log").update({ status, finished_at: new Date().toISOString(), imported_count: imported, error: errors.join("\n") || null, details: { oldest, newest, new_activities: newActivityIds.length } }).eq("id", (log as { id: string }).id);
    return { ok: true, imported, newActivityIds, errors };
  } catch (e) {
    const msg = (e as Error).message;
    if (log) await db.from("sync_log").update({ status: "error", finished_at: new Date().toISOString(), imported_count: imported, error: msg }).eq("id", (log as { id: string }).id);
    return { ok: false, imported, newActivityIds, errors: [msg, ...errors] };
  }
}
