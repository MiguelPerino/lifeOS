export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6 p-8">
      <p className="text-sm text-muted-foreground">Carregando página…</p>
      <div aria-hidden="true" className="animate-pulse space-y-6">
        <div className="h-8 w-56 rounded bg-muted" />
        <div className="h-64 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
