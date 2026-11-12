export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="A carregar">
      <div className="h-7 w-40 rounded-lg bg-soft" />
      <div className="h-40 rounded-2xl bg-soft" />
      <div className="h-24 rounded-2xl bg-soft" />
      <div className="h-24 rounded-2xl bg-soft" />
    </div>
  );
}
