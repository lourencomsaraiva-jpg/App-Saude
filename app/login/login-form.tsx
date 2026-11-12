"use client";
import { useActionState } from "react";
import { sendMagicLink } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(sendMagicLink, null);
  return (
    <form action={action} className="mt-6 space-y-3">
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" autoComplete="email" inputMode="email" required />
      </label>
      <button className="btn w-full" disabled={pending}>{pending ? "A enviar…" : "Enviar link de entrada"}</button>
      {state && <p className={`text-sm ${state.ok ? "text-good" : "text-bad"}`}>{state.message}</p>}
    </form>
  );
}
