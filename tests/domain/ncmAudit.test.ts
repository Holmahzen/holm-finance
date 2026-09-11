import { describe, it, expect } from "vitest";
import {
  buildNcmAudit,
  formatNcm,
  ncmFlagsFor,
  productBaseName,
  type NcmAuditRow,
} from "@/domain/ncmAudit";

function row(overrides: Partial<NcmAuditRow> = {}): NcmAuditRow {
  return {
    productCode: "JACA1002G",
    description: "JALECO CAVADO - G - AZUL MARINHO",
    ncm: "62113300",
    cfop: "6105",
    netValue: 50,
    quantity: 1,
    issuerName: "Holm Confeccoes",
    issuedOn: "2026-09-01",
    ...overrides,
  };
}

const codes = (name: string, ncm: string) => ncmFlagsFor(productBaseName(name), ncm).map((f) => f.code);

describe("productBaseName", () => {
  it("tira tamanho e cor, com ou sem espaço antes do traço", () => {
    expect(productBaseName("JALECO CAVADO - G - AZUL MARINHO")).toBe("JALECO CAVADO");
    expect(productBaseName("TOUCA REDE- PRETO")).toBe("TOUCA REDE");
    expect(productBaseName("Calça Branca Uniforme")).toBe("CALCA BRANCA UNIFORME");
  });
});

describe("ncmFlagsFor", () => {
  it("marca o 6309, de artigos usados", () => {
    expect(codes("BATA KAFTA - BRANCA", "63090010")).toContain("NCM_DE_USADO");
  });

  it("marca peça masculina em posição feminina e o contrário", () => {
    expect(codes("CONJUNTO BRANCO MASCULINO UMBANDA", "62046300")).toContain("MASCULINO_EM_FEMININO");
    expect(codes("BATA FEMININA", "61059000")).toContain("FEMININO_EM_MASCULINO");
    expect(codes("CONJUNTO BRANCO MASCULINO", "62034200")).not.toContain("MASCULINO_EM_FEMININO");
  });

  it("marca touca fora do capítulo 65, mais brando quando é kit misto", () => {
    const touca = ncmFlagsFor(productBaseName("TOUCA REDE- PRETO"), "61059000");
    expect(touca).toMatchObject([{ code: "CHAPEU_FORA_DO_65", severity: "alta" }]);
    const kit = ncmFlagsFor(productBaseName("2X CAMISETA + CHAPEU ZE PILINTRA"), "61046900");
    expect(kit).toMatchObject([{ code: "CHAPEU_FORA_DO_65", severity: "conferir" }]);
    expect(codes("TOUCA REDE", "65050029")).toEqual([]);
  });

  it("confere saia, calça, camiseta e jaleco fora da posição de costume, mas não em kit", () => {
    expect(codes("SAIA 3 METROS RODA", "61046900")).toContain("SAIA_FORA");
    expect(codes("SAIA 3 METROS RODA", "61045300")).toEqual([]);
    expect(codes("CALCA PARA TRABALHO ACOUGUEIRO", "61059000")).toContain("CALCA_FORA");
    expect(codes("CALCA BRANCA", "62034200")).toEqual([]);
    expect(codes("CAMISETA ORIXA", "61091000")).toEqual([]);
    expect(codes("CAMISETA ORIXA", "61059000")).toContain("CAMISETA_FORA");
    expect(codes("AVENTAL JALECO DE PROFESSORA", "61059000")).toContain("JALECO_AVENTAL");
    expect(codes("CONJUNTO UNIFORME C/ CALCA BABA", "62046200")).toEqual([]);
  });

  it("marca tecido plano no capítulo de malha e malha no de tecido plano", () => {
    expect(codes("CALCA OXFORD", "61059000")).toContain("TECIDO_PLANO_EM_MALHA");
    expect(ncmFlagsFor(productBaseName("CALCA OXFORD"), "61059000")[0].message).toContain("oxford");
    expect(codes("CALCA OXFORD", "62034200")).toEqual([]);
    expect(codes("CAMISETA MALHA PENTEADA", "62052000")).toContain("MALHA_EM_TECIDO_PLANO");
    expect(codes("CAMISETA MALHA PENTEADA", "61091000")).toEqual([]);
  });
});

describe("buildNcmAudit", () => {
  const rows = [
    row({ description: "TOUCA REDE- PRETO", ncm: "61059000", netValue: 30, productCode: "TR1" }),
    row({ description: "TOUCA REDE- BRANCO", ncm: "63090010", netValue: 20, productCode: "TR2", issuerName: "REGIMAR SOUZA SILVA LTDA" }),
    row({ description: "TOUCA REDE - AZUL", ncm: "65050029", netValue: 10, productCode: "TR3", issuedOn: "2026-09-10" }),
    row({ netValue: 500 }),
    row({ description: "PECA DEVOLVIDA", ncm: "63090010", cfop: "5949", netValue: 999 }),
  ];

  it("junta variações do mesmo produto e mostra cada NCM com quem emitiu", () => {
    const audit = buildNcmAudit(rows);
    const touca = audit.products.find((p) => p.name === "TOUCA REDE")!;
    expect(touca.ncms.map((n) => n.ncm)).toEqual(["61059000", "63090010", "65050029"]);
    expect(touca.ncms[1].issuers).toEqual(["REGIMAR SOUZA SILVA LTDA"]);
    expect(touca.flags.map((f) => f.code)).toEqual(["VARIOS_NCM", "CHAPEU_FORA_DO_65", "NCM_DE_USADO", "CHAPEU_FORA_DO_65"]);
  });

  it("põe os produtos com alerta primeiro e ignora saída que não é venda", () => {
    const audit = buildNcmAudit(rows);
    expect(audit.products.map((p) => p.name)).toEqual(["TOUCA REDE", "JALECO CAVADO"]);
    expect(audit.totals).toMatchObject({ products: 2, flaggedProducts: 1, value: 560, flaggedValue: 60, ncms: 4 });
    expect(audit.totals.lastSale).toBe("2026-09-10");
    expect(audit.byNcm.find((n) => n.ncm === "62113300")).toMatchObject({ products: 1, flaggedProducts: 0 });
  });

  it("lista primeiro o que tem algo a revisar, mesmo vendendo menos", () => {
    const audit = buildNcmAudit([
      row({ description: "SAIA RODA - BRANCA", ncm: "61046900", netValue: 900 }),
      row({ description: "TOUCA REDE - PRETO", ncm: "61059000", netValue: 10 }),
      row({ description: "CAMISETA ORIXA - G", ncm: "61091000", netValue: 5000 }),
    ]);
    expect(audit.products.map((p) => p.name)).toEqual(["TOUCA REDE", "SAIA RODA", "CAMISETA ORIXA"]);
  });

  it("formata o NCM com pontos", () => {
    expect(formatNcm("61059000")).toBe("6105.90.00");
  });
});
