import { requireUser } from "@/lib/auth";
import type { FoodRow, RecipeRow } from "@/lib/types";
import { PageHeader, Section } from "@/components/ui";
import { FoodList, RecipeEditor, RecipeList } from "./client";

export default async function ComidaPage() {
  const { supabase } = await requireUser();
  const [{ data: foods }, { data: recipes }] = await Promise.all([
    supabase.from("foods").select("*").order("name"),
    supabase.from("recipes").select("*, recipe_items(*)").order("name"),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title="Alimentos e receitas" subtitle="Valores por dose. ★ = aparece nos favoritos de um toque." />
      <Section title="Alimentos"><FoodList foods={(foods ?? []) as FoodRow[]} /></Section>
      <Section title="Receitas e refeições favoritas">
        <div id="receitas"><RecipeList recipes={(recipes ?? []) as RecipeRow[]} /></div>
      </Section>
      <Section title="Nova receita / favorito"><RecipeEditor foods={(foods ?? []) as FoodRow[]} /></Section>
    </div>
  );
}
