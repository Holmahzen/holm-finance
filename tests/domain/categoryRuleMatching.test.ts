import { describe, it, expect } from "vitest";
import { matchEntriesToRules } from "@/domain/categoryRuleMatching";

describe("matchEntriesToRules", () => {
  it("matches an entry whose description contains the rule keyword", () => {
    const result = matchEntriesToRules(
      [{ id: "e1", description: "COMPRAS NACIONAIS - LOJA X" }],
      [{ id: "r1", keyword: "COMPRAS", categoryId: "cat-socio" }],
    );
    expect(result).toEqual([{ entryId: "e1", categoryId: "cat-socio", ruleId: "r1" }]);
  });

  it("is case-insensitive", () => {
    const result = matchEntriesToRules(
      [{ id: "e1", description: "compras nacionais" }],
      [{ id: "r1", keyword: "COMPRAS", categoryId: "cat-socio" }],
    );
    expect(result).toHaveLength(1);
  });

  it("skips entries with no matching rule", () => {
    const result = matchEntriesToRules(
      [{ id: "e1", description: "Aluguel do galpão" }],
      [{ id: "r1", keyword: "COMPRAS", categoryId: "cat-socio" }],
    );
    expect(result).toEqual([]);
  });

  it("uses the first matching rule when more than one keyword matches", () => {
    const result = matchEntriesToRules(
      [{ id: "e1", description: "COMPRAS NACIONAIS CARTAO" }],
      [
        { id: "r1", keyword: "CARTAO", categoryId: "cat-cartao" },
        { id: "r2", keyword: "COMPRAS", categoryId: "cat-socio" },
      ],
    );
    expect(result).toEqual([{ entryId: "e1", categoryId: "cat-cartao", ruleId: "r1" }]);
  });

  it("returns no matches when there are no rules", () => {
    expect(matchEntriesToRules([{ id: "e1", description: "Qualquer coisa" }], [])).toEqual([]);
  });
});
