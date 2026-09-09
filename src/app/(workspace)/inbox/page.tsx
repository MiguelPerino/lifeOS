"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles, ArrowRight, Check, LoaderCircle, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading } from "@/components/page-parts";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field, Select } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { localDay } from "@/lib/utils";
import { inboxSchema, type InboxDraft } from "@/domain/schemas";
import { kindLabels, priorityLabels } from "@/domain/types";
export default function InboxPage() {
  const params = useSearchParams();
  const { data, refresh } = useWorkspace();
  const [text, setText] = useState(params.get("text") || "");
  const [draft, setDraft] = useState<InboxDraft>();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState("");
  async function interpret() {
    setBusy(true);
    setError("");
    try {
      setDraft(await api<InboxDraft>("/api/ai", { action: "inbox", text, day: localDay() }));
      setRequestKey(crypto.randomUUID());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível interpretar.");
    } finally {
      setBusy(false);
    }
  }
  function update(index: number, patch: Partial<InboxDraft["items"][number]>) {
    setDraft((d) =>
      d
        ? { ...d, items: d.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }
        : d,
    );
  }
  function remove(index: number) {
    setDraft((d) =>
      d
        ? {
            ...d,
            items: d.items
              .filter((_, i) => i !== index)
              .map((item) => ({
                ...item,
                depends_on: item.depends_on
                  .filter((i) => i !== index)
                  .map((i) => (i > index ? i - 1 : i)),
              })),
          }
        : d,
    );
  }
  async function save() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const parsed = inboxSchema.safeParse(draft);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const result = await api<{ warning?: string }>("/api/inbox", {
        draft: parsed.data,
        request_key: requestKey,
      });
      setDraft(undefined);
      setText("");
      toast.success("Captura confirmada e salva.");
      if (result.warning) toast.warning(result.warning);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="page-enter mx-auto max-w-4xl">
      <PageHeading
        eyebrow="DA CABEÇA PARA O MUNDO"
        title="Smart Inbox"
        description="Escreva como você pensa. A organização vem depois."
      />
      <div className="panel p-5 md:p-7">
        <Textarea
          aria-label="Seu pensamento"
          placeholder="Preciso terminar a implementação do chunking do meu projeto de RAG até sexta e depois começar embeddings…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDraft(undefined);
          }}
          maxLength={8000}
          disabled={saving || busy}
          className="min-h-40 resize-y border-0 bg-transparent p-0 text-base leading-7 focus:ring-0"
        />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles size={14} />
            {data.aiEnabled
              ? "Você revisa tudo antes de salvar."
              : "IA desativada. Crie seus registros pelas outras áreas."}
          </p>
          <Button
            disabled={!data.aiEnabled || text.trim().length < 3 || busy || saving}
            onClick={() => void interpret()}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            {busy ? "Interpretando…" : "Organizar com IA"}
          </Button>
        </div>
      </div>
      {!draft && !busy && (
        <div className="mt-7">
          <p className="eyebrow mb-3">Pode começar assim</p>
          <div className="flex flex-wrap gap-2">
            {[
              "Tenho prova de Deep Learning dia 20.",
              "Quero estudar Transformers esta semana.",
              "Tive uma ideia de criar um sistema de recomendações.",
            ].map((s) => (
              <button
                key={s}
                onClick={() => setText(s)}
                className="rounded-lg border px-3 py-2 text-left text-xs text-muted-foreground transition hover:bg-accent"
              >
                {s}
                <ArrowRight size={12} className="ml-2 inline" />
              </button>
            ))}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-5 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {draft && (
        <section className="mt-8">
          <div className="mb-5">
            <p className="eyebrow mb-2">REVISÃO OBRIGATÓRIA</p>
            <h2 className="text-xl font-semibold">Foi isso que você quis dizer?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{draft.explanation}</p>
          </div>
          <div className="space-y-4">
            {draft.items.map((item, i) => (
              <div key={i} className="panel space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Item {i + 1} · {kindLabels[item.type]}
                  </span>
                  <Button
                    aria-label={`Remover item ${i + 1}`}
                    variant="ghost"
                    size="icon"
                    disabled={saving}
                    onClick={() => remove(i)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
                  <Field label="Tipo">
                    <Select
                      value={item.type}
                      onChange={(e) =>
                        update(i, { type: e.target.value as typeof item.type, depends_on: [] })
                      }
                    >
                      {Object.entries(kindLabels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Título">
                    <Input
                      value={item.title}
                      onChange={(e) => update(i, { title: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Descrição">
                  <Textarea
                    value={item.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                    className="min-h-20"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Prazo (confira a data)">
                    <Input
                      type="date"
                      value={item.due_date || ""}
                      onChange={(e) => update(i, { due_date: e.target.value || null })}
                    />
                  </Field>
                  <Field label="Prioridade sugerida">
                    <Select
                      value={item.priority}
                      onChange={(e) =>
                        update(i, { priority: e.target.value as typeof item.priority })
                      }
                    >
                      {Object.entries(priorityLabels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Projeto relacionado">
                    <Input
                      list="existing-projects"
                      value={item.project || ""}
                      onChange={(e) => update(i, { project: e.target.value || null })}
                      placeholder="Nenhum"
                    />
                  </Field>
                </div>
                <Field label="Tags">
                  <Input
                    value={item.tags.join(", ")}
                    onChange={(e) =>
                      update(i, { tags: e.target.value.split(",").map((t) => t.trim()) })
                    }
                  />
                </Field>
                {item.project &&
                  !data.projects.some(
                    (p) => p.title.toLowerCase() === item.project!.toLowerCase(),
                  ) && (
                    <p className="text-xs text-primary">
                      Um novo projeto “{item.project}” será criado ao confirmar.
                    </p>
                  )}
                {item.type === "task" && (
                  <>
                    <div>
                      <div className="flex items-center justify-between text-sm">
                        Subtarefas
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            update(i, { subtasks: [...item.subtasks, { title: "", done: false }] })
                          }
                        >
                          <Plus />
                          Adicionar
                        </Button>
                      </div>
                      {item.subtasks.map((s, j) => (
                        <div key={j} className="mt-2 flex gap-2">
                          <Input
                            aria-label={`Subtarefa ${j + 1}`}
                            value={s.title}
                            onChange={(e) =>
                              update(i, {
                                subtasks: item.subtasks.map((v, k) =>
                                  k === j ? { ...v, title: e.target.value } : v,
                                ),
                              })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remover subtarefa"
                            onClick={() =>
                              update(i, { subtasks: item.subtasks.filter((_, k) => k !== j) })
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <fieldset>
                      <legend className="mb-2 text-sm">Depende de</legend>
                      <div className="space-y-2">
                        {draft.items.map((other, j) =>
                          j !== i && other.type === "task" ? (
                            <label key={j} className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={item.depends_on.includes(j)}
                                onChange={(e) =>
                                  update(i, {
                                    depends_on: e.target.checked
                                      ? [...item.depends_on, j]
                                      : item.depends_on.filter((k) => k !== j),
                                  })
                                }
                              />
                              {other.title}
                            </label>
                          ) : null,
                        )}
                        {draft.items.filter((t) => t.type === "task").length < 2 && (
                          <p className="text-xs text-muted-foreground">
                            Sem outras tarefas nesta captura.
                          </p>
                        )}
                      </div>
                    </fieldset>
                  </>
                )}
              </div>
            ))}
          </div>
          <datalist id="existing-projects">
            {data.projects.map((p) => (
              <option key={p.id} value={p.title} />
            ))}
          </datalist>
          <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4 shadow-lg">
            <span className="text-xs text-muted-foreground">Nada foi salvo ainda.</span>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={saving} onClick={() => setDraft(undefined)}>
                Descartar
              </Button>
              <Button disabled={saving || !draft.items.length} onClick={() => void save()}>
                {saving ? <LoaderCircle className="animate-spin" /> : <Check />}
                {saving ? "Salvando…" : `Confirmar e salvar ${draft.items.length} item(s)`}
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
