import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-bold">Treino & Nutrição</h1>
      <p className="mt-1 text-sm text-muted">Entra com o teu email e password.</p>
      {erro && <p className="mt-4 rounded-lg bg-soft p-3 text-sm text-bad">{erro}</p>}
      <LoginForm />
    </main>
  );
}
