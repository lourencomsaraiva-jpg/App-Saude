"use client";
import { useState, useTransition } from "react";
import { deleteFood, deleteRecipe, saveFood, saveRecipe, toggleFavoriteFood, type ItemInput } from "../actions";
import { fmt, parseDecimal, parseMultiplier } from "@/lib/calc/numbers";
import { recipeTotals, scaleNutrients } from "@/lib/calc/nutrition";
import { MEAL_LABELS, type FoodRow, type RecipeRow } from "@/lib/types";

export function FoodList({ foods }: { foods: FoodRow[] }) {
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState<FoodRow | "new" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const f = edit && edit !== "new" ? edit : null;
  return (
    <div>
      <ul className="divide-y divide-line">
        {foods.map((x) => (
          <li key={x.id} className="flex items-center gap-2 py-2 text-sm">
            <button aria-label="Favorito" className={x.is_favorite ? "text-warn" : "text-muted"} onClick={() => start(async () => { await toggleFavoriteFood(x.id, !x.is_favorite); })}>{x.is_favorite ? "★" : "☆"}</button>
            <button className="min-w-0 flex-1 text-left" onClick={() => setEdit(x)}>
              <div className="truncate">{x.name} <span className="text-xs text-muted">({x.serving})</span></div>
              <div className="num text-xs text-muted">{fmt(Number(x.kcal), 1)} kcal · P {fmt(Number(x.protein_g), 1)} · H {fmt(Number(x.carbs_g), 1)} · G {fmt(Number(x.fat_g), 1)} · F {fmt(Number(x.fiber_g), 1)}</div>
            </button>
          </li>
        ))}
      </ul>
      <button className="btn btn-ghost btn-sm mt-2" onClick={() => setEdit("new")}>+ Alimento</button>
      {edit && (
        <form
          key={f?.id ?? "new"}
          className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-soft p-2"
          onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { const r = await saveFood(fd); if (r.ok) setEdit(null); else setErr(r.message); }); }}
        >
          {f && <input type="hidden" name="id" value={f.id} />}
          <label className="col-span-2"><span className="label">Nome</span><input name="name" defaultValue={f?.name} required /></label>
          <label><span className="label">Dose</span><input name="serving" defaultValue={f?.serving ?? "100 g"} /></label>
          <label><span className="label">Gramas da dose</span><input name="serving_g" inputMode="decimal" defaultValue={f?.serving_g ?? ""} /></label>
          {(["kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"] as const).map((k, i) => (
            <label key={k}><span className="label">{["kcal", "Proteína g", "Hidratos g", "Gordura g", "Fibra g"][i]}</span><input name={k} inputMode="decimal" defaultValue={f ? Number(f[k]) : ""} /></label>
          ))}
          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="is_favorite" defaultChecked={f?.is_favorite} /> Favorito</label>
          <button className="btn btn-sm" disabled={pending}>Guardar</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancelar</button>
          {f && <button type="button" className="btn btn-danger btn-sm col-span-2" onClick={() => confirm("Apagar alimento?") && start(async () => { await deleteFood(f.id); setEdit(null); })}>Apagar</button>}
          {err && <p className="col-span-2 text-xs text-bad">{err}</p>}
        </form>
      )}
    </div>
  );
}

