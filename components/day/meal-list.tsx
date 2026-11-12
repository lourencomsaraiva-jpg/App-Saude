"use client";
import { useState, useTransition } from "react";
import { deleteItem, deleteMeal, mealToFavorite, moveMeal, rescaleItem, updateItem } from "@/app/(app)/actions";
import { fmt, parseDecimal } from "@/lib/calc/numbers";
import { sumNutrients } from "@/lib/calc/nutrition";
import { MEAL_LABELS, type MealItemRow, type MealRow } from "@/lib/types";

const ORDER = ["pequeno-almoço", "almoço", "lanche", "jantar", "extra", "histórico"];

export function MealList({ meals }: { date: string; meals: Array<MealRow & { photo_url: string | null }> }) {
  const sorted = [...meals].sort((a, b) => ORDER.indexOf(a.label) - ORDER.indexOf(b.label) || (a.eaten_at ?? "").localeCompare(b.eaten_at ?? ""));
  if (sorted.length === 0) return null;
  return (
    <div className="space-y-3">
      {sorted.map((m) => (
        <Meal key={m.id} meal={m} />
      ))}
    </div>
  );
}

function Meal({ meal }: { meal: MealRow & { photo_url: string | null } }) {
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState(false);
  const items = [...(meal.meal_items ?? [])].sort((a, b) => a.position - b.position);
  const t = sumNutrients(items.map((i) => ({ ...i, kcal: Number(i.kcal) })));
  return (
    <section className={`card ${pending ? "opacity-60" : ""}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold capitalize">{meal.label}{meal.eaten_at ? <span className="font-normal text-muted"> · {meal.eaten_at.slice(0, 5)}</span> : null}</h3>
          <p className="num text-xs text-muted">
            {fmt(t.kcal)} kcal · P {fmt(t.protein_g, 1)} · H {fmt(t.carbs_g, 1)} · G {fmt(t.fat_g, 1)} · F {fmt(t.fiber_g, 1)}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setMenu((v) => !v)} aria-label="Opções da refeição">⋯</button>
      </div>
      {menu && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-soft p-2 text-sm">
          <select defaultValue={meal.label} onChange={(e) => start(async () => { await moveMeal(meal.id, e.target.value); })} className="!w-auto !py-1">
            {MEAL_LABELS.map((l) => <option key={l}>{l}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => { const name = prompt("Nome do favorito:"); if (name) start(async () => { const r = await mealToFavorite(meal.id, name); alert(r.ok ? r.message : r.message); }); }}>Guardar como favorito</button>
          <button className="btn btn-danger btn-sm" onClick={() => confirm("Apagar a refeição inteira?") && start(async () => { await deleteMeal(meal.id); })}>Apagar refeição</button>
        </div>
      )}
      {meal.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={meal.photo_url} alt="" className="mb-2 max-h-40 w-full rounded-lg object-cover" />
      )}
      <ul className="divide-y divide-line">
        {items.map((i) => <Item key={i.id} item={i} />)}
      </ul>
      {meal.notes && meal.label === "histórico" && <p className="mt-2 text-xs text-muted">Totais importados do histórico (o detalhe está nas notas do dia).</p>}
    </section>
  );
}

function Item({ item }: { item: MealItemRow }) {
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  if (edit) {
    return (
      <li className="py-2">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const val = (k: string) => (f.get(k) === "" ? null : parseDecimal(String(f.get(k))));
            start(async () => {
              const newQty = String(f.get("quantity") ?? "");
              let r;
              if (f.get("rescale") === "on" && newQty && item.quantity && parseDecimal(newQty) !== Number(item.quantity)) r = await rescaleItem(item.id, newQty);
              else
                r = await updateItem(item.id, {
                  description: String(f.get("description")),
                  quantity: val("quantity"),
                  kcal: val("kcal") ?? 0,
                  protein_g: val("protein_g"),
                  carbs_g: val("carbs_g"),
                  fat_g: val("fat_g"),
                  fiber_g: val("fiber_g"),
                  weight_confirmed: f.get("weight_confirmed") === "on",
                });
              if (r.ok) setEdit(false);
              else setErr(r.message);
            });
          }}
        >
          <input name="description" defaultValue={item.description} />
          <div className="flex items-center gap-2 text-xs">
            <input name="quantity" inputMode="decimal" defaultValue={item.quantity ?? ""} className="num !w-24" />
            <span className="text-muted">{item.unit}</span>
            <label className="flex items-center gap-1"><input type="checkbox" name="rescale" defaultChecked /> reescalar valores</label>
            <label className="flex items-center gap-1"><input type="checkbox" name="weight_confirmed" defaultChecked={item.weight_confirmed} /> confirmado</label>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {(["kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"] as const).map((k, idx) => (
              <label key={k} className="text-center">
                <span className="label">{["kcal", "P", "H", "G", "F"][idx]}</span>
                <input name={k} inputMode="decimal" defaultValue={item[k] ?? ""} className="num !px-1 !py-1 text-center text-sm" />
              </label>
            ))}
          </div>
          {err && <p className="text-xs text-bad">{err}</p>}
          <div className="flex gap-2">
            <button className="btn btn-sm" disabled={pending}>Guardar</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(false)}>Cancelar</button>
            <button type="button" className="btn btn-danger btn-sm ml-auto" onClick={() => start(async () => { await deleteItem(item.id); })}>Apagar</button>
          </div>
        </form>
      </li>
    );
  }
  return (
    <li className={`flex cursor-pointer items-start justify-between gap-2 py-2 ${pending ? "opacity-50" : ""}`} onClick={() => setEdit(true)}>
      <div className="min-w-0">
        <div className="text-sm">{item.description}</div>
        <div className="mt-0.5 flex flex-wrap gap-1">
          {item.quantity !== null && <span className="num text-xs text-muted">{fmt(Number(item.quantity), 1)} {item.unit}</span>}
          <span className={`chip ${item.weight_confirmed ? "" : "text-warn"}`}>{item.weight_confirmed ? "confirmado" : "assumido"}</span>
          {item.needs_review && <span className="chip text-bad">a rever</span>}
        </div>
      </div>
      <div className="num shrink-0 text-right text-xs">
        <div className="text-sm font-semibold">{fmt(Number(item.kcal))}</div>
        <div className="text-muted">P {fmt(item.protein_g, 1)} · H {fmt(item.carbs_g, 1)} · G {fmt(item.fat_g, 1)}</div>
      </div>
    </li>
  );
}
