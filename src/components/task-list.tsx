"use client";
import { useState } from "react";
import { Circle, CheckCircle2, Lock, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import type { Task } from "@/domain/types";
import { priorityLabels, statusLabels } from "@/domain/types";
import { blockedBy } from "@/domain/logic";
import { cn, dateLabel, localDay } from "@/lib/utils";
import { api } from "@/lib/client-api";
import { useWorkspace } from "./workspace-provider";
import { RecordEditor } from "./record-editor";
export function TaskList({ tasks, compact = false }: { tasks: Task[]; compact?: boolean }) {
  const { data, refresh } = useWorkspace();
  const [editing, setEditing] = useState<Task>();
  const [busy, setBusy] = useState<string>();
  const today = localDay();
  async function toggle(t: Task) {
    setBusy(t.id);
    try {
      if (t.status !== "done" && blockedBy(t, data.tasks).length)
        throw new Error("Conclua as dependências antes de concluir esta tarefa.");
      await api("/api/records/tasks", { ...t, status: t.status === "done" ? "todo" : "done" });
      await refresh();
      toast.success(t.status === "done" ? "Tarefa reaberta." : "Mais um passo concluído.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar.");
    } finally {
      setBusy(undefined);
    }
  }
  return (
    <>
      <div className="divide-y">
        {tasks.map((t) => {
          const blocked = blockedBy(t, data.tasks);
          const project = data.projects.find((p) => p.id === t.project_id);
          return (
            <div
              key={t.id}
              className="group flex items-start gap-3 px-4 py-4 transition hover:bg-muted/40"
            >
              <button
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary disabled:opacity-40"
                aria-label={t.status === "done" ? `Reabrir ${t.title}` : `Concluir ${t.title}`}
                disabled={busy === t.id}
                onClick={() => void toggle(t)}
              >
                {t.status === "done" ? (
                  <CheckCircle2 size={19} className="text-primary" />
                ) : (
                  <Circle size={19} />
                )}
              </button>
              <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(t)}>
                <p
                  className={cn(
                    "text-sm font-medium leading-5",
                    t.status === "done" && "text-muted-foreground line-through",
                  )}
                >
                  {t.title}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {project && <span>{project.title}</span>}
                  {!compact && <span>{statusLabels[t.status]}</span>}
                  {t.subtasks.length > 0 && (
                    <span>
                      {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length} subtarefas
                    </span>
                  )}
                  {blocked.length > 0 && t.status !== "done" && (
                    <span
                      className="flex items-center gap-1 text-amber-600 dark:text-amber-400"
                      title={blocked.map((b) => b.title).join(", ")}
                    >
                      <Lock size={11} />
                      {blocked.length} dependência(s)
                    </span>
                  )}
                  {t.tags.map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
              </button>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px]",
                    t.priority === "urgent"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : t.priority === "high"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {priorityLabels[t.priority]}
                </span>
                {t.due_date && (
                  <span
                    className={cn(
                      "flex items-center gap-1 text-[10px]",
                      t.due_date < today && t.status !== "done"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    <CalendarDays size={11} />
                    {t.due_date === today ? "Hoje" : dateLabel(t.due_date)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {editing && (
        <RecordEditor entity="tasks" record={editing} onClose={() => setEditing(undefined)} />
      )}
    </>
  );
}
