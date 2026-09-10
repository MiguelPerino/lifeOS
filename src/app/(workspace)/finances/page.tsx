"use client";
import { useEffect, useState } from "react";
import {
  Plus,
  Sparkles,
  LoaderCircle,
  Wallet,
  PiggyBank,
  Pencil,
  Trash2,
  ArrowRight,
  Undo2,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeading, Empty } from "@/components/page-parts";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  FinanceEditor,
  useFinanceWrite,
  type FinanceEditorValue,
} from "@/components/finance-editor";
import { FinanceCharts } from "@/components/finance-charts";
import { useWorkspace } from "@/components/workspace-provider";
import {
  categories,
  expenseSchema,
  money,
  type Expense,
  type FinanceData,
  type FinanceCommand,
} from "@/domain/finances";
import { api } from "@/lib/client-api";
import { localDay, dateLabel } from "@/lib/utils";

export default function FinancesPage() {
  const { data: workspace } = useWorkspace();
  const [month, setMonth] = useState(() => localDay().slice(0, 7));
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<FinanceData | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [editor, setEditor] = useState<FinanceEditorValue>();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [lastExpense, setLastExpense] = useState<Expense>();
  const [deletion, setDeletion] = useState<{
    type: "expense" | "goal";
    id: string;
    title: string;
  }>();
  const [deleteError, setDeleteError] = useState("");
  const [pendingCapture, setPendingCapture] = useState<Expense | null>(null);
  const write = useFinanceWrite();
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ month, day: localDay(), category, page: String(page) });
    api<FinanceData>(`/api/finances?${params}`)
      .then((result) => {
        if (active) {
          setData(result);
          setError("");
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : "Não foi possível carregar suas finanças.");
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [month, category, page, revision]);

  function reload() {
    setRefreshing(true);
    setRevision((v) => v + 1);
  }
  function saved(message: string, spentOn?: string) {
    toast.success(message);
    if (spentOn) {
      setMonth(spentOn.slice(0, 7));
      setCategory("all");
      setPage(0);
    }
    reload();
  }
  async function capture(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setCaptureError("");
    try {
      // Preserve both the interpreted payload and its key if the write response is lost.
      let expense = pendingCapture;
      if (!expense) {
        const interpreted = await api<Omit<Expense, "id">>("/api/finances/interpret", {
          text,
          day: localDay(),
        });
        expense = expenseSchema.parse({ ...interpreted, id: crypto.randomUUID() });
        setPendingCapture(expense);
      }
      await write({ action: "expense_save", payload: expense });
      setLastExpense(expense);
      setPendingCapture(null);
      setText("");
      saved(`${money(expense.amount_cents)} em ${expense.category}.`, expense.spent_on);
    } catch (e) {
      setCaptureError(e instanceof Error ? e.message : "Não foi possível registrar o gasto.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deletion || busy) return;
    setBusy(true);
    setDeleteError("");
    try {
      const command: FinanceCommand = {
        action: deletion.type === "expense" ? "expense_delete" : "goal_delete",
        payload: { id: deletion.id },
      };
      await write(command);
      if (lastExpense?.id === deletion.id) setLastExpense(undefined);
      setDeletion(undefined);
      setPage(0);
      saved("Registro removido.");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Não foi possível remover.");
    } finally {
      setBusy(false);
    }
  }
  function confirmDelete(value: NonNullable<typeof deletion>) {
    setDeleteError("");
    setDeletion(value);
  }
  const reserved = data?.goals.reduce((sum, g) => sum + g.saved_cents, 0) || 0;
  return (
    <div className="page-enter space-y-7">
      <PageHeading
        eyebrow="UM POUCO MAIS DE CONTROLE"
        title="Finanças"
        description="Acompanhe seus gastos e guarde para o que você quer conquistar."
        action={
          <Button
            disabled={busy || refreshing || !data}
            onClick={() => setEditor({ type: "expense" })}
          >
            <Plus />
            Novo gasto
          </Button>
        }
      />
      <form onSubmit={capture} className="panel p-5">
        <label
          htmlFor="finance-capture"
          className="mb-3 flex items-center gap-2 text-sm font-medium"
        >
          <Sparkles size={17} className="text-primary" />
          Conte seu gasto
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="finance-capture"
            value={text}
            maxLength={1000}
            disabled={busy || Boolean(pendingCapture) || !workspace.aiEnabled}
            onChange={(e) => setText(e.target.value)}
            placeholder="Gastei 42 reais no almoço hoje"
          />
          <Button
            disabled={busy || refreshing || !data || !workspace.aiEnabled || text.trim().length < 3}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
            {busy ? "Registrando…" : pendingCapture ? "Tentar salvar novamente" : "Registrar gasto"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {workspace.aiEnabled
            ? "Escreva um gasto por vez. A IA organiza e salva; você pode corrigir ou desfazer depois."
            : "A IA está desativada. Você pode registrar seus gastos pelo botão Novo gasto."}
        </p>
        {captureError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {captureError}
          </p>
        )}
        {lastExpense && (
          <div
            role="status"
            className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4 text-sm"
          >
            <Check size={16} className="text-primary" />
            <span>
              {lastExpense.description} · {money(lastExpense.amount_cents)} ·{" "}
              {dateLabel(lastExpense.spent_on)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setEditor({ type: "expense", record: lastExpense })}
            >
              <Pencil />
              Corrigir
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                confirmDelete({
                  type: "expense",
                  id: lastExpense.id,
                  title: lastExpense.description,
                })
              }
            >
              <Undo2 />
              Desfazer
            </Button>
          </div>
        )}
      </form>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-2 text-xs text-muted-foreground">
          Mês
          <Input
            aria-label="Mês dos gastos"
            type="month"
            value={month}
            disabled={busy || refreshing}
            onChange={(e) => {
              if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) return;
              setMonth(e.target.value);
              setPage(0);
              setData(null);
            }}
          />
        </label>
        <label className="grid gap-2 text-xs text-muted-foreground">
          Categoria
          <Select
            aria-label="Filtrar categoria"
            value={category}
            disabled={busy || refreshing}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
              setData(null);
            }}
          >
            <option value="all">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </label>
        <Button variant="ghost" disabled={busy || refreshing} onClick={reload}>
          {refreshing && <LoaderCircle className="animate-spin" />}Atualizar
        </Button>
      </div>
      {error && (
        <div role="alert" className="panel p-5 text-sm">
          <p className="text-destructive">{error}</p>
          <Button className="mt-3" variant="outline" onClick={reload} disabled={refreshing}>
            Tentar novamente
          </Button>
        </div>
      )}
      {!data && !error && (
        <div className="grid animate-pulse gap-4 sm:grid-cols-3" aria-label="Carregando finanças">
          {[1, 2, 3].map((n) => (
            <div className="h-28 rounded-xl bg-muted" key={n} />
          ))}
        </div>
      )}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Gastos de hoje",
                amount: data.today_cents,
                detail: "Todas as categorias, na data de hoje",
                icon: Wallet,
              },
              {
                label: "Gastos no mês",
                amount: data.month_cents,
                detail: `${data.count} gasto(s) · ${category === "all" ? "todas as categorias" : category}`,
                icon: Wallet,
              },
              {
                label: "Guardado nas metas",
                amount: reserved,
                detail: "Reservas separadas dos seus gastos",
                icon: PiggyBank,
              },
            ].map((card) => (
              <section key={card.label} className="panel min-w-0 p-5">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{card.label}</span>
                  <card.icon size={17} />
                </div>
                <p
                  className="mt-4 break-words text-2xl font-semibold tracking-tight tabular-nums"
                  data-testid={card.label === "Gastos no mês" ? "month-total" : undefined}
                >
                  {money(card.amount)}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">{card.detail}</p>
              </section>
            ))}
          </div>
          <FinanceCharts data={data} month={month} />
          <section className="panel">
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-sm font-semibold">Seus gastos</h2>
              <span className="text-xs text-muted-foreground">{data.count} registro(s)</span>
            </div>
            {data.expenses.length ? (
              <div className="divide-y">
                {data.expenses.map((expense) => (
                  <article
                    key={expense.id}
                    className="flex flex-wrap items-center gap-3 p-4 sm:p-5"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-sm font-medium">{expense.description}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {expense.category} · {dateLabel(expense.spent_on)}
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {money(expense.amount_cents)}
                    </span>
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${expense.description}`}
                        disabled={busy || refreshing}
                        onClick={() => {
                          setLastExpense(undefined);
                          setEditor({ type: "expense", record: expense });
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir ${expense.description}`}
                        disabled={busy || refreshing}
                        onClick={() =>
                          confirmDelete({
                            type: "expense",
                            id: expense.id,
                            title: expense.description,
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title="Seu controle começa com um gasto"
                description="Registre um gasto ou escolha outro período para consultar."
              />
            )}
            {data.count > 20 && (
              <div className="flex items-center justify-between border-t p-4">
                <Button
                  variant="ghost"
                  disabled={page === 0 || busy || refreshing}
                  onClick={() => {
                    setPage((p) => p - 1);
                    setData(null);
                  }}
                >
                  <ChevronLeft />
                  Anterior
                </Button>
                <span className="text-xs">
                  {page + 1} / {Math.ceil(data.count / 20)}
                </span>
                <Button
                  variant="ghost"
                  disabled={(page + 1) * 20 >= data.count || busy || refreshing}
                  onClick={() => {
                    setPage((p) => p + 1);
                    setData(null);
                  }}
                >
                  Próxima
                  <ChevronRight />
                </Button>
              </div>
            )}
          </section>
          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <PiggyBank size={20} className="text-primary" />
                  Minhas metas
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Seu PC, uma viagem, um sonho. As reservas valem para todos os meses.
                </p>
              </div>
              <Button
                variant="outline"
                disabled={busy || refreshing}
                onClick={() => setEditor({ type: "goal" })}
              >
                <Plus />
                Nova meta
              </Button>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {data.goals.map((goal) => {
                const percentage = Math.min(
                  100,
                  Math.floor((goal.saved_cents / goal.target_cents) * 100),
                );
                return (
                  <article key={goal.id} className="panel min-w-0 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="break-words font-semibold">{goal.title}</h3>
                      <div className="flex shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Editar meta ${goal.title}`}
                          disabled={busy || refreshing}
                          onClick={() => setEditor({ type: "goal", record: goal })}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Excluir meta ${goal.title}`}
                          disabled={busy || refreshing}
                          onClick={() =>
                            confirmDelete({ type: "goal", id: goal.id, title: goal.title })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-4 text-xl font-semibold tabular-nums">
                      {money(goal.saved_cents)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      de {money(goal.target_cents)}
                    </p>
                    <div
                      role="progressbar"
                      aria-label={`Progresso de ${goal.title}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={percentage}
                      className="mb-3 mt-5 h-2 rounded-full bg-muted"
                    >
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between gap-2 text-xs">
                      <span>{percentage}%</span>
                      <span className="text-primary">
                        {goal.saved_cents >= goal.target_cents
                          ? "Meta alcançada!"
                          : `Faltam ${money(goal.target_cents - goal.saved_cents)}`}
                      </span>
                    </div>
                    <Button
                      className="mt-5 w-full"
                      variant="outline"
                      disabled={busy || refreshing}
                      onClick={() => setEditor({ type: "contribution", record: goal })}
                    >
                      <Plus />
                      Adicionar ou retirar valor
                    </Button>
                    {goal.contributions.length > 0 && (
                      <details className="mt-4 border-t pt-3 text-xs">
                        <summary className="cursor-pointer text-muted-foreground">
                          Últimas movimentações (até 10)
                        </summary>
                        <ul className="mt-3 space-y-2">
                          {goal.contributions.map((c) => (
                            <li key={c.id} className="flex justify-between gap-2">
                              <span className="text-muted-foreground">{dateLabel(c.saved_on)}</span>
                              <span>
                                {c.amount_cents > 0 ? "+ " : "− "}
                                {money(Math.abs(c.amount_cents))}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </article>
                );
              })}
            </div>
            {!data.goals.length && (
              <div className="panel">
                <Empty
                  title="O que você quer conquistar?"
                  description="Crie uma meta e acompanhe cada valor que conseguir guardar."
                  action={
                    <Button
                      disabled={busy || refreshing}
                      onClick={() => setEditor({ type: "goal" })}
                    >
                      Criar minha primeira meta
                    </Button>
                  }
                />
              </div>
            )}
          </section>
        </>
      )}
      {editor && (
        <FinanceEditor
          value={editor}
          onClose={() => setEditor(undefined)}
          onSaved={(message, day) => {
            setLastExpense(undefined);
            saved(message, day);
          }}
        />
      )}
      <Dialog
        open={Boolean(deletion)}
        onOpenChange={(open) => {
          if (!open && !busy) setDeletion(undefined);
        }}
      >
        <DialogContent>
          <DialogTitle className="text-lg font-semibold">Remover {deletion?.title}?</DialogTitle>
          <DialogDescription className="my-4 text-sm text-muted-foreground">
            {deletion?.type === "goal"
              ? "A meta e seu histórico de reservas serão removidos. Isso não altera seus gastos nem movimenta dinheiro real."
              : "Este gasto será removido e os totais serão recalculados."}
          </DialogDescription>
          {deleteError && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setDeletion(undefined)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void remove()}>
              {busy && <LoaderCircle className="animate-spin" />}Confirmar exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
