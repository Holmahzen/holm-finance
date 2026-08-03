import { describe, it, expect } from "vitest";
import { parseBulkProductPaste } from "@/domain/bulkProductPaste";

describe("parseBulkProductPaste", () => {
  it("parses a well-formed tab-separated line", () => {
    const { rows, errors } = parseBulkProductPaste("ABC123\tCamiseta Branca\t42,29\t7,90\t3,20\t1,50");
    expect(errors).toHaveLength(0);
    expect(rows).toEqual([
      { sku: "ABC123", name: "Camiseta Branca", salePrice: 42.29, tecidoCost: 7.9, costuraCost: 3.2, aviamentosCost: 1.5 },
    ]);
  });

  it("parses multiple lines", () => {
    const text = ["A1\tProduto A\t100\t10\t5\t2", "A2\tProduto B\t50\t5\t2\t1"].join("\n");
    const { rows, errors } = parseBulkProductPaste(text);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ sku: "A2", name: "Produto B", salePrice: 50 });
  });

  it("defaults missing cost columns to zero", () => {
    const { rows, errors } = parseBulkProductPaste("A1\tProduto A\t100");
    expect(errors).toHaveLength(0);
    expect(rows[0]).toMatchObject({ tecidoCost: 0, costuraCost: 0, aviamentosCost: 0 });
  });

  it("handles thousand separator + decimal comma (1.234,56)", () => {
    const { rows } = parseBulkProductPaste("A1\tProduto A\t1.234,56\t0\t0\t0");
    expect(rows[0].salePrice).toBeCloseTo(1234.56);
  });

  it("handles a plain dot decimal (US-style spreadsheet)", () => {
    const { rows } = parseBulkProductPaste("A1\tProduto A\t42.29\t0\t0\t0");
    expect(rows[0].salePrice).toBeCloseTo(42.29);
  });

  it("strips a currency symbol pasted along with the number", () => {
    const { rows } = parseBulkProductPaste("A1\tProduto A\tR$ 42,29\t0\t0\t0");
    expect(rows[0].salePrice).toBeCloseTo(42.29);
  });

  it("skips a recognizable header row", () => {
    const text = ["SKU\tNome\tPreço\tTecido\tCostura\tAviamentos", "A1\tProduto A\t100\t10\t5\t2"].join("\n");
    const { rows, errors } = parseBulkProductPaste(text);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].sku).toBe("A1");
  });

  it("reports an error for a missing SKU", () => {
    const { rows, errors } = parseBulkProductPaste("\tProduto A\t100\t0\t0\t0");
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/SKU vazio/);
  });

  it("reports an error for a missing name", () => {
    const { rows, errors } = parseBulkProductPaste("A1\t\t100\t0\t0\t0");
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/nome vazio/);
  });

  it("reports an error for an invalid price", () => {
    const { rows, errors } = parseBulkProductPaste("A1\tProduto A\tabc\t0\t0\t0");
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/preço inválido/);
  });

  it("continues parsing subsequent lines after an error", () => {
    const text = ["A1\t\t100\t0\t0\t0", "A2\tProduto B\t50\t5\t2\t1"].join("\n");
    const { rows, errors } = parseBulkProductPaste(text);
    expect(errors).toHaveLength(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].sku).toBe("A2");
  });

  it("ignores blank lines", () => {
    const text = ["A1\tProduto A\t100\t0\t0\t0", "", "  ", "A2\tProduto B\t50\t0\t0\t0"].join("\n");
    const { rows } = parseBulkProductPaste(text);
    expect(rows).toHaveLength(2);
  });

  it("returns empty result for empty input", () => {
    const { rows, errors } = parseBulkProductPaste("");
    expect(rows).toEqual([]);
    expect(errors).toEqual([]);
  });
});
