"use client";
import { useState } from "react";
import Link from "next/link";
import { Sparkles, LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";
import { useWorkspace } from "./workspace-provider";
import { api } from "@/lib/client-api";
import { localDay } from "@/lib/utils";
import type { Source } from "@/domain/types";
type Insights = {
  paragraphs: { text: string; source_ids: string[] }[];
  sources: Source[];
  empty: boolean;
};
export function AIInsights() {
  const { data } = useWorkspace();
  const [result, setResult] = useState<Insights>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function generate() {
    setBusy(true);
    setError("");
    try {
      setResult(
        await api<Insights>("/api/ai", {
          action: "chat",
          day: localDay(),
          text: "Use getTasks e getProjects para dar até três insights curtos sobre prioridades, prazos e dependências. Cite registros reais e não invente contagens.",
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Insights indisponíveis.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 border-t border-primary/15 pt-4">
      {result?.paragraphs.map((p, i) => (
        <div key={i} className="mb-4">
          <p className="text-xs leading-6">{p.text}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.source_ids.map((id) => {
              const source = result.sources.find((s) => s.id === id);
              return source ? (
                <Link
                  href={`/${source.type}?id=${id}`}
                  key={id}
                  className="text-[10px] text-primary underline"
                >
                  {source.title}
                </Link>
              ) : null;
            })}
          </div>
        </div>
      ))}
      {result?.empty && (
        <p className="mb-3 text-xs text-muted-foreground">
          Ainda não há dados suficientes para gerar insights.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 text-xs text-destructive">
          {error}
        </p>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start px-0 text-primary"
        disabled={!data.aiEnabled || busy}
        onClick={() => void generate()}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
        {busy ? "Consultando seus dados…" : "Gerar insights com IA"}
      </Button>
    </div>
  );
}