export function RecipeList({ recipes }: { recipes: RecipeRow[] }) {
  const [pending, start] = useTransition();
  return (
    <ul className="divide-y divide-line">
      {recipes.map((r) => {
        const { total, perPortion } = recipeTotals(r.recipe_items ?? [], Number(r.portions));
        return (
          <li key={r.id} className={`py-2 text-sm ${pending ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{r.name} <span className="chip">{r.kind === "recipe" ? `receita · ${fmt(Number(r.portions))} porções` : `favorito${r.default_label ? ` · ${r.default_label}` : ""}`}</span></div>
                <div className="num text-xs text-muted">
                  Total {fmt(total.kcal)} kcal · P {fmt(total.protein_g, 1)} · H {fmt(total.carbs_g, 1)} · G {fmt(total.fat_g, 1)} · F {fmt(total.fiber_g, 1)}
                  {r.kind === "recipe" && <> · <b>por porção {fmt(perPortion.kcal)} kcal · P {fmt(perPortion.protein_g, 1)} · H {fmt(perPortion.carbs_g, 1)} · G {fmt(perPortion.fat_g, 1)}</b></>}
                </div>
                <div className="text-xs text-muted">{(r.recipe_items ?? []).map((i) => i.description).join(" · ")}</div>
              </div>
              <button className="text-xs text-bad" onClick={() => confirm(`Apagar ${r.name}?`) && start(async () => { await deleteRecipe(r.id); })}>Apagar</button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type Row = ItemInput;
const empty = (): Row => ({ description: "", quantity: null, unit: "g", kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, weight_confirmed: true });

export function RecipeEditor({ foods }: { foods: FoodRow[] }) {
  const [kind, setKind] = useState<"recipe" | "favorite_meal">("recipe");
  const [name, setName] = useState("");
  const [portions, setPortions] = useState("12");
  const [label, setLabel] = useState("pequeno-almoço");
  const [rows, setRows] = useState<Row[]>([]);
  const [pick, setPick] = useState("");
  const [mult, setMult] = useState("1");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { total, perPortion } = recipeTotals(rows, kind === "recipe" ? Number(portions) || 1 : 1);

  const addFood = () => {
    const f = foods.find((x) => x.id === pick);
    const m = parseMultiplier(mult);
    if (!f || !m) return;
    const s = scaleNutrients({ kcal: Number(f.kcal), protein_g: Number(f.protein_g), carbs_g: Number(f.carbs_g), fat_g: Number(f.fat_g), fiber_g: Number(f.fiber_g) }, m);
    setRows((r) => [...r, { description: `${f.name} (${m} × ${f.serving})`, quantity: m, unit: `× ${f.serving}`, ...s, kcal: s.kcal ?? 0, weight_confirmed: false, food_id: f.id }]);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button className={`btn btn-sm ${kind === "recipe" ? "" : "btn-ghost"}`} onClick={() => setKind("recipe")}>Receita (porções)</button>
        <button className={`btn btn-sm ${kind === "favorite_meal" ? "" : "btn-ghost"}`} onClick={() => setKind("favorite_meal")}>Refeição favorita</button>
      </div>
      <input placeholder={kind === "recipe" ? "Ex.: Trança de pão de leite" : "Ex.: Pequeno-almoço de treino"} value={name} onChange={(e) => setName(e.target.value)} />
      {kind === "recipe" ? (
        <label className="flex items-center gap-2 text-sm"><span className="text-muted">N.º de porções</span><input className="num !w-20" value={portions} onChange={(e) => setPortions(e.target.value)} /></label>
      ) : (
        <select value={label} onChange={(e) => setLabel(e.target.value)}>{MEAL_LABELS.map((l) => <option key={l}>{l}</option>)}</select>
      )}
      <div className="flex gap-2">
        <select value={pick} onChange={(e) => setPick(e.target.value)} className="flex-1"><option value="">Alimento da lista…</option>{foods.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.serving})</option>)}</select>
        <input className="num !w-16" value={mult} onChange={(e) => setMult(e.target.value)} aria-label="Doses" />
        <button className="btn btn-ghost btn-sm" onClick={addFood}>+</button>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-6 gap-1 text-xs">
          <input className="col-span-6 !py-1" value={r.description} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)))} placeholder="Ingrediente (ex.: farinha 500 g)" />
          {(["kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"] as const).map((k) => (
            <input key={k} className="num !px-1 !py-1 text-center" inputMode="decimal" value={r[k] ?? ""} placeholder={k === "kcal" ? "kcal" : k[0].toUpperCase()} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, [k]: parseDecimal(e.target.value) ?? 0 } : y)))} />
          ))}
          <button className="text-bad" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => setRows((r) => [...r, empty()])}>+ Ingrediente manual</button>
      <p className="num text-xs text-muted">
        Total {fmt(total.kcal)} kcal · P {fmt(total.protein_g, 1)} · H {fmt(total.carbs_g, 1)} · G {fmt(total.fat_g, 1)} · F {fmt(total.fiber_g, 1)}
        {kind === "recipe" && <> · por porção <b>{fmt(perPortion.kcal)} kcal</b></>}
      </p>
      <button className="btn w-full" disabled={pending} onClick={() => start(async () => {
        const r = await saveRecipe({ name, kind, portions: kind === "recipe" ? Number(String(portions).replace(",", ".")) || 1 : 1, default_label: kind === "favorite_meal" ? label : null, items: rows });
        setMsg(r.ok ? { ok: true, text: "Guardado." } : { ok: false, text: r.message });
        if (r.ok) { setRows([]); setName(""); }
      })}>Guardar</button>
      {msg && <p className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
    </div>
  );
}
