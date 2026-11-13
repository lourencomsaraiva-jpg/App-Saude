"use client";
import { useSyncExternalStore, type ReactNode } from "react";

/**
 * Link para o Claude. Sem conversa fixa: abre uma conversa nova já com a pergunta (claude.ai/new?q=).
 * Com conversa fixa (guardada neste telemóvel): copia a pergunta e abre essa conversa — basta colar e enviar,
 * porque o claude.ai não deixa pré-escrever mensagens numa conversa existente.
 */
const KEY = "claude-chat-url";
const listeners = new Set<() => void>();

export function getChatUrl(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
export function setChatUrl(url: string) {
  try {
    if (url) localStorage.setItem(KEY, url);
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}
export function useChatUrl(): string {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getChatUrl,
    () => "",
  );
}
export function isClaudeChatUrl(u: string): boolean {
  return /^https:\/\/claude\.ai\/(chat|project)\/[\w-]+/.test(u.trim());
}

export function openClaude(prompt: string) {
  const chat = getChatUrl();
  if (!chat) {
    window.open(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`, "_blank", "noopener");
    return;
  }
  // abrir já (no iOS a janela tem de abrir no mesmo toque); a cópia corre em paralelo
  window.open(chat, "_blank", "noopener");
  navigator.clipboard?.writeText(prompt).catch(() => {});
}

export function ClaudeLink({ prompt, className, children }: { prompt: string; className?: string; children: ReactNode }) {
  const chat = useChatUrl();
  return (
    <a
      href={chat || `https://claude.ai/new?q=${encodeURIComponent(prompt)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(e) => {
        if (!chat) return; // link normal
        e.preventDefault();
        openClaude(prompt);
      }}
    >
      {children}
    </a>
  );
}
