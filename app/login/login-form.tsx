"use client";
import { useActionState, useState } from "react";
import { sendCode, signInPassword, verifyCode, type LoginState } from "./actions";

export function LoginForm() {
  const [mode, setMode] = useState<"password" | "email">("password");
  const [pw, pwAction, pwPending] = useActionState(signInPassword, null);
  const [sent, sendAction, sending] = useActionState(sendCode, null);
  const [checked, verifyAction, verifying] = useActionState(verifyCode, null);
  const [dismissed, setDismissed] = useState<LoginState>(null);
  const showCode = sent?.step === "code" && dismissed !== sent;

  if (mode === "password") {
    return (
      <div className="mt-6 space-y-3">
        <form action={pwAction} className="space-y-3">
          <label className="block">
            <span className="label">Email</span>
            <input name="email" type="email" autoComplete="username" inputMode="email" required defaultValue={pw?.email ?? ""} />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="btn w-full" disabled={pwPending}>{pwPending ? "A entrar…" : "Entrar"}</button>
          {pw && !pw.ok && <p className="text-sm text-bad">{pw.message}</p>}
        </form>
        <button type="button" className="text-sm text-muted underline" onClick={() => setMode("email")}>Ainda não tenho password — entrar por email</button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {!showCode ? (
        <form action={sendAction} className="space-y-3">
          <label className="block">
            <span className="label">Email</span>
            <input name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={sent?.email ?? ""} />
          </label>
          <button className="btn w-full" disabled={sending}>{sending ? "A enviar…" : "Enviar email de entrada"}</button>
          {sent && !sent.ok && <p className="text-sm text-bad">{sent.message}</p>}
        </form>
      ) : (
        <form action={verifyAction} className="space-y-3">
          <p className="text-sm text-good">Enviámos um email. Se trouxer um código, escreve-o aqui; se trouxer só um link, abre-o e depois define uma password em Definições.</p>
          <input type="hidden" name="email" value={sent.email} />
          <label className="block">
            <span className="label">Código (se o email tiver)</span>
            <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={12} required className="num text-center text-2xl tracking-[0.3em]" />
          </label>
          <button className="btn w-full" disabled={verifying}>{verifying ? "A verificar…" : "Entrar"}</button>
          {checked && !checked.ok && <p className="text-sm text-bad">{checked.message}</p>}
          <button type="button" className="text-sm text-muted underline" onClick={() => setDismissed(sent)}>Usar outro email / pedir novo email</button>
        </form>
      )}
      <button type="button" className="text-sm text-muted underline" onClick={() => setMode("password")}>Entrar com password</button>
    </div>
  );
}
