"use client";
import { useState } from "react";
import { checkKcalConsistency, sumNutrients } from "@/lib/calc/nutrition";
import { fmt, parseDecimal, round1 } from "@/lib/calc/numbers";

export interface EditableItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  weight_confirmed: boolean;
}

type Row = EditableItem & { base: EditableItem };
const KEYS = ["kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"] as const;
const HEAD = ["kcal", "P", "H", "G", "F"];

/** Tabela de confirmação das estimativas da IA: corrige pesos (reescala a linha) ou valores antes de gravar. */
export function EstimateTable({ items, comment, onSave, onCancel, saving }: { items: EditableItem[]; comment?: string; onSave: (items: EditableItem[]) => void; onCancel: () => void; saving?: boolean }) {
  const [rows, setRows] = useState<Row[]>(() => items.map((i) => ({ ...i, base: { ...i } })));
  const update = (idx: number, patch: Partial<EditableItem>) => setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const setQty = (idx: number, v: string) => {
    const q = parseDecimal(v);
    setRows((r) =>
      r.map((row, i) => {
        if (i !== idx) return row;
        if (q === null || !row.base.quantity) return { ...row, quantity: q };
        const f = q / row.base.quantity;
        const scaled = Object.fromEntries(KEYS.map((k) => [k, row.base[k] === null ? null : round1(Number(row.base[k]) * f)]));
        return { ...row, ...scaled, quantity: q, weight_confirmed: true };
      }),
    );
  };
  const total = sumNutrients(rows);

  return (
    <div className="space-y-3">
      {comment && <p className="text-xs text-muted">{comment}</p>}
      <div className="space-y-2">
        {rows.map((r, idx) => {
          const check = checkKcalConsistency(r);
          return (
            <div key={idx} className="rounded-lg border border-line p-2">
              <div className="flex items-center gap-2">
                <input value={r.description} onChange={(e) => update(idx, { description: e.target.value })} className="flex-1 !py-1 text-sm" aria-label="Alimento" />
                <button type="button" className="text-muted" onClick={() => setRows((x) => x.filter((_, i) => i !== idx))} aria-label="Remover">✕</button>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1">
                  <input inputMode="decimal" className="!w-20 !py-1 num" value={r.quantity ?? ""} onChange={(e) => setQty(idx, e.target.value)} aria-label="Quantidade" />
                  <span className="text-muted">{r.unit ?? ""}</span>
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={r.weight_confirmed} onChange={(e) => update(idx, { weight_confirmed: e.target.checked })} />
                  <span>{r.weight_confirmed ? "peso confirmado" : "peso assumido"}</span>
                </label>
                {!check.ok && <span className="chip text-warn">a rever (esperado ~{fmt(check.expectedKcal)} kcal)</span>}
              </div>
              <div className="mt-2 grid grid-cols-5 gap-1">
                {KEYS.map((k, i) => (
                  <label key={k} className="text-center">
                    <span className="label">{HEAD[i]}</span>
                    <input inputMode="decimal" className="num !px-1 !py-1 text-center text-sm" value={r[k] ?? ""} onChange={(e) => update(idx, { [k]: e.target.value === "" ? null : parseDecimal(e.target.value) } as Partial<EditableItem>)} />
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRows((r) => [...r, { description: "", quantity: null, unit: "g", kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, weight_confirmed: true, base: { description: "", quantity: null, unit: "g", kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, weight_confirmed: true } }])}>
        + Linha
      </button>
      <div className="num grid grid-cols-5 gap-1 rounded-lg bg-soft p-2 text-center text-sm font-semibold">
        <span>{fmt(total.kcal)}</span>
        <span>{fmt(total.protein_g, 1)}</span>
        <span>{fmt(total.carbs_g, 1)}</span>
        <span>{fmt(total.fat_g, 1)}</span>
        <span>{fmt(total.fiber_g, 1)}</span>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn flex-1" disabled={saving || rows.length === 0} onClick={() => onSave(rows.map(({ base: _b, ...r }) => (void _b, r)))}>
          {saving ? "A gravar…" : "Confirmar e gravar"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}
