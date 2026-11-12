"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { requestSync } from "@/lib/sync/client";

/** Sincroniza ao abrir a app, em segundo plano (no máximo uma vez a cada 20 min, controlado no servidor). */
export function AutoSync() {
  const router = useRouter();
  useEffect(() => {
    try {
      if (sessionStorage.getItem("auto-sync")) return;
      sessionStorage.setItem("auto-sync", "1");
    } catch {}
    requestSync("open").then((r) => {
      if (r.ok && r.imported > 0) router.refresh();
    });
  }, [router]);
  return null;
}
