import { describe, it, expect } from "vitest";
import { allocateAdSpendBySku, overlapShare, ownedShareByReport } from "@/domain/adSpendAllocation";

describe("allocateAdSpendBySku", () => {
  it("da o investimento inteiro ao SKU quando o anuncio so vendeu um SKU no periodo", () => {
    const sales = [{ sku: "A1", listingCode: "MLB1", grossRevenue: 100 }];
    const adSpend = [{ listingCode: "MLB1", investimento: 30 }];
    const result = allocateAdSpendBySku(sales, adSpend);
    expect(result.get("A1")).toBeCloseTo(30);
  });

  it("divide o investimento entre os SKUs de um mesmo anuncio proporcional a receita de cada um", () => {
    const sales = [
      { sku: "P", listingCode: "MLB1", grossRevenue: 100 },
      { sku: "M", listingCode: "MLB1", grossRevenue: 300 },
    ];
    const adSpend = [{ listingCode: "MLB1", investimento: 40 }];
    const result = allocateAdSpendBySku(sales, adSpend);
    expect(result.get("P")).toBeCloseTo(10); // 25% da receita do anuncio
    expect(result.get("M")).toBeCloseTo(30); // 75% da receita do anuncio
  });

  it("soma vendas repetidas do mesmo SKU sob o mesmo anuncio antes de calcular a proporcao", () => {
    const sales = [
      { sku: "P", listingCode: "MLB1", grossRevenue: 50 },
      { sku: "P", listingCode: "MLB1", grossRevenue: 50 },
      { sku: "M", listingCode: "MLB1", grossRevenue: 100 },
    ];
    const adSpend = [{ listingCode: "MLB1", investimento: 20 }];
    const result = allocateAdSpendBySku(sales, adSpend);
    expect(result.get("P")).toBeCloseTo(10); // 100 de 200 = 50%
    expect(result.get("M")).toBeCloseTo(10);
  });

  it("divide igual entre os SKUs quando nenhum teve receita no periodo (ex.: so cancelamento)", () => {
    const sales = [
      { sku: "P", listingCode: "MLB1", grossRevenue: 0 },
      { sku: "M", listingCode: "MLB1", grossRevenue: 0 },
    ];
    const adSpend = [{ listingCode: "MLB1", investimento: 20 }];
    const result = allocateAdSpendBySku(sales, adSpend);
    expect(result.get("P")).toBeCloseTo(10);
    expect(result.get("M")).toBeCloseTo(10);
  });

  it("ignora investimento de anuncio que nao vendeu nenhum SKU no periodo", () => {
    const sales = [{ sku: "A1", listingCode: "MLB1", grossRevenue: 100 }];
    const adSpend = [{ listingCode: "MLB-SEM-VENDA", investimento: 30 }];
    const result = allocateAdSpendBySku(sales, adSpend);
    expect(result.size).toBe(0);
  });

  it("ignora vendas sem codigo de anuncio", () => {
    const sales = [{ sku: "A1", listingCode: null, grossRevenue: 100 }];
    const adSpend = [{ listingCode: "MLB1", investimento: 30 }];
    const result = allocateAdSpendBySku(sales, adSpend);
    expect(result.size).toBe(0);
  });

  it("soma investimentos de multiplas linhas (campanhas diferentes) do mesmo anuncio", () => {
    const sales = [{ sku: "A1", listingCode: "MLB1", grossRevenue: 100 }];
    const adSpend = [
      { listingCode: "MLB1", investimento: 10 },
      { listingCode: "MLB1", investimento: 15 },
    ];
    const result = allocateAdSpendBySku(sales, adSpend);
    expect(result.get("A1")).toBeCloseTo(25);
  });
});

describe("overlapShare", () => {
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  it("relatório do mês inteiro conta inteiro no mês", () => {
    expect(overlapShare(d("2026-09-01"), d("2026-09-30"), d("2026-09-01"), d("2026-10-01"))).toBe(1);
  });

  it("relatório de agosto+setembro conta só os dias de setembro", () => {
    // 31 dias de agosto + 30 de setembro = 61 dias
    expect(overlapShare(d("2026-08-01"), d("2026-09-30"), d("2026-09-01"), d("2026-10-01"))).toBeCloseTo(30 / 61);
  });

  it("relatório fora do período não conta", () => {
    expect(overlapShare(d("2026-08-01"), d("2026-08-31"), d("2026-09-01"), d("2026-10-01"))).toBe(0);
  });
});

describe("ownedShareByReport", () => {
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  const rep = (start: string, end: string, campaignName = "C1", listingCode = "MLB1") => ({
    listingCode,
    campaignName,
    periodStart: d(start),
    periodEnd: d(end),
  });

  it("nao mexe em relatorios que nao se sobrepoem", () => {
    const shares = ownedShareByReport([rep("2026-07-01", "2026-07-31"), rep("2026-08-01", "2026-08-31")]);
    expect(shares).toEqual([1, 1]);
  });

  it("zera o relatorio contido em outro e corta o trecho repetido (caso real de setembro/2026)", () => {
    // 01–17, 01–20 e 17–29 do mesmo anuncio.
    const shares = ownedShareByReport([
      rep("2026-09-01", "2026-09-17"),
      rep("2026-09-01", "2026-09-20"),
      rep("2026-09-17", "2026-09-29"),
    ]);
    expect(shares[2]).toBeCloseTo(1); // termina mais tarde: fica inteiro
    expect(shares[1]).toBeCloseTo(16 / 20); // 1–16 (17–20 ja e do 17–29)
    expect(shares[0]).toBeCloseTo(0); // 1–17 inteiro ja coberto
  });

  it("separa por anuncio e por campanha", () => {
    const shares = ownedShareByReport([
      rep("2026-09-01", "2026-09-20", "C1", "MLB1"),
      rep("2026-09-01", "2026-09-20", "C2", "MLB1"),
      rep("2026-09-01", "2026-09-20", "C1", "MLB2"),
    ]);
    expect(shares).toEqual([1, 1, 1]);
  });

  it("relatorios identicos: so um conta", () => {
    const shares = ownedShareByReport([rep("2026-09-01", "2026-09-20"), rep("2026-09-01", "2026-09-20")]);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});
