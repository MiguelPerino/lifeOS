"use client";
import { useEffect, useState } from "react";
import { Sparkles, Plus, ArrowUp, ArrowDown, Trash2, Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace-provider";
import { PageHeading, Empty } from "@/components/page-parts";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { TaskList } from "@/components/task-list";
import { api } from "@/lib/client-api";
import { localDay } from "@/lib/utils";
import { planSchema, type PlanItem } from "@/domain/schemas";
import type { DailyPlan } from "@/domain/types";
import { rankedTasks, validatePlanTasks } from "@/domain/logic";
function reflow(items: PlanItem[]) {
  let minutes = items[0]
    ? Number(items[0].start_time.slice(0, 2)) * 60 + Number(items[0].start_time.slice(3))
    : 540;
  return items.map((item) => {
    const start_time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    minutes += item.duration_minutes;
    return { ...item, start_time };
  });
}
export default function TodayPage() {
  const { data, refresh } = useWorkspace();
  const [day, setDay] = useState(localDay());
  const [items, setItems] = useState<PlanItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const tasks = rankedTasks(data.tasks, day);
  useEffect(() => {
    let current = true;
    api<{ plan: DailyPlan | null }>(`/api/plans?day=${day}`)
      .then((r) => {
        if (current) {
          setItems(r.plan?.items || []);
          setDirty(false);
          setError("");
        }
      })
      .catch((e) => {
        if (current) {
          setError(e.message);
          setItems([]);
          setDirty(false);
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [day]);
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ items: PlanItem[] }>("/api/ai", { action: "plan", day });
      setItems(result.items);
      setDirty(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível planejar.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const plan = planSchema.parse({ items });
      validatePlanTasks(items, data.tasks);
      await api("/api/plans", { day, plan });
      setDirty(false);
      toast.success("Seu plano está salvo.");
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "ZodError"
          ? e.message
          : "Confira os horários: não podem se sobrepor ou sair do dia.",
      );
    } finally {
      setBusy(false);
    }
  }
  function change(next: PlanItem[]) {
    setItems(next);
    setDirty(true);
  }
  function move(index: number, delta: number) {
    const next = [...items];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    change(reflow(next));
  }
  return (
    <div className="page-enter">
      <PageHeading
        eyebrow="CLAREZA ANTES DE VELOCIDADE"
        title="Meu dia"
        description="Escolha o que importa. Deixe espaço para respirar."
        action={
          <div className="flex flex-wrap gap-2">
            <Input
              type="date"
              aria-label="Data do planejamento"
              value={day}
              disabled={busy}
              onChange={(e) => {
                if (!e.target.value) return;
                if (dirty && !window.confirm("Descartar as alterações não salvas deste plano?"))
                  return;
                setLoading(true);
                setDay(e.target.value);
              }}
              className="w-auto"
            />
            <Button
              disabled={busy || loading || !data.aiEnabled || !tasks.length}
              onClick={() => void generate()}
            >
              {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}Planejar meu dia com
              IA
            </Button>
          </div>
        }
      />
      {!data.aiEnabled && (
        <p className="mb-5 text-sm text-muted-foreground">
          IA desativada. Você pode montar e salvar seu plano manualmente.
        </p>
      )}
      {error && (
        <p role="alert" className="mb-5 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-7 xl:grid-cols-[1.2fr_1fr]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b p-5">
            <h2 className="text-sm font-semibold">Sua sequência de foco</h2>
            <span className="text-[11px] text-muted-foreground">
              {dirty ? "Rascunho · não salvo" : "Plano salvo / sem alterações"}
            </span>
          </div>
          {loading ? (
            <div className="h-48 animate-pulse bg-muted m-5 rounded-xl" />
          ) : items.length ? (
            <div className="divide-y">
              {items.map((item, i) => {
                const task = data.tasks.find((t) => t.id === item.task_id);
                return (
                  <div key={item.task_id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] text-primary">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {task?.title || "Tarefa indisponível — remova este item"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {data.projects.find((p) => p.id === task?.project_id)?.title ||
                            "Sem projeto"}
                        </p>
                      </div>
                      <div className="flex">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Mover para cima"
                          disabled={i === 0 || busy}
                          onClick={() => move(i, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Mover para baixo"
                          disabled={i === items.length - 1 || busy}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Remover do plano"
                          disabled={busy}
                          onClick={() => change(items.filter((_, j) => j !== i))}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    <div className="ml-9 mt-3 flex items-center gap-3">
                      <Input
                        type="time"
                        aria-label={`Horário de ${task?.title}`}
                        value={item.start_time}
                        className="h-8 w-28 text-xs"
                        onChange={(e) =>
                          change(
                            items.map((v, j) =>
                              j === i ? { ...v, start_time: e.target.value } : v,
                            ),
                          )
                        }
                      />
                      <Input
                        type="number"
                        aria-label={`Duração de ${task?.title}`}
                        value={item.duration_minutes}
                        min={5}
                        max={480}
                        className="h-8 w-20 text-xs"
                        onChange={(e) =>
                          change(
                            items.map((v, j) =>
                              j === i ? { ...v, duration_minutes: Number(e.target.value) } : v,
                            ),
                          )
                        }
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty
              title="O dia começa com uma escolha"
              description="Adicione tarefas abaixo ou peça uma sugestão à IA. Você revisa antes de salvar."
            />
          )}
          <div className="space-y-4 border-t p-5">
            <div className="flex items-center gap-2">
              <Plus size={16} />
              <Select
                aria-label="Adicionar tarefa ao plano"
                value=""
                disabled={busy || loading}
                onChange={(e) => {
                  if (e.target.value) {
                    const next = [
                      ...items,
                      { task_id: e.target.value, start_time: "09:00", duration_minutes: 60 },
                    ];
                    change(reflow(next));
                  }
                }}
              >
                <option value="">Adicionar uma tarefa…</option>
                {tasks
                  .filter((t) => !items.some((i) => i.task_id === t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                {items.reduce((sum, i) => sum + i.duration_minutes, 0)} min planejados · as tarefas
                não serão alteradas.
              </p>
              <Button disabled={!dirty || busy || loading} onClick={() => void save()}>
                <Check />
                Aceitar e salvar
              </Button>
            </div>
          </div>
        </section>
        <section>
          <h2 className="mb-4 text-sm font-semibold">Tarefas para considerar</h2>
          <div className="panel">
            {tasks.length ? (
              <TaskList
                tasks={tasks
                  .filter((t) => !t.due_date || t.due_date <= day || t.priority === "urgent")
                  .slice(0, 15)}
                compact
              />
            ) : (
              <Empty
                title="Tudo em dia"
                description="Quando surgirem novos passos, eles aparecerão aqui."
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
