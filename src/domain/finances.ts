import { z } from "zod";

export const categories = [
  "Alimentação",
  "Transporte",
  "Casa",
  "Saúde",
  "Lazer",
  "Compras",
  "Educação",
  "Outros",
] as const;
export const centsSchema = z.number().int().min(1).max(100000000);
export const expenseSchema = z.object({
  id: z.uuid(),
  description: z.string().trim().min(1, "Descreva o gasto.").max(200),
  amount_cents: centsSchema,
  category: z.enum(categories),
  spent_on: z.iso.date(),
});
export const goalSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Dê um nome à meta.").max(100),
  target_cents: centsSchema,
});
export const financeCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("expense_save"), payload: expenseSchema }),
  z.object({ action: z.literal("expense_delete"), payload: z.object({ id: z.uuid() }) }),
  z.object({ action: z.literal("goal_save"), payload: goalSchema }),
  z.object({ action: z.literal("goal_delete"), payload: z.object({ id: z.uuid() }) }),
  z.object({
    action: z.literal("contribution_add"),
    payload: z.object({
      id: z.uuid(),
      goal_id: z.uuid(),
      amount_cents: z
        .number()
        .int()
        .min(-100000000)
        .max(100000000)
        .refine((v) => v !== 0, "Informe um valor."),
      saved_on: z.iso.date(),
    }),
  }),
]);
export const financeRequestSchema = z.object({
  request_key: z.uuid(),
  command: financeCommandSchema,
});
export const financeQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .refine((v) => z.iso.date().safeParse(`${v}-01`).success),
  day: z.iso.date(),
  category: z.union([z.literal("all"), z.enum(categories)]).default("all"),
  page: z.coerce.number().int().min(0).max(100000).default(0),
});
export const expenseInterpretationSchema = z.object({
  description: z.string().trim().max(200),
  amount: z.string().max(30).nullable(),
  category: z.enum(categories),
  spent_on: z.iso.date().nullable(),
  clarification: z.string().max(400).nullable(),
});
export type Expense = z.infer<typeof expenseSchema>;
export type FinanceCommand = z.infer<typeof financeCommandSchema>;
export type FinanceRequest = z.infer<typeof financeRequestSchema>;
export type Goal = z.infer<typeof goalSchema> & {
  saved_cents: number;
  contributions: { id: string; amount_cents: number; saved_on: string }[];
};
export type FinanceData = {
  today_cents: number;
  month_cents: number;
  count: number;
  days: { day: string; total_cents: number }[];
  categories: { category: string; total_cents: number }[];
  expenses: Expense[];
  goals: Goal[];
};

// Parse decimal text instead of multiplying floating point currency values.
export function parseMoney(input: string): number {
  let value = input.trim().replace(/^R\$\s*/i, "");
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value)) value = value.replaceAll(".", "");
  if (!/^\d+([,.]\d{1,2})?$/.test(value)) throw new Error("Informe um valor como 42,50.");
  const [whole, decimal = ""] = value.replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!centsSchema.safeParse(cents).success)
    throw new Error("Use um valor entre R$ 0,01 e R$ 1.000.000,00.");
  return cents;
}
export function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function moneyInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}
