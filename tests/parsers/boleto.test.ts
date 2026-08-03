import { describe, it, expect } from "vitest";
import { extractFromLabels } from "@/parsers/boleto/boletoParser";

describe("extractFromLabels", () => {
  it("extracts amount and due date from a utility-bill-style PDF (barcode font, no digit text)", () => {
    const text = `
      REGIMAR SOUZA SILVA
      Vencimento
      15/08/2026
      Total a pagar R$ 325,53
      (barcode glyphs unreadable here)
    `;
    const parsed = extractFromLabels(text);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe("325.53");
    expect(parsed?.dueDate?.toISOString().slice(0, 10)).toBe("2026-08-15");
    expect(parsed?.source).toBe("texto");
    expect(parsed?.linhaDigitavel).toBeNull();
  });

  it("returns null when there is no recognizable amount label", () => {
    expect(extractFromLabels("nada relevante por aqui")).toBeNull();
  });

  it("still returns the amount even without a recognizable due date label", () => {
    const parsed = extractFromLabels("Total a pagar R$ 42,00");
    expect(parsed?.amount).toBe("42.00");
    expect(parsed?.dueDate).toBeNull();
  });
});
