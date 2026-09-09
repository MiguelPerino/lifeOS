"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg p-12">
      <h1 className="text-2xl font-semibold">Não foi possível abrir este espaço</h1>
      <p className="my-4 text-muted-foreground">
        Verifique sua conexão e a configuração do Supabase e tente novamente.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </main>
  );
}
