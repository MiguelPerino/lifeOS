"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowUpRight, FolderOpen, Pencil, FileText } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading, Empty } from "@/components/page-parts";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { RecordEditor } from "@/components/record-editor";
import { TaskList } from "@/components/task-list";
import { ActivityList } from "@/components/activity-list";
import { progress } from "@/domain/logic";
import { statusLabels, type Project } from "@/domain/types";
import { dateLabel } from "@/lib/utils";
export default function ProjectsPage() {
  const { data } = useWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const [create, setCreate] = useState(false);
  const [editing, setEditing] = useState<Project>();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const selected = data.projects.find((p) => p.id === params.get("id"));
  const [tab, setTab] = useState("tasks");
  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="DO PLANO À REALIDADE"
        title={selected?.title || "Projetos"}
        description={selected?.description || "Conecte pequenas ações a algo maior."}
        action={
          selected ? (
            <Button variant="outline" onClick={() => setEditing(selected)}>
              <Pencil />
              Editar projeto
            </Button>
          ) : (
            <Button onClick={() => setCreate(true)}>
              <Plus />
              Novo projeto
            </Button>
          )
        }
      />
      {selected ? (
        <>
          <Link href="/projects" className="mb-6 inline-block text-sm text-primary">
            ← Todos os projetos
          </Link>
          <div className="panel mb-6 flex flex-wrap items-center gap-6 p-5">
            <span className="text-xs text-muted-foreground">{statusLabels[selected.status]}</span>
            <span className="text-xs text-muted-foreground">
              Prazo: {dateLabel(selected.due_date)}
            </span>
            <span className="text-xs text-muted-foreground">
              Criado em {new Date(selected.created_at).toLocaleDateString("pt-BR")}
            </span>
            <div className="ml-auto flex items-center gap-3">
              <div className="h-1.5 w-28 rounded bg-muted">
                <div
                  className="h-1.5 rounded bg-primary"
                  style={{ width: `${progress(selected, data.tasks)}%` }}
                />
              </div>
              <span className="text-sm font-medium">{progress(selected, data.tasks)}%</span>
            </div>
          </div>
          <div role="tablist" aria-label="Conteúdo do projeto" className="mb-5 flex gap-2 border-b">
            {[
              ["tasks", "Tarefas"],
              ["notes", "Notas"],
              ["activity", "Atividade"],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`border-b-2 px-4 py-3 text-sm ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="panel">
            {tab === "tasks" &&
              (data.tasks.some((t) => t.project_id === selected.id) ? (
                <TaskList tasks={data.tasks.filter((t) => t.project_id === selected.id)} />
              ) : (
                <Empty
                  title="Um projeto começa com um passo"
                  description="Crie uma tarefa e relacione-a a este projeto."
                  action={
                    <Link href="/tasks?new=1" className="text-sm text-primary">
                      Criar tarefa →
                    </Link>
                  }
                />
              ))}
            {tab === "notes" && (
              <div className="divide-y">
                {data.notes
                  .filter((n) => n.project_id === selected.id)
                  .map((n) => (
                    <Link key={n.id} href={`/notes?id=${n.id}`} className="flex gap-3 p-5 text-sm">
                      <FileText size={18} />
                      {n.title}
                    </Link>
                  ))}
                {!data.notes.some((n) => n.project_id === selected.id) && (
                  <Empty
                    title="Conhecimento conectado"
                    description="Relacione suas notas a este projeto para encontrá-las aqui."
                  />
                )}
              </div>
            )}
            {tab === "activity" && (
              <div className="p-6">
                <ActivityList
                  activities={data.activities.filter(
                    (a) => a.project_id === selected.id || a.entity_id === selected.id,
                  )}
                />
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mb-6 flex gap-3">
            <Input
              aria-label="Buscar projetos"
              placeholder="Buscar projetos…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-md"
            />
            <Select
              aria-label="Filtrar status dos projetos"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-auto"
            >
              <option value="all">Todos os status</option>
              {["planning", "active", "paused", "completed", "archived"].map((s) => (
                <option value={s} key={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {data.projects
              .filter(
                (p) =>
                  (status === "all" || p.status === status) &&
                  `${p.title} ${p.description}`.toLowerCase().includes(query.toLowerCase()),
              )
              .map((p) => (
                <Link
                  href={`/projects?id=${p.id}`}
                  className="panel group p-6 transition hover:border-primary/50"
                  key={p.id}
                >
                  <div className="mb-6 flex items-center justify-between">
                    <span className="rounded-lg bg-accent p-2.5 text-primary">
                      <FolderOpen size={20} />
                    </span>
                    <ArrowUpRight
                      size={17}
                      className="text-muted-foreground group-hover:text-primary"
                    />
                  </div>
                  <h2 className="font-semibold">{p.title}</h2>
                  <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
                    {p.description || "Um novo projeto tomando forma."}
                  </p>
                  <div className="mb-3 mt-7 flex justify-between text-xs">
                    <span className="text-muted-foreground">{statusLabels[p.status]}</span>
                    <span>{progress(p, data.tasks)}%</span>
                  </div>
                  <div className="h-1 rounded bg-muted">
                    <div
                      className="h-1 rounded bg-primary"
                      style={{ width: `${progress(p, data.tasks)}%` }}
                    />
                  </div>
                  <div className="mt-4 flex justify-between text-[11px] text-muted-foreground">
                    <span>{data.tasks.filter((t) => t.project_id === p.id).length} tarefas</span>
                    <span>{dateLabel(p.due_date)}</span>
                  </div>
                </Link>
              ))}
          </div>
          {!data.projects.length && (
            <Empty
              title="Dê um lugar aos seus planos"
              description="Organize tarefas e conhecimento em torno de um objetivo."
              action={<Button onClick={() => setCreate(true)}>Criar primeiro projeto</Button>}
            />
          )}
        </>
      )}
      {(create || params.has("new") || editing) && (
        <RecordEditor
          entity="projects"
          record={editing}
          onClose={() => {
            setCreate(false);
            setEditing(undefined);
            if (params.has("new")) router.replace("/projects");
          }}
        />
      )}
    </div>
  );
}
