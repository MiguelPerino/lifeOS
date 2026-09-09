"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading, Empty } from "@/components/page-parts";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { TaskList } from "@/components/task-list";
import { RecordEditor } from "@/components/record-editor";
import { statusLabels, priorityLabels } from "@/domain/types";
import { priorityWeight, isOpen, blockedBy } from "@/domain/logic";
export default function TasksPage() {
  const { data } = useWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const [create, setCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("all");
  const [project, setProject] = useState(params.get("project") || "all");
  const [sort, setSort] = useState("due");
  const selected = data.tasks.find((t) => t.id === params.get("id"));
  const tasks = data.tasks
    .filter(
      (t) =>
        (status === "all" ||
          (status === "open" && isOpen(t)) ||
          (status === "blocked" && isOpen(t) && blockedBy(t, data.tasks).length > 0) ||
          t.status === status) &&
        (priority === "all" || t.priority === priority) &&
        (project === "all" || t.project_id === project) &&
        `${t.title} ${t.description} ${t.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "priority"
        ? priorityWeight[b.priority] - priorityWeight[a.priority]
        : sort === "title"
          ? a.title.localeCompare(b.title)
          : (a.due_date || "9999").localeCompare(b.due_date || "9999"),
    );
  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="UM PASSO DE CADA VEZ"
        title="Tarefas"
        description="O que precisa acontecer, com contexto e intenção."
        action={
          <Button onClick={() => setCreate(true)}>
            <Plus />
            Nova tarefa
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Pesquisar tarefas"
            placeholder="Pesquisar tarefas ou tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          aria-label="Filtrar status"
          className="w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="open">Em aberto</option>
          <option value="all">Todos os status</option>
          <option value="blocked">Bloqueadas</option>
          {["todo", "in_progress", "done", "cancelled"].map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrar prioridade"
          className="w-auto"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="all">Prioridades</option>
          {Object.entries(priorityLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrar projeto"
          className="w-auto max-w-52"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="all">Todos os projetos</option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Ordenar tarefas"
          className="w-auto"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="due">Por prazo</option>
          <option value="priority">Por prioridade</option>
          <option value="title">Por título</option>
        </Select>
      </div>
      <div className="panel">
        <div className="border-b px-4 py-3 text-xs text-muted-foreground">
          {tasks.length} tarefa(s)
        </div>
        {tasks.length ? (
          <TaskList tasks={tasks} />
        ) : (
          <Empty
            title="Espaço para o próximo passo"
            description="Crie uma tarefa ou ajuste os filtros para encontrar o que procura."
            action={
              <Button onClick={() => setCreate(true)}>
                <Plus />
                Criar tarefa
              </Button>
            }
          />
        )}
      </div>
      {(create || params.has("new") || selected) && (
        <RecordEditor
          entity="tasks"
          record={selected}
          onClose={() => {
            setCreate(false);
            router.replace("/tasks");
          }}
        />
      )}
    </div>
  );
}
