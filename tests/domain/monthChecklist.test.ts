import { describe, it, expect } from "vitest";
import { coverageStatus, coveredDays, daysExpected, monthWindow, summarize } from "@/domain/monthChecklist";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("monthWindow", () => {
  it("mês fechado espera até o último dia", () => {
    const w = monthWindow("2026-09", d("2026-10-02"));
    expect(w.inProgress).toBe(false);
    expect(w.lastExpectedDay).toEqual(d("2026-09-30"));
  });

  it("mês em andamento espera até ontem", () => {
    const w = monthWindow("2026-10", d("2026-10-15"));
    expect(w.inProgress).toBe(true);
    expect(w.lastExpectedDay).toEqual(d("2026-10-14"));
  });
});

describe("coverageStatus", () => {
  const w = monthWindow("2026-09", d("2026-10-02"));

  it("ok quando chega no fim do mês (aceita um dia antes)", () => {
    expect(coverageStatus(d("2026-09-29"), w).status).toBe("ok");
    expect(coverageStatus(d("2026-10-05"), w).status).toBe("ok");
  });

  it("parcial quando para no meio do mês", () => {
    const r = coverageStatus(d("2026-09-15"), w);
    expect(r.status).toBe("parcial");
    expect(r.detail).toContain("15/09");
  });

  it("pendente sem nada do mês", () => {
    expect(coverageStatus(null, w).status).toBe("pendente");
    expect(coverageStatus(d("2026-08-31"), w).status).toBe("pendente");
  });

  it("aguardando no primeiro dia de um mês em andamento", () => {
    expect(coverageStatus(null, monthWindow("2026-10", d("2026-10-01"))).status).toBe("aguardando");
  });
});

describe("coveredDays", () => {
  const w = monthWindow("2026-09", d("2026-10-02"));

  it("junta períodos sem contar o mesmo dia duas vezes e corta fora do mês", () => {
    const periods = [
      { start: d("2026-08-20"), end: d("2026-09-10") },
      { start: d("2026-09-05"), end: d("2026-09-20") },
    ];
    expect(coveredDays(periods, w)).toBe(20);
    expect(daysExpected(w)).toBe(30);
  });
});

describe("summarize", () => {
  it("não conta o que ainda está aguardando", () => {
    const base = { group: "Importações" as const, title: "", detail: "", href: "/" };
    const s = summarize([
      { ...base, key: "a", status: "ok" },
      { ...base, key: "b", status: "parcial" },
      { ...base, key: "c", status: "aguardando" },
    ]);
    expect(s).toEqual({ done: 1, total: 2, pending: 1 });
  });
});
