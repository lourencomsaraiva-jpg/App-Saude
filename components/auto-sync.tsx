"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncNow } from "@/app/(app)/actions";

/** Sincroniza ao abrir a app (no máximo uma vez a cada 20 min, controlado no servidor). */
export function AutoSync() {
  const router = useRouter();
  useEffect(() => {
    let key = "auto-sync";
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      key = "";
    }
    syncNow("open")
      .then((r) => {
        if (r.ok && r.data && r.data.imported > 0) router.refresh();
      })
      .catch(() => {});
  }, [router]);
  return null;
}
