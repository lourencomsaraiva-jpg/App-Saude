"use client";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { addFood, addItems, addRecipe, copyMeal, estimatePhoto, estimateText, listMealsOn } from "@/app/(app)/actions";
import { addDays } from "@/lib/calc/dates";
import { fmt } from "@/lib/calc/numbers";
import { recipeTotals } from "@/lib/calc/nutrition";
import { MEAL_LABELS, type FoodRow, type RecipeRow } from "@/lib/types";
import { EstimateTable, type EditableItem } from "./estimate-table";
import { MealSummary } from "./meal-summary";
import type { MealSaved } from "@/app/(app)/actions";

type Tab = "favoritos" | "foto" | "texto" | "manual" | "igual" | "receitas";
const TABS: Array<[Tab, string]> = [
  ["favoritos", "Favoritos"],
  ["foto", "Foto"],
  ["texto", "Texto"],
  ["manual", "Manual"],
  ["igual", "Igual a…"],
  ["receitas", "Receitas"],
];

function defaultLabel() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 10.5) return "pequeno-almoço";
  if (h < 15) return "almoço";
  if (h < 18.5) return "lanche";
  if (h < 22.5) return "jantar";
  return "extra";
}

/** Reduz a foto no telemóvel (máx. 1280 px, JPEG) antes de enviar. */
async function resizeImage(file: File, max = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function QuickAdd({ date, foods, recipes }: { date: string; foods: FoodRow[]; recipes: RecipeRow[] }) {
  const [tab, setTab] = useState<Tab>("favoritos");
  const [label, setLabel] = useState<string>(defaultLabel);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saved, setSaved] = useState<MealSaved | null>(null);
  const [estimate, setEstimate] = useState<{ items: EditableItem[]; comment: string; source: "ai_text" | "ai_photo" | "manual"; photoPath: string | null } | null>(null);
  const [text, setText] = useState("");
  const [hint, setHint] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mult, setMult] = useState("1");
  const [copyDate, setCopyDate] = useState(addDays(date, -1));
  const [copyMeals, setCopyMeals] = useState<Awaited<ReturnType<typeof listMealsOn>> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const favMeals = recipes.filter((r) => r.kind === "favorite_meal");
  const realRecipes = recipes.filter((r) => r.kind === "recipe");
  const shownFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? foods.filter((f) => f.name.toLowerCase().includes(q)) : foods.filter((f) => f.is_favorite);
  }, [foods, search]);

  const manual = (description = "") =>
    setEstimate({
      items: [{ description, quantity: null, unit: "g", kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, weight_confirmed: true }],
      comment: "Preenche os valores do rótulo ou da tua tabela. As kcal são verificadas contra 4×P + 4×H + 9×G.",
      source: "manual",
      photoPath: null,
    });

  const run = (fn: () => Promise<{ ok: boolean; message?: string; data?: MealSaved }>, okText?: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? okText ?? "Adicionado." } : { ok: false, text: r.message ?? "Erro." });
      if (r.ok && r.data) setSaved(r.data);
      if (r.ok) setTimeout(() => setMsg(null), 3000);
    });

  const onPhoto = async (file: File) => {
    setMsg(null);
    const dataUrl = await resizeImage(file);
    setPreview(dataUrl);
    start(async () => {
      const r = await estimatePhoto(dataUrl, hint);
      if (r.ok && r.data) setEstimate({ items: r.data.items, comment: r.data.comment, source: "ai_photo", photoPath: r.data.photoPath });
      else setMsg({ ok: false, text: r.ok ? "Sem resultado." : r.message });
    });
  };

  const aiFailed = msg && !msg.ok && (tab === "texto" || tab === "foto");

  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Adicionar comida</h2>
        <select value={label} onChange={(e) => setLabel(e.target.value)} className="!w-auto !py-1 text-sm" aria-label="Refeição">
          {MEAL_LABELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>
      <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto pb-1">
        {TABS.map(([t, txt]) => (
          <button key={t} type="button" onClick={() => { setTab(t); setMsg(null); if (t === "manual") manual(); else setEstimate(null); }} className={`btn btn-sm shrink-0 ${tab === t ? "" : "btn-ghost"}`}>
            {txt}
          </button>
        ))}
      </div>

      {estimate ? (
        <div>
          {preview && estimate.source === "ai_photo" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Foto da refeição" className="mb-3 max-h-48 w-full rounded-lg object-cover" />
          )}
          <EstimateTable
            items={estimate.items}
            comment={estimate.comment}
            saving={pending}
            onCancel={() => { setEstimate(null); setPreview(null); }}
            onSave={(items) =>
              start(async () => {
                const r = await addItems(date, label, items, estimate.source, estimate.photoPath);
                if (r.ok) { setEstimate(null); setText(""); setPreview(null); setHint(""); setMsg({ ok: true, text: r.message ?? "Gravado." }); if (r.data) setSaved(r.data); }
                else setMsg({ ok: false, text: r.message });
              })
            }
          />
        </div>
      ) : tab === "favoritos" ? (
        <div className="space-y-3">
          {favMeals.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {favMeals.map((r) => {
                const t = recipeTotals(r.recipe_items ?? [], 1).total;
                return (
                  <button key={r.id} type="button" disabled={pending} className="rounded-lg border border-line bg-soft p-3 text-left active:scale-[.99]" onClick={() => run(() => addRecipe(date, label, r.id, "1"), `${r.name} adicionado.`)}>
                    <div className="text-sm font-semibold">{r.name}</div>
                    <div className="num text-xs text-muted">{fmt(t.kcal)} kcal · P {fmt(t.protein_g, 1)} · H {fmt(t.carbs_g, 1)} · G {fmt(t.fat_g, 1)}</div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <input placeholder="Procurar alimento…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
            <input value={mult} onChange={(e) => setMult(e.target.value)} className="num !w-20 text-center" aria-label="Doses" title="Doses (1, 0,5, 3/5)" />
          </div>
          <div className="flex flex-wrap gap-2">
            {shownFoods.map((f) => (
              <button key={f.id} type="button" disabled={pending} onClick={() => run(() => addFood(date, label, f.id, mult), `${f.name} adicionado.`)} className="rounded-full border border-line px-3 py-1.5 text-left text-sm active:bg-soft">
                {f.name} <span className="num text-xs text-muted">{f.serving} · {fmt(Number(f.kcal))}</span>
              </button>
            ))}
            {shownFoods.length === 0 && <p className="text-sm text-muted">Nenhum alimento. <Link href="/comida" className="text-accent">Criar</Link></p>}
          </div>
        </div>
      ) : tab === "foto" ? (
        <div className="space-y-2">
          <input placeholder="Indicação opcional (ex.: arroz ~200 g)" value={hint} onChange={(e) => setHint(e.target.value)} />
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = ""; }} />
          <button type="button" className="btn w-full" disabled={pending} onClick={() => fileRef.current?.click()}>
            {pending ? "A analisar a foto…" : "Tirar / escolher foto"}
          </button>
          {preview && pending && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="max-h-48 w-full rounded-lg object-cover opacity-70" />
          )}
          <p className="text-xs text-muted">A estimativa aparece numa tabela para confirmares ou corrigires os pesos antes de gravar.</p>
        </div>
      ) : tab === "texto" ? (
        <div className="space-y-2">
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="arroz 200 g, frango 100 g, sopa" />
          <button type="button" className="btn w-full" disabled={pending || !text.trim()} onClick={() => start(async () => {
            const r = await estimateText(text);
            if (r.ok && r.data) setEstimate({ items: r.data.items, comment: r.data.comment, source: "ai_text", photoPath: null });
            else setMsg({ ok: false, text: r.ok ? "Sem resultado." : r.message });
          })}>
            {pending ? "A estimar…" : "Estimar"}
          </button>
        </div>
      ) : tab === "manual" ? (
        <button type="button" className="btn w-full" onClick={() => manual()}>+ Adicionar alimento à mão</button>
      ) : tab === "igual" ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input type="date" value={copyDate} onChange={(e) => { setCopyDate(e.target.value); setCopyMeals(null); }} className="flex-1" />
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => start(async () => setCopyMeals(await listMealsOn(copyDate)))}>Ver</button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-muted">Multiplicador</span>
            <input value={mult} onChange={(e) => setMult(e.target.value)} className="num !w-24" placeholder="1, 0,5, 3/5" />
          </label>
          {copyMeals?.length === 0 && <p className="text-sm text-muted">Sem refeições nesse dia.</p>}
          {copyMeals?.map((m) => (
            <button key={m.id} type="button" disabled={pending} onClick={() => run(() => copyMeal(m.id, date, label, mult), "Refeição copiada.")} className="block w-full rounded-lg border border-line p-2 text-left text-sm">
              <span className="font-semibold capitalize">{m.label}</span>{" "}
              <span className="num text-muted">· {fmt(m.meal_items.reduce((s, i) => s + Number(i.kcal), 0))} kcal</span>
              <div className="truncate text-xs text-muted">{m.meal_items.map((i) => i.description).join(", ")}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-muted">Porções</span>
            <input value={mult} onChange={(e) => setMult(e.target.value)} className="num !w-24" />
          </label>
          {realRecipes.map((r) => {
            const { perPortion } = recipeTotals(r.recipe_items ?? [], Number(r.portions));
            return (
              <button key={r.id} type="button" disabled={pending} onClick={() => run(() => addRecipe(date, label, r.id, mult), `${r.name} adicionado.`)} className="block w-full rounded-lg border border-line p-2 text-left text-sm">
                <span className="font-semibold">{r.name}</span> <span className="num text-xs text-muted">· {fmt(perPortion.kcal)} kcal/porção ({fmt(Number(r.portions))} porções)</span>
              </button>
            );
          })}
          <Link href="/comida#receitas" className="text-sm text-accent">Gerir receitas e favoritos →</Link>
        </div>
      )}
      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
      {saved && <MealSummary s={saved} onClose={() => setSaved(null)} />}
      {aiFailed && !estimate && (
        <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => { setMsg(null); manual(tab === "texto" ? text : hint); }}>
          Introduzir à mão
        </button>
      )}
    </section>
  );
}
