import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-bold">Treino & Nutrição</h1>
      <p className="mt-1 text-sm text-muted">Acesso pessoal.</p>
      {erro && <p className="mt-4 rounded-lg bg-soft p-3 text-sm text-bad">{erro}</p>}
      {process.env.ACCESS_KEY ? (
        <form action="/entrar" method="post" className="mt-6 space-y-3">
          <label className="block">
            <span className="label">Chave de acesso</span>
            <input name="chave" type="password" autoComplete="current-password" required />
          </label>
          <button className="btn w-full">Entrar</button>
          <p className="text-xs text-muted">Só precisas de a colar uma vez em cada dispositivo.</p>
        </form>
      ) : null}
      <details className="mt-6" open={!process.env.ACCESS_KEY}>
        <summary className="cursor-pointer text-sm text-muted">Entrar com email</summary>
        <LoginForm />
      </details>
    </main>
  );
}
