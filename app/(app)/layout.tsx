import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ensureSetup } from "@/lib/data/setup";
import { AutoSync } from "@/components/auto-sync";
import { BottomNav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  await ensureSetup(supabase, user.id);
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mb-3 flex items-center justify-end gap-3 text-xs text-muted">
        <Link href="/treinos" className="hover:text-fg">Treinos</Link>
        <Link href="/comida" className="hover:text-fg">Alimentos</Link>
        <Link href="/definicoes" className="hover:text-fg">Definições</Link>
      </div>
      {children}
      <AutoSync />
      <BottomNav />
    </div>
  );
}
