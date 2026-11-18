"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { requestSync } from "@/lib/sync/client";

/**
 * Sincroniza ao abrir a app, em segundo plano (no máximo uma vez a cada 20 min, controlado no servidor).
 * Também ouve o service worker: a app abre com a última versão guardada e atualiza quando chega a nova.
 */
export function AutoSync() {
  const router = useRouter();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "sw-refresh") router.refresh();
      else if (e.data?.type === "sw-reload") location.reload();
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    navigator.serviceWorker.controller?.postMessage({ type: "sw-check" });
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [router]);
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
