"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { clearCoachChat, decideReview, runRaceProjection, runWeeklyReview, sendCoachMessage } from "../actions";
import { MarkdownClient } from "@/components/markdown-client";

type Msg = { id: string; role: "user" | "assistant"; content: string };
const SUGGESTIONS = ["Como correu o treino de hoje?", "Quanto me falta comer hoje?", "Estou a recuperar bem esta semana?", "Que ritmo devo fazer na meia?"];

export function Chat({ initial }: { initial: Msg[] }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [msgs.length, pending]);

  const send = (t: string) => {
    if (!t.trim()) return;
    setMsgs((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content: t }]);
    setText("");
    setErr(null);
    start(async () => {
      const r = await sendCoachMessage(t);
      if (r.ok) setMsgs((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: r.data ?? "" }]);
      else setErr(r.message);
    });
  };

  return (
    <section className="card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Conversa</h2>
        {msgs.length > 0 && <button className="text-xs text-muted" onClick={() => confirm("Apagar a conversa?") && start(async () => { await clearCoachChat(); setMsgs([]); })}>Limpar</button>}
      </div>
      <div className="max-h-[55vh] space-y-3 overflow-y-auto">
        {msgs.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => <button key={s} className="chip !text-xs !py-1" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={m.role === "user" ? "ml-8 rounded-xl bg-accent px-3 py-2 text-sm text-accent-fg" : "mr-2 rounded-xl bg-soft px-3 py-2"}>
            {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <MarkdownClient>{m.content}</MarkdownClient>}
          </div>
        ))}
        {pending && <p className="text-sm text-muted">A consultar os teus dados…</p>}
        {err && <p className="text-sm text-bad">{err}</p>}
        <div ref={end} />
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Pergunta ao treinador…" className="flex-1 resize-none" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
        <button className="btn" disabled={pending || !text.trim()}>Enviar</button>
      </form>
    </section>
  );
}

export function RunReview() {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      {err && <span className="text-xs text-bad">{err}</span>}
      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { const r = await runWeeklyReview(); setErr(r.ok ? null : r.message); })}>
        {pending ? "A rever a semana…" : "Gerar agora"}
      </button>
    </span>
  );
}

export function ReviewActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button className="btn btn-sm" disabled={pending} onClick={() => start(async () => { const r = await decideReview(id, true); setErr(r.ok ? null : r.message); })}>Aceitar e aplicar ao plano</button>
      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { const r = await decideReview(id, false); setErr(r.ok ? null : r.message); })}>Rejeitar</button>
      {err && <p className="w-full text-xs text-bad">{err}</p>}
    </div>
  );
}

export function Projection({ last }: { last: string | null }) {
  const [text, setText] = useState<string | null>(last);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (d: number) => start(async () => { const r = await runRaceProjection(d); if (r.ok) setText(r.data ?? ""); else setErr(r.message); });
  return (
    <div>
      <div className="flex gap-2">
        <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(21097)}>Meia maratona</button>
        <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(10000)}>10 km</button>
      </div>
      {pending && <p className="mt-2 text-sm text-muted">A calcular…</p>}
      {err && <p className="mt-2 text-sm text-bad">{err}</p>}
      {text && <div className="mt-3"><MarkdownClient>{text}</MarkdownClient></div>}
    </div>
  );
}
