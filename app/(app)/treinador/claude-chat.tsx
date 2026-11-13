"use client";
import { useState } from "react";

/**
 * Treinador = o teu chat do Claude (claude.ai). Abre uma conversa nova já com a pergunta escrita;
 * o conector "Treino & Nutrição" dá ao Claude acesso aos teus dados reais.
 */
const PROMPTS: Array<[string, string]> = [
  ["Quanto me falta comer hoje?", "Usa o conector Treino & Nutrição. Quanto me falta comer hoje? Mostra a tabela com o total comido hoje e a linha Falta com os alvos."],
  ["Analisa o treino de hoje", "Usa o conector Treino & Nutrição. Analisa o meu treino de hoje: compara com o plano (ritmo, FC, distância), parciais por km e custo cardíaco, e diz o que correu bem e mal."],
  ["Revisão da semana", "Usa o conector Treino & Nutrição. Faz a revisão desta semana: cumprimento do plano, volume, sono médio, peso médio e Δ, nutrição (kcal médias vs alvo, dias com proteína no alvo, fibra). Propõe ajustes para a próxima semana, mas não alteres nada sem eu concordar."],
  ["Projeção para a meia", "Usa o conector Treino & Nutrição. Faz a projeção para a Meia Maratona dos Descobrimentos (21,1 km): intervalo de tempo, ritmo por km, pressupostos e comparação com o objetivo de 1:30."],
  ["Estou a recuperar bem?", "Usa o conector Treino & Nutrição. Olha para o sono, FC de repouso, VFC e carga das últimas 2 semanas: estou a recuperar bem? Saúde primeiro."],
  ["Treino de amanhã", "Usa o conector Treino & Nutrição. Qual é o meu treino de amanhã e como o devo fazer (ritmos, FC, estrutura)?"],
];

const url = (q: string) => `https://claude.ai/new?q=${encodeURIComponent(q)}`;

export function ClaudeCoach() {
  const [text, setText] = useState("");
  return (
    <section className="card space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Falar com o teu Claude</h2>
        <p className="mt-0.5 text-xs text-muted">Abre uma conversa nova no Claude já com a pergunta. Confirma que o conector <b>Treino &amp; Nutrição</b> está ativo nessa conversa.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PROMPTS.map(([label, q]) => (
          <a key={label} href={url(q)} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line bg-soft p-3 text-sm font-medium active:scale-[.99]">
            {label} <span className="text-muted">↗</span>
          </a>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) window.open(url(`Usa o conector Treino & Nutrição. ${text.trim()}`), "_blank", "noopener");
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Outra pergunta ao treinador…" className="flex-1" />
        <button className="btn" disabled={!text.trim()}>Perguntar</button>
      </form>
    </section>
  );
}
