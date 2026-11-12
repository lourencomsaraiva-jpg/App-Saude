/**
 * Arredondamentos e somas.
 * Regra: guardar com 1 casa decimal e somar a partir dos valores guardados.
 * Nunca somar valores já formatados para apresentação.
 */

/** Arredonda a 1 casa decimal (o formato em que os valores são guardados). */
export function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

/** Soma valores guardados (1 casa decimal) e limpa o ruído de vírgula flutuante. */
export function sum(values: Array<number | null | undefined>): number {
  let total = 0;
  for (const v of values) if (typeof v === "number" && Number.isFinite(v)) total += v;
  return round1(total);
}

/** Como `sum`, mas devolve null se todos os valores forem desconhecidos (null). */
export function sumNullable(values: Array<number | null | undefined>): number | null {
  const known = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (known.length === 0) return null;
  return sum(known);
}

export function mean(values: Array<number | null | undefined>): number | null {
  const known = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (known.length === 0) return null;
  return round1(known.reduce((a, b) => a + b, 0) / known.length);
}

/** Converte texto com vírgula ou ponto decimal ("3,6" / "3.6") em número. */
export function parseDecimal(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  const m = input.trim().replace(",", ".").match(/^-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Interpreta um multiplicador: "3/5", "0,6", "1.5". */
export function parseMultiplier(input: string): number | null {
  const t = input.trim().replace(",", ".");
  const frac = t.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) {
    const d = Number(frac[2]);
    return d === 0 ? null : Number(frac[1]) / d;
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Formata para apresentação em pt-PT (vírgula decimal). Só para mostrar. */
export function fmt(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-PT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
