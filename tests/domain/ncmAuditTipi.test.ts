import { describe, it, expect } from "vitest";
import { buildNcmAudit, type NcmAuditRow, type TipiLookup } from "@/domain/ncmAudit";

function row(overrides: Partial<NcmAuditRow> = {}): NcmAuditRow {
  return {
    productCode: "SKU",
    description: "JALECO CAVADO - G",
    ncm: "62113300",
    cfop: "6105",
    netValue: 100,
    quantity: 1,
    issuerName: "Holm Confeccoes",
    issuedOn: "2026-09-01",
    ...overrides,
  };
}

const TIPI: TipiLookup = {
  loaded: true,
  byNcm: new Map([
    ["62113300", { rate: "0", numericRate: 0, description: "Outros vestuários — De fibras sintéticas" }],
    ["63090010", { rate: "NT", numericRate: null, description: "Artigos usados — Vestuário" }],
    ["01012100", { rate: "NT", numericRate: null, description: "Cavalos — Reprodutores de raça pura" }],
    ["22030000", { rate: "6", numericRate: 6, description: "Cervejas de malte" }],
  ]),
};

const ROWS = [
  row({ netValue: 500 }),
  row({ description: "TOUCA REDE - PRETO", ncm: "63090010", netValue: 100 }),
  row({ description: "PRODUTO COM CODIGO INVENTADO", ncm: "99999999", netValue: 50 }),
  row({ description: "PRODUTO TRIBUTADO", ncm: "22030000", netValue: 200 }),
  row({ description: "PRODUTO NT QUALQUER", ncm: "01012100", netValue: 30 }),
];

describe("buildNcmAudit com a TIPI", () => {
  const audit = buildNcmAudit(ROWS, TIPI);
  const produto = (name: string) => audit.products.find((p) => p.name === name)!;
  const codes = (name: string) => produto(name).flags.map((f) => f.code);

  it("traz a alíquota e a descrição oficial em cada NCM", () => {
    expect(produto("JALECO CAVADO").ncms[0]).toMatchObject({
      ipiRate: "0",
      tipiDescription: "Outros vestuários — De fibras sintéticas",
    });
    expect(audit.byNcm.find((n) => n.ncm === "22030000")).toMatchObject({ ipiRate: "6" });
  });

  it("marca como grave o NCM que não existe na tabela", () => {
    const flag = produto("PRODUTO COM CODIGO INVENTADO").flags.find((f) => f.code === "NCM_FORA_DA_TIPI");
    expect(flag).toMatchObject({ severity: "alta" });
    expect(produto("PRODUTO COM CODIGO INVENTADO").ncms[0]).toMatchObject({ ipiRate: null, tipiDescription: null });
  });

  it("pede conferência no NT, sem repetir o alerta de artigos usados do 6309", () => {
    expect(codes("PRODUTO NT QUALQUER")).toContain("NCM_NAO_TRIBUTADO");
    expect(codes("TOUCA REDE")).toContain("NCM_DE_USADO");
    expect(codes("TOUCA REDE")).not.toContain("NCM_NAO_TRIBUTADO");
  });

  it("estima o IPI pela alíquota de cada NCM e conta os códigos fora da tabela", () => {
    expect(audit.totals.ipiEstimate).toBeCloseTo(12, 2); // 200 × 6%
    expect(audit.totals).toMatchObject({ tipiLoaded: true, ncmsOutsideTipi: 1 });
  });
});

describe("buildNcmAudit sem a TIPI", () => {
  it("não avalia nada da tabela", () => {
    const audit = buildNcmAudit(ROWS);
    const flags = audit.products.flatMap((p) => p.flags.map((f) => f.code));
    expect(flags).not.toContain("NCM_FORA_DA_TIPI");
    expect(flags).not.toContain("NCM_NAO_TRIBUTADO");
    expect(audit.totals).toMatchObject({ ipiEstimate: 0, tipiLoaded: false, ncmsOutsideTipi: 0 });
  });
});
