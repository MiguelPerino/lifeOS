"use client";
import { useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Input, Field, Select } from "./ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import {
  categories,
  expenseSchema,
  goalSchema,
  money,
  moneyInput,
  parseMoney,
  type Expense,
  type Goal,
  type FinanceCommand,
  type FinanceRequest,
} from "@/domain/finances";
import { api } from "@/lib/client-api";
import { localDay } from "@/lib/utils";

export function useFinanceWrite() {
  const pending = useRef<{ fingerprint: string; request: FinanceRequest } | null>(null);
  return async (command: FinanceCommand) => {
    const fingerprint = JSON.stringify(command);
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = { fingerprint, request: { request_key: crypto.randomUUID(), command } };
    await api("/api/finances", pending.current.request);
    pending.current = null;
  };
}
export type FinanceEditorValue =
  | { type: "expense"; record?: Expense }
  | { type: "goal"; record?: Goal }
  | { type: "contribution"; record: Goal };

export function FinanceEditor({
  value,
  onClose,
  onSaved,
}: {
  value: FinanceEditorValue;
  onClose: () => void;
  onSaved: (message: string, expenseDay?: string) => void;
}) {
  const expense = value.type === "expense" ? value.record : undefined;
  const goal = value.type === "goal" ? value.record : undefined;
  const [id] = useState(() => expense?.id || goal?.id || crypto.randomUUID());
  const [title, setTitle] = useState(expense?.description || goal?.title || "");
  const [amount, setAmount] = useState(
    expense ? moneyInput(expense.amount_cents) : goal ? moneyInput(goal.target_cents) : "",
  );
  const [category, setCategory] = useState<Expense["category"]>(expense?.category || "Outros");
  const [day, setDay] = useState(expense?.spent_on || localDay());
  const [withdraw, setWithdraw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const write = useFinanceWrite();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const cents = parseMoney(amount);
      if (value.type === "expense")
        await write({
          action: "expense_save",
          payload: expenseSchema.parse({
            id,
            description: title,
            amount_cents: cents,
            category,
            spent_on: day,
          }),
        });
      else if (value.type === "goal")
        await write({
          action: "goal_save",
          payload: goalSchema.parse({ id, title, target_cents: cents }),
        });
      else
        await write({
          action: "contribution_add",
          payload: {
            id,
            goal_id: value.record.id,
            amount_cents: withdraw ? -cents : cents,
            saved_on: day,
          },
        });
      onSaved(
        value.type === "expense"
          ? "Gasto salvo."
          : value.type === "goal"
            ? "Meta salva."
            : withdraw
              ? "Retirada registrada."
              : "Mais um passo para sua meta!",
        value.type === "expense" ? day : undefined,
      );
      onClose();
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "ZodError" ? e.message : "Confira os campos informados.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle className="text-xl font-semibold">
          {value.type === "expense"
            ? expense
              ? "Editar gasto"
              : "Novo gasto"
            : value.type === "goal"
              ? goal
                ? "Editar meta"
                : "Nova meta"
              : value.record.title}
        </DialogTitle>
        <DialogDescription className="mb-6 mt-2 text-sm text-muted-foreground">
          {value.type === "expense"
            ? "Registre o que saiu do seu bolso."
            : value.type === "goal"
              ? "Dê um nome ao que você quer conquistar e escolha o valor."
              : `Você já guardou ${money(value.record.saved_cents)}. Reservas não entram nos gastos.`}
        </DialogDescription>
        <form onSubmit={submit} className="space-y-5">
          <fieldset disabled={busy} className="space-y-5">
            {value.type !== "contribution" && (
              <Field label={value.type === "expense" ? "Descrição" : "Nome da meta"}>
                <Input
                  autoFocus
                  required
                  maxLength={value.type === "expense" ? 200 : 100}
                  placeholder={value.type === "expense" ? "Almoço" : "Meu PC"}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
            )}
            {value.type === "contribution" && (
              <Field label="Movimentação">
                <Select
                  value={withdraw ? "withdraw" : "add"}
                  onChange={(e) => setWithdraw(e.target.value === "withdraw")}
                >
                  <option value="add">Guardar dinheiro</option>
                  <option value="withdraw">Retirar dinheiro</option>
                </Select>
              </Field>
            )}
            <Field label={value.type === "goal" ? "Quanto quero juntar (R$)" : "Valor (R$)"}>
              <Input
                inputMode="decimal"
                required
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                maxLength={20}
              />
            </Field>
            {value.type === "expense" && (
              <Field label="Categoria">
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Expense["category"])}
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            )}
            {value.type !== "goal" && (
              <Field label="Data">
                <Input type="date" required value={day} onChange={(e) => setDay(e.target.value)} />
              </Field>
            )}
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" />}
              {busy ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
