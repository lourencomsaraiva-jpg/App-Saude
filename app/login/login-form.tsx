"use client";
import { useActionState, useState } from "react";
import { sendCode, verifyCode, type LoginState } from "./actions";

export function LoginForm() {
  const [sent, sendAction, sending] = useActionState(sendCode, null);
  const [checked, verifyAction, verifying] = useActionState(verifyCode, null);
  const [dismissed, setDismissed] = useState<LoginState>(null);
  const state: LoginState = checked ?? sent;
  const showCode = sent?.step === "code" && dismissed !== sent;

  if (!showCode) {
    return (
      <form action={sendAction} className="mt-6 space-y-3">
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={sent?.email ?? ""} />
        </label>
        <button className="btn w-full" disabled={sending}>{sending ? "A enviar…" : "Enviar código de entrada"}</button>
        {sent && !sent.ok && <p className="text-sm text-bad">{sent.message}</p>}
      </form>
    );
  }
  return (
    <form action={verifyAction} className="mt-6 space-y-3">
      <p className="text-sm text-good">{sent.message}</p>
      <input type="hidden" name="email" value={sent.email} />
      <label className="block">
        <span className="label">Código</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={12} required autoFocus className="num text-center text-2xl tracking-[0.3em]" />
      </label>
      <button className="btn w-full" disabled={verifying}>{verifying ? "A verificar…" : "Entrar"}</button>
      {state && state.step === "code" && !state.ok && <p className="text-sm text-bad">{state.message}</p>}
      <button type="button" className="text-sm text-muted underline" onClick={() => setDismissed(sent)}>Usar outro email / pedir novo código</button>
    </form>
  );
}
