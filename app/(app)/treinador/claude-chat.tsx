"use client";
import { useState } from "react";
import { ClaudeLink, isClaudeChatUrl, openClaude, setChatUrl, useChatUrl } from "@/components/claude/claude-link";

/**
 * Treinador = o teu chat do Claude (claude.ai). Sem conversa fixa abre uma conversa nova já com a pergunta;
 * com conversa fixa copia a pergunta e abre essa conversa (colar e enviar).
 * O conector "Treino & Nutrição" dá ao Claude acesso aos teus dados reais.
 */
const PROMPTS: Array<[string, string]> = [
  ["Quanto me falta comer hoje?", "Usa o conector Treino & Nutrição. Quanto me falta comer hoje? Mostra a tabela com o total comido hoje e a linha Falta com os alvos."],
  ["Analisa o treino de hoje", "Usa o conector Treino & Nutrição. Analisa o meu treino de hoje: compara com o plano (ritmo, FC, distância), parciais por km e custo cardíaco, e diz o que correu bem e mal."],
  ["Revisão da semana", "Usa o conector Treino & Nutrição. Faz a revisão desta semana: cumprimento do plano, volume, sono médio, peso médio e Δ, nutrição (kcal médias vs alvo, dias com proteína no alvo, fibra). Propõe ajustes para a próxima semana, mas não alteres nada sem eu concordar."],
  ["Projeção para a meia", "Usa o conector Treino & Nutrição. Faz a projeção para a Meia Maratona dos Descobrimentos (21,1 km): intervalo de tempo, ritmo por km, pressupostos e comparação com o objetivo de 1:30."],
  ["Estou a recuperar bem?", "Usa o conector Treino & Nutrição. Olha para o sono, FC de repouso, VFC e carga das últimas 2 semanas: estou a recuperar bem? Saúde primeiro."],
  ["Treino de amanhã", "Usa o conector Treino & Nutrição. Qual é o meu treino de amanhã e como o devo fazer (ritmos, FC, estrutura)?"],
];

function ChatSetting() {
  const chat = useChatUrl();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const valid = isClaudeChatUrl(draft);

  if (chat && !editing) {
    return (
      <div className="rounded-lg border border-line bg-soft p-3 text-xs">
        <p><b>Conversa fixa ativa.</b> Ao tocar num botão, a pergunta fica copiada e abre a tua conversa: toca no campo de mensagem, <b>Colar</b> e envia.</p>
        <div className="mt-2 flex gap-2">
          <a href={chat} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Abrir conversa ↗</a>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDraft(chat); setEditing(true); }}>Mudar</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setChatUrl("")}>Usar conversas novas</button>
        </div>
      </div>
    );
  }
  return (
    <form
      className="space-y-2 rounded-lg border border-line bg-soft p-3 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        setChatUrl(draft.trim());
        setEditing(false);
      }}
    >
      <p>
        <b>Usar sempre a mesma conversa?</b> Abre-a em claude.ai no navegador, copia o endereço da barra
        (começa por <code>https://claude.ai/chat/</code>; não uses o link de &quot;Partilhar&quot;) e cola aqui. Fica guardado neste telemóvel.
      </p>
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="https://claude.ai/chat/…" className="flex-1" inputMode="url" />
        <button className="btn btn-sm" disabled={!valid}>Guardar</button>
      </div>
      {draft && !valid && <p className="text-muted">Tem de ser um link https://claude.ai/chat/… ou https://claude.ai/project/…</p>}
    </form>
  );
}

export function ClaudeCoach() {
  const [text, setText] = useState("");
  const chat = useChatUrl();
  return (
    <section className="card space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Falar com o teu Claude</h2>
        <p className="mt-0.5 text-xs text-muted">
          {chat ? "Abre a tua conversa fixa com a pergunta copiada." : "Abre uma conversa nova no Claude já com a pergunta."} Confirma que o conector <b>Treino &amp; Nutrição</b> está ativo.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PROMPTS.map(([label, q]) => (
          <ClaudeLink key={label} prompt={q} className="rounded-lg border border-line bg-soft p-3 text-sm font-medium active:scale-[.99]">
            {label} <span className="text-muted">↗</span>
          </ClaudeLink>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) openClaude(`Usa o conector Treino & Nutrição. ${text.trim()}`);
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Outra pergunta ao treinador…" className="flex-1" />
        <button className="btn" disabled={!text.trim()}>Perguntar</button>
      </form>
      <ChatSetting />
    </section>
  );
}
