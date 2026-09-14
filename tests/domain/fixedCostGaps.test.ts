import { describe, it, expect } from "vitest";
import { findFixedCostGaps, type FixedCostExpectation } from "@/domain/fixedCostGaps";

const fc = (description: string, category: string | null, amount: number, occurrences = 1, group: FixedCostExpectation["group"] = "DESPESA_ADMINISTRATIVA"): FixedCostExpectation => ({
  description,
  category,
  group,
  amount,
  occurrences,
});

describe("findFixedCostGaps", () => {
  it("aponta categoria sem lançamento, abaixo e acima do cadastro, maior diferença primeiro", () => {
    const gaps = findFixedCostGaps(
      [
        fc("Pro Labore", "Pró-labore", 4000, 1, "DESPESA_PESSOAL"),
        fc("Aluguel 01", "Aluguel", 2850),
        fc("Aluguel 02", "Aluguel", 1000),
        fc("Rick", "Salarios", 1000, 4, "DESPESA_PESSOAL"),
        fc("Mariana", "Salarios", 4500, 1, "DESPESA_PESSOAL"),
        fc("Contabilidade", "Contabilidade", 810),
      ],
      { Aluguel: 1000, Salarios: 16000, Contabilidade: 800 },
    );
    expect(gaps.map((g) => [g.kind, g.category])).toEqual([
      ["acima", "Salarios"],
      ["faltando", "Pró-labore"],
      ["abaixo", "Aluguel"],
    ]);
    expect(gaps.find((g) => g.category === "Aluguel")).toMatchObject({ expected: 3850, launched: 1000, items: ["Aluguel 01", "Aluguel 02"] });
    expect(gaps.find((g) => g.category === "Salarios")?.expected).toBe(8500);
  });

  it("ignora diferença pequena, grupos fora das despesas e avisa custo fixo sem categoria", () => {
    const gaps = findFixedCostGaps(
      [
        fc("Luz 01", "Luz", 80, 1, "DESPESA_PRODUTIVA"),
        fc("Central Importadora", "Tecido", 1392, 1, "CUSTO_MERCADORIA_VENDIDA"),
        fc("Leo", null, 1000, 1, null),
      ],
      {},
    );
    expect(gaps).toEqual([{ kind: "sem-categoria", category: "(sem categoria)", expected: 1000, launched: 0, items: ["Leo"] }]);
  });
});
