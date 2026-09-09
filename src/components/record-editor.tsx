"use client";
import { useState } from "react";
import { Plus, Trash2, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import type { Entity, Task, Project, Note } from "@/domain/types";
import { statusLabels, priorityLabels, kindLabels } from "@/domain/types";
import { taskSchema, projectSchema, noteSchema } from "@/domain/schemas";
import { api } from "@/lib/client-api";
import { useWorkspace } from "./workspace-provider";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input, Textarea, Select, Field } from "./ui/input";
type RecordValue = Task | Project | Note;
export function RecordEditor({
  entity,
  record,
  onClose,
}: {
  entity: Entity;
  record?: RecordValue;
  onClose: () => void;
}) {
  const { data, refresh } = useWorkspace();
  const [recordId] = useState(() => record?.id ?? crypto.randomUUID());
  const task = record && "priority" in record ? record : undefined;
  const note = record && "content" in record ? record : undefined;
  const [title, setTitle] = useState(record?.title || "");
  const [description, setDescription] = useState(
    note?.content || (record && "description" in record ? record.description : ""),
  );
  const [status, setStatus] = useState(
    record && "status" in record ? record.status : entity === "projects" ? "planning" : "todo",
  );
  const [priority, setPriority] = useState(task?.priority || "medium");
  const [due, setDue] = useState(record?.due_date || "");
  const [project, setProject] = useState(
    record && "project_id" in record ? record.project_id || "" : "",
  );
  const [kind, setKind] = useState(note?.kind || "note");
  const [tags, setTags] = useState(record && "tags" in record ? record.tags.join(", ") : "");
  const [subtasks, setSubtasks] = useState(task?.subtasks || []);
  const [dependencies, setDependencies] = useState(task?.dependencies || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = {
        id: recordId,
        title,
        description,
        content: description,
        status,
        priority,
        due_date: due || null,
        project_id: project || null,
        kind,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        subtasks,
        dependencies,
      };
      const schema =
        entity === "tasks" ? taskSchema : entity === "notes" ? noteSchema : projectSchema;
      const parsed = schema.safeParse(payload);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const result = await api<{ warning?: string }>(`/api/records/${entity}`, parsed.data);
      toast.success("Salvo no seu espaço.");
      if (result.warning) toast.warning(result.warning);
      onClose();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api(`/api/records/${entity}`, { id: record!.id }, "DELETE");
      toast.success("Registro excluído.");
      onClose();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle className="text-xl font-semibold">
          {record ? "Editar" : "Criar"}{" "}
          {entity === "tasks" ? "tarefa" : entity === "projects" ? "projeto" : "nota"}
        </DialogTitle>
        <DialogDescription className="mb-6 mt-2 text-sm text-muted-foreground">
          Dê forma ao seu próximo passo.
        </DialogDescription>
        <form onSubmit={save} className="space-y-5">
          <Field label="Título">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              autoFocus
              placeholder="O que você tem em mente?"
            />
          </Field>
          <Field label={entity === "notes" ? "Conteúdo" : "Descrição"}>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={entity === "notes" ? 8 : 3}
              maxLength={entity === "notes" ? 40000 : 20000}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            {entity === "notes" ? (
              <Field label="Tipo">
                <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                  {["note", "idea", "event", "reminder"].map((k) => (
                    <option key={k} value={k}>
                      {kindLabels[k]}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                  {(entity === "tasks"
                    ? ["todo", "in_progress", "done", "cancelled"]
                    : ["planning", "active", "paused", "completed", "archived"]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {statusLabels[s]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Prazo">
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>
          {entity === "tasks" && (
            <Field label="Prioridade">
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
              >
                {Object.entries(priorityLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {entity !== "projects" && (
            <>
              <Field label="Projeto">
                <Select value={project} onChange={(e) => setProject(e.target.value)}>
                  <option value="">Sem projeto</option>
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tags (separadas por vírgula)">
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="estudos, trabalho, ideia"
                />
              </Field>
            </>
          )}
          {entity === "tasks" && (
            <>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm font-medium">
                  Subtarefas
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setSubtasks([...subtasks, { title: "", done: false }])}
                  >
                    <Plus />
                    Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {subtasks.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        aria-label={`Concluir subtarefa ${i + 1}`}
                        checked={s.done}
                        onChange={(e) =>
                          setSubtasks(
                            subtasks.map((v, j) =>
                              j === i ? { ...v, done: e.target.checked } : v,
                            ),
                          )
                        }
                      />
                      <Input
                        aria-label={`Título da subtarefa ${i + 1}`}
                        value={s.title}
                        required
                        onChange={(e) =>
                          setSubtasks(
                            subtasks.map((v, j) => (j === i ? { ...v, title: e.target.value } : v)),
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover subtarefa"
                        onClick={() => setSubtasks(subtasks.filter((_, j) => j !== i))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Depende de</legend>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border p-3">
                  {data.tasks
                    .filter((t) => t.id !== record?.id)
                    .map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={dependencies.includes(t.id)}
                          onChange={(e) =>
                            setDependencies(
                              e.target.checked
                                ? [...dependencies, t.id]
                                : dependencies.filter((id) => id !== t.id),
                            )
                          }
                        />
                        {t.title}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {statusLabels[t.status]}
                        </span>
                      </label>
                    ))}
                  {!data.tasks.filter((t) => t.id !== record?.id).length && (
                    <p className="text-xs text-muted-foreground">
                      Crie outra tarefa para relacionar uma dependência.
                    </p>
                  )}
                </div>
              </fieldset>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {confirmDelete ? (
            <div className="rounded-lg bg-destructive/10 p-4 text-sm">
              <p>
                Excluir este registro permanentemente?{" "}
                {entity === "projects"
                  ? "Tarefas e notas serão mantidas sem este projeto."
                  : "Esta ação não pode ser desfeita."}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  Confirmar exclusão
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between border-t pt-4">
              {record ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir registro"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" type="button" disabled={busy} onClick={onClose}>
                  Cancelar
                </Button>
                <Button disabled={busy}>
                  {busy && <LoaderCircle className="animate-spin" />}
                  {busy ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
