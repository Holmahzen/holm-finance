import { describe, it, expect } from "vitest";
import { guessServiceCategoryName, serviceInvoiceDedupeKey } from "@/domain/serviceInvoices";

describe("guessServiceCategoryName", () => {
  it("reconhece corte e enfesto", () => {
    expect(guessServiceCategoryName("Cortador e enfestador", "")).toBe(
      "Corte diretamente ligado à produção",
    );
  });

  it("reconhece costura e alfaiataria pela descrição tributária", () => {
    expect(
      guessServiceCategoryName(
        "",
        "Alfaiataria e costura, quando o material for fornecido pelo usuário final, exceto aviamento.",
      ),
    ).toBe("Costura");
  });

  it("reconhece bordado, caseado, estamparia e passadoria", () => {
    expect(guessServiceCategoryName("Serviço de bordado", "")).toBe("Bordado");
    expect(guessServiceCategoryName("Caseado de botão", "")).toBe("Caseado");
    expect(guessServiceCategoryName("Estamparia digital", "")).toBe("Estamparia");
    expect(guessServiceCategoryName("Passadoria de peças", "")).toBe("Passadoria");
  });

  it("volta null quando nada bate, pra revisão manual", () => {
    expect(guessServiceCategoryName("Serviço de limpeza", "")).toBeNull();
  });
});

describe("serviceInvoiceDedupeKey", () => {
  const base = {
    providerDocument: "42402730000169",
    documentNumber: "2",
    issuedOn: new Date(Date.UTC(2026, 8, 14)),
    amount: 4000,
  };

  it("usa a chave de acesso quando presente", () => {
    expect(serviceInvoiceDedupeKey({ ...base, accessKey: "355030822424027300001690000000000002260971188" })).toBe(
      "355030822424027300001690000000000002260971188",
    );
  });

  it("cai em prestador+numero+data+valor sem chave de acesso", () => {
    expect(serviceInvoiceDedupeKey({ ...base, accessKey: "" })).toBe(
      "42402730000169|2|2026-09-14|4000.00",
    );
  });
});
