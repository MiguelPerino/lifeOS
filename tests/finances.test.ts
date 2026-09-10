import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseMoney, financeQuerySchema, expenseSchema } from "@/domain/finances";
const model = vi.hoisted(() => ({ generateStructured: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai", () => ({ getAIProvider: () => model }));
import { interpretExpense } from "@/services/finances";

describe("financial amounts and periods", () => {
  it.each([
    ["42", 4200],
    ["0,01", 1],
    ["42,50", 4250],
    ["42.50", 4250],
    ["R$ 1.234,56", 123456],
    ["1.000", 100000],
    ["0.29", 29],
  ])("parses %s without floating point rounding", (input, cents) => {
    expect(parseMoney(input)).toBe(cents);
  });
  it.each(["", "0", "-10", "1e3", "12,345", "1.00.00", "NaN", "1000001", "42 reais"])(
    "rejects invalid amount %s",
    (input) => {
      expect(() => parseMoney(input)).toThrow();
    },
  );
  it("rejects impossible dates, unknown categories and fractions of cents", () => {
    const expense = {
      id: crypto.randomUUID(),
      description: "Almoço",
      amount_cents: 4200,
      category: "Alimentação",
      spent_on: "2026-09-10",
    };
    expect(expenseSchema.safeParse(expense).success).toBe(true);
    for (const patch of [
      { spent_on: "2026-02-30" },
      { category: "Inventada" },
      { amount_cents: 42.5 },
    ])
      expect(expenseSchema.safeParse({ ...expense, ...patch }).success).toBe(false);
    expect(financeQuerySchema.safeParse({ month: "2026-13", day: "2026-09-10" }).success).toBe(
      false,
    );
    expect(financeQuerySchema.parse({ month: "2026-12", day: "2026-12-31" }).page).toBe(0);
  });
});
describe("expense interpretation", () => {
  beforeEach(() => model.generateStructured.mockReset());
  it("converts a structured expense to cents and supplies the local day", async () => {
    model.generateStructured.mockResolvedValue({
      description: "Almoço",
      amount: "42.50",
      category: "Alimentação",
      spent_on: "2026-09-10",
      clarification: null,
    });
    expect(await interpretExpense("Gastei 42,50 no almoço", "2026-09-10")).toEqual({
      description: "Almoço",
      amount_cents: 4250,
      category: "Alimentação",
      spent_on: "2026-09-10",
    });
    expect(model.generateStructured.mock.calls[0][0]).toContain("2026-09-10");
  });
  it("does not manufacture a transaction when clarification is needed", async () => {
    model.generateStructured.mockResolvedValue({
      description: "Almoço",
      amount: null,
      category: "Alimentação",
      spent_on: "2026-09-10",
      clarification: "Quanto você gastou?",
    });
    await expect(interpretExpense("Gastei no almoço", "2026-09-10")).rejects.toThrow(
      "Quanto você gastou?",
    );
  });
  it("rejects missing dates and malformed monetary output", async () => {
    model.generateStructured.mockResolvedValue({
      description: "Almoço",
      amount: "42",
      category: "Alimentação",
      spent_on: null,
      clarification: null,
    });
    await expect(interpretExpense("Gastei 42", "2026-09-10")).rejects.toThrow();
    model.generateStructured.mockResolvedValue({
      description: "Almoço",
      amount: "1e6",
      category: "Alimentação",
      spent_on: "2026-09-10",
      clarification: null,
    });
    await expect(interpretExpense("Gastei 42", "2026-09-10")).rejects.toThrow();
  });
});
