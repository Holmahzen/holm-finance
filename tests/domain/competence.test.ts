import { describe, it, expect } from "vitest";
import { competenceDateFromMonth } from "@/domain/competence";
import { DomainError } from "@/domain/errors";

describe("competenceDateFromMonth", () => {
  it("devolve o dia 1 ao meio-dia UTC do mês informado", () => {
    expect(competenceDateFromMonth("2026-09").toISOString()).toBe("2026-09-01T12:00:00.000Z");
    expect(competenceDateFromMonth("2026-12").toISOString()).toBe("2026-12-01T12:00:00.000Z");
  });

  it("rejeita formatos inválidos", () => {
    for (const bad of ["2026-13", "2026-00", "26-09", "2026/09", "2026-9", "", "setembro"]) {
      expect(() => competenceDateFromMonth(bad)).toThrow(DomainError);
    }
  });
});
