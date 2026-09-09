"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, FileText, RefreshCw, Lightbulb, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading, Empty } from "@/components/page-parts";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { RecordEditor } from "@/components/record-editor";
import { kindLabels, type Note } from "@/domain/types";
import { api } from "@/lib/client-api";
import { dateLabel } from "@/lib/utils";
export default function NotesPage() {
  const { data, refresh } = useWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const [create, setCreate] = useState(false);
  const [editing, setEditing] = useState<Note>();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [indexing, setIndexing] = useState<string>();
  const selected = data.notes.find((n) => n.id === params.get("id"));
  async function index(id: string) {
    setIndexing(id);
    try {
      const result = await api<{ warning?: string }>("/api/ai", { action: "index", id });
      if (result.warning) toast.warning(result.warning);
      else toast.success("Nota indexada para busca semântica.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na indexação.");
    } finally {
      setIndexing(undefined);
    }
  }
  const notes = data.notes
    .filter(
      (n) =>
        (kind === "all" || n.kind === kind) &&
        `${n.title} ${n.content} ${n.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="IDEIAS MERECEM ESPAÇO"
        title="Notas & ideias"
        description="Guarde o que aprende. Redescubra quando precisar."
        action={
          <Button onClick={() => setCreate(true)}>
            <Plus />
            Nova nota
          </Button>
        }
      />
      <div className="mb-6 flex gap-3">
        <Input
          aria-label="Pesquisar notas"
          placeholder="Pesquisar conteúdo ou tags…"
          className="max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          aria-label="Filtrar tipo de nota"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="w-auto"
        >
          <option value="all">Todos os tipos</option>
          {["note", "idea", "event", "reminder"].map((k) => (
            <option key={k} value={k}>
              {kindLabels[k]}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {notes.map((n) => (
          <article key={n.id} className="panel flex flex-col p-5">
            <button className="flex-1 text-left" onClick={() => setEditing(n)}>
              <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                {n.kind === "idea" ? (
                  <Lightbulb size={16} />
                ) : n.kind === "event" ? (
                  <CalendarDays size={16} />
                ) : (
                  <FileText size={16} />
                )}{" "}
                {kindLabels[n.kind]}
                <span className="ml-auto text-[10px]">
                  {new Date(n.updated_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <h2 className="font-medium">{n.title}</h2>
              <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {n.content || "Uma página esperando suas ideias."}
              </p>
              {n.project_id && (
                <p className="mt-3 text-xs text-primary">
                  {data.projects.find((p) => p.id === n.project_id)?.title}
                </p>
              )}
              {n.due_date && (
                <p className="mt-3 text-xs text-muted-foreground">{dateLabel(n.due_date)}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {n.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </button>
            <div className="mt-5 flex items-center justify-between border-t pt-3 text-[10px] text-muted-foreground">
              <span>
                {n.embedding_status === "ready"
                  ? "● Busca semântica pronta"
                  : "○ Indexação pendente"}
              </span>
              {n.embedding_status !== "ready" && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={Boolean(indexing) || !data.aiEnabled}
                  onClick={() => void index(n.id)}
                >
                  <RefreshCw className={indexing === n.id ? "animate-spin" : ""} />
                  Reindexar
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!notes.length && (
        <Empty
          title="Uma boa ideia começa aqui"
          description="Capture notas, materiais de estudo e pensamentos que você quer guardar."
          action={<Button onClick={() => setCreate(true)}>Escrever uma nota</Button>}
        />
      )}
      {(create || params.has("new") || editing || selected) && (
        <RecordEditor
          entity="notes"
          record={editing || selected}
          onClose={() => {
            setCreate(false);
            setEditing(undefined);
            router.replace("/notes");
          }}
        />
      )}
    </div>
  );
}
