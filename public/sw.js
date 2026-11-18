// Service worker: abertura instantânea, leitura offline e cache de ficheiros estáticos.
// Páginas da app: mostra logo a última versão guardada (até 12 h) e vai buscar a nova em segundo plano;
// quando chega, avisa a página para atualizar os dados. Nunca guarda respostas de API nem pedidos que não sejam GET.
const VERSION = "v2";
const MAX_AGE_MS = 12 * 3600 * 1000;
const NO_CACHE_FIRST = ["/login", "/entrar", "/auth", "/offline"];
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(["/offline"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
// a página pergunta, depois de carregar, se foi servida da cache; responde quando a versão nova chegar
const pending = new Map();
self.addEventListener("message", (e) => {
  if (e.data?.type !== "sw-check" || !e.source) return;
  const p = pending.get(e.source.id);
  if (!p) return;
  pending.delete(e.source.id);
  p.then((t) => t && e.source.postMessage({ type: t }));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(caches.open(STATIC).then(async (c) => (await c.match(req)) || fetch(req).then((r) => (c.put(req, r.clone()), r))));
    return;
  }
  if (req.mode === "navigate") {
    const cacheFirst = !NO_CACHE_FIRST.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"));
    const fresh = fetch(req).then(async (r) => {
      if (r.ok && !r.redirected) {
        const body = await r.clone().blob();
        const headers = new Headers(r.headers);
        headers.set("sw-fetched-at", String(Date.now()));
        await caches.open(PAGES).then((c) => c.put(req, new Response(body, { status: r.status, statusText: r.statusText, headers })));
      }
      return r;
    });
    e.respondWith(
      (async () => {
        const cached = cacheFirst ? await caches.match(req) : null;
        const age = cached ? Date.now() - Number(cached.headers.get("sw-fetched-at") || 0) : Infinity;
        if (cached && age < MAX_AGE_MS) {
          // mostra já a versão guardada; quando a nova chegar, a página atualiza os dados (ou recarrega, se a sessão expirou)
          const outcome = fresh.then((r) => (r.redirected ? "sw-reload" : "sw-refresh")).catch(() => null);
          if (e.resultingClientId) pending.set(e.resultingClientId, outcome);
          e.waitUntil(outcome);
          return cached;
        }
        try {
          return await fresh;
        } catch {
          return (await caches.match(req)) || (await caches.match("/offline"));
        }
      })(),
    );
  }
});
