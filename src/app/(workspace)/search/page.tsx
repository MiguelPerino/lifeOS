"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, Sparkles, ArrowUpRight, LoaderCircle } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading, Empty } from "@/components/page-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
export default function SearchPage() {
  const { data } = useWorkspace();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("text");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [semantic, setSemantic] = useState<
    { id: string; title: string; content: string; similarity: number }[]
  >([]);
  const q = query.trim().toLowerCase();
  const textResults = q
    ? [
        ...data.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          detail: t.description,
          tags: t.tags,
          type: "tasks",
          label: "Tarefa",
        })),
        ...data.projects.map((p) => ({
          id: p.id,
          title: p.title,
          detail: p.description,
          tags: [],
          type: "projects",
          label: "Projeto",
        })),
        ...data.notes.map((n) => ({
          id: n.id,
          title: n.title,
          detail: n.content,
          tags: n.tags,
          type: "notes",
          label: "Nota",
        })),
      ].filter((r) => `${r.title} ${r.detail} ${r.tags.join(" ")}`.toLowerCase().includes(q))
    : [];
  const results =
    mode === "text"
      ? textResults
      : semantic.map((n) => ({
          id: n.id,
          title: n.title,
          detail: n.content,
          tags: [],
          type: "notes",
          label: `Nota · similaridade ${(n.similarity * 100).toFixed(0)}%`,
        }));
  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "text") return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ results: typeof semantic }>("/api/ai", {
        action: "search",
        text: query,
      });
      setSemantic(r.results);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Busca indisponível.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-enter mx-auto max-w-4xl">
      <PageHeading
        eyebrow="CONEXÕES QUE FAZEM SENTIDO"
        title="Encontre seu conhecimento"
        description="Busque pelas palavras que lembra. Ou pelo significado."
      />
      <div className="mb-5 flex gap-2" role="tablist" aria-label="Tipo de busca">
        {[
          ["text", "Textual"],
          ["semantic", "Semântica"],
        ].map(([id, label]) => (
          <Button
            key={id}
            role="tab"
            aria-selected={mode === id}
            variant={mode === id ? "default" : "outline"}
            onClick={() => {
              setMode(id);
              setError("");
            }}
          >
            {id === "semantic" ? <Sparkles /> : <Search />}
            {label}
          </Button>
        ))}
      </div>
      <form onSubmit={search} className="mb-5 flex gap-3">
        <Input
          aria-label="Termo de busca"
          placeholder={
            mode === "semantic"
              ? "Material que eu estava estudando sobre modelos de linguagem…"
              : "Buscar tarefas, projetos, notas e tags…"
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSemantic([]);
            setSearched(false);
          }}
          maxLength={500}
        />
        <Button
          disabled={busy || query.trim().length < 2 || (mode === "semantic" && !data.aiEnabled)}
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <Search />}Buscar
        </Button>
      </form>
      {mode === "semantic" && (
        <p className="mb-6 text-xs leading-5 text-muted-foreground">
          Busca em notas indexadas com nomic-embed-text.{" "}
          {data.notes.filter((n) => n.embedding_status !== "ready").length} nota(s) aguardando
          indexação. Similaridade indica proximidade, não certeza.
          {!data.aiEnabled && " A IA está desativada neste ambiente."}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-5 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="panel divide-y">
        {results.map((r) => (
          <Link
            key={`${r.type}-${r.id}`}
            href={`/${r.type}?id=${r.id}`}
            className="block p-5 transition hover:bg-muted/40"
          >
            <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{r.label}</span>
              <ArrowUpRight size={14} />
            </div>
            <h2 className="text-sm font-medium">{r.title}</h2>
            <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
              {r.detail}
            </p>
            {r.tags.length > 0 && (
              <p className="mt-2 text-xs text-primary">{r.tags.map((t) => `#${t}`).join(" ")}</p>
            )}
          </Link>
        ))}
        {!results.length && (
          <Empty
            title={
              q && (mode === "text" || searched)
                ? "Nenhum resultado encontrado"
                : "Tudo que você guarda, ao seu alcance"
            }
            description={
              q
                ? "Experimente outras palavras ou confira se as notas estão indexadas."
                : "Pesquise para conectar suas tarefas, projetos e ideias."
            }
          />
        )}
      </div>
    </div>
  );
}
