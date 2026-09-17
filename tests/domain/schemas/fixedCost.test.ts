import { describe, it, expect } from "vitest";
import { updateFixedCostSchema, createFixedCostSchema } from "@/domain/schemas/fixedCost";

describe("createFixedCostSchema", () => {
  it("defaults frequency to MONTHLY when omitted", () => {
    const parsed = createFixedCostSchema.parse({ description: "Aluguel", amount: 1000 });
    expect(parsed.frequency).toBe("MONTHLY");
  });
});

describe("updateFixedCostSchema", () => {
  it("leaves frequency undefined when omitted, instead of defaulting to MONTHLY", () => {
    // Regressão: um PATCH parcial editando só a descrição de um custo fixo
    // semanal não pode fazer o schema inventar "frequency: MONTHLY" — isso
    // fazia o service exigir "dueDay" (que só existe pra custo mensal) num
    // custo que na verdade é semanal (usa "weekday").
    const parsed = updateFixedCostSchema.parse({ description: "Novo nome" });
    expect(parsed.frequency).toBeUndefined();
  });

  it("still accepts an explicit frequency", () => {
    const parsed = updateFixedCostSchema.parse({ frequency: "WEEKLY", weekday: 5 });
    expect(parsed.frequency).toBe("WEEKLY");
  });
});
