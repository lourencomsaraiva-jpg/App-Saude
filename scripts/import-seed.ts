/**
 * Importa data/seed_entries.json para o Supabase e verifica que os totais coincidem com o ficheiro.
 *
 *   npm run import-seed -- data/seed_entries.json
 *
 * Precisa de .env.local com NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e ALLOWED_EMAIL,
 * e de teres feito login na app pelo menos uma vez (para existir o utilizador e o perfil).
 * Alternativa sem terminal: Definições → Importar histórico.
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { ensureSetup } from "../lib/data/setup";
import { importSeed, type SeedEntry } from "../lib/import/seed";
import { verifyImport } from "../lib/import/verify-db";

config({ path: ".env.local" });

async function main() {
  const file = process.argv[2] ?? "data/seed_entries.json";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.ALLOWED_EMAIL?.toLowerCase();
  if (!url || !key || !email) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou ALLOWED_EMAIL em .env.local");
  const db = createClient(url, key, { auth: { persistSession: false } });

  let userId: string | undefined;
  for (let page = 1; !userId; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (data.users.length < 200) break;
  }
  if (!userId) throw new Error("Utilizador não encontrado. Faz login na app uma vez com o email autorizado.");

  await ensureSetup(db, userId);
  const entries = JSON.parse(readFileSync(file, "utf8")) as SeedEntry[];
  const r = await importSeed(db, userId, entries);
  console.log(`Importado: ${r.days} dias, ${r.sleep} noites, ${r.activities} atividades.`);
  if (r.sleepInvalid.length) console.warn(`Sono com fases que não somam o total: ${r.sleepInvalid.join(", ")}`);
  r.warnings.forEach((w) => console.warn(w));

  const mismatches = await verifyImport(db, entries, userId);
  if (mismatches.length) {
    console.error(`${mismatches.length} diferenças face ao ficheiro:`);
    console.table(mismatches.slice(0, 30));
    process.exit(1);
  }
  console.log("Verificação: totais, exercício, saldos, peso e sono coincidem com o ficheiro.");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
