import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseMercadoLivreWorkbook, PACKAGE_SKU } from "@/parsers/mercadoLivre/mercadoLivreParser";

// O export nativo do Mercado Livre repete rótulos entre blocos: "Unidades"
// aparece em Vendas e em Devoluções, "Forma de entrega"/"Data de entrega"
// aparecem em Envios e em Devoluções. O cabeçalho abaixo reproduz essa
// duplicação de propósito — é o que o parser precisa desambiguar.
const HEADERS = [
  "N.º de venda",
  "Data da venda",
  "Depósito",
  "Estado",
  "Descrição do status",
  "Unidades",
  "Receita por produtos (BRL)",
  "Receita por acréscimo no preço (pago pelo comprador)",
  "Tarifa de venda e impostos (BRL)",
  "Receita por envio (BRL)",
  "Tarifas de envio (BRL)",
  "Total (BRL)",
  "Mês de faturamento das suas tarifas",
  "SKU",
  "Título do anúncio",
  "Comprador",
  "Forma de entrega",
  "Data a caminho",
  "Data de entrega",
  "Unidades",
  "Forma de entrega",
  "Data a caminho",
  "Data de entrega",
];

const COL = Object.fromEntries(
  HEADERS.map((h, i) => [h, i]).filter(([h], i) => HEADERS.indexOf(h as string) === i),
) as Record<string, number>;

function blankRow(): unknown[] {
  return Array.from({ length: HEADERS.length }, () => null);
}

function moneyRow(values: Record<string, unknown>): unknown[] {
  const row = blankRow();
  for (const [header, value] of Object.entries(values)) row[COL[header]] = value;
  return row;
}

/** O cabeçalho real não fica na primeira linha — vem depois do texto de
 * apresentação e da faixa de agrupamento do relatório. */
function buildWorkbookBuffer(dataRows: unknown[][]): Buffer {
  const grid = [
    [],
    ["Neste relatório, você encontra as informações das suas vendas."],
    [],
    ["Vendas  Status das suas vendas em 4 de setembro de 2026, às 18:35 hs."],
    ["Vendas", null, null, null, null, null, null, null, null, null, null, null, null, "Anúncios"],
    HEADERS,
    ...dataRows,
  ];
  const sheet = XLSX.utils.aoa_to_sheet(grid);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Vendas BR");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const DELIVERED_SALE = {
  "N.º de venda": "2000014711234567",
  "Data da venda": "28 de agosto de 2026 09:12 hs.",
  Estado: "Entregue",
  Unidades: 1,
  "Receita por produtos (BRL)": 47,
  "Receita por acréscimo no preço (pago pelo comprador)": 3,
  "Tarifa de venda e impostos (BRL)": -8.93,
  "Receita por envio (BRL)": 5,
  "Tarifas de envio (BRL)": -6.95,
  "Total (BRL)": 39.12,
  "Mês de faturamento das suas tarifas": "agosto 2026",
  SKU: "COUM.1001M",
  "Título do anúncio": "Conjunto Branco Masculino Umbanda Candomblé",
  Comprador: "Petrus Augustus de Oliveira",
  "Forma de entrega": "Mercado Envios Full",
  "Data de entrega": "30 de agosto | 11:51",
};

describe("parseMercadoLivreWorkbook", () => {
  it("lê uma venda entregue com data, valores e faturamento", () => {
    const result = parseMercadoLivreWorkbook(buildWorkbookBuffer([moneyRow(DELIVERED_SALE)]));

    expect(result.rows).toHaveLength(1);
    const sale = result.rows[0];
    expect(sale.orderId).toBe("2000014711234567");
    expect(sale.saleDate).toEqual(new Date(Date.UTC(2026, 7, 28)));
    expect(sale.deliveredAt).toEqual(new Date(Date.UTC(2026, 7, 30)));
    expect(sale.sku).toBe("COUM.1001M");
    expect(sale.status).toBe("Entregue");
    expect(sale.billingMonth).toBe("agosto 2026");
    expect(sale.shippingModality).toBe("Mercado Envios Full");
    expect(sale.customerName).toBe("Petrus Augustus de Oliveira");
  });

  it("soma produtos, acréscimo e envio no bruto, e usa Total (BRL) como líquido", () => {
    const result = parseMercadoLivreWorkbook(buildWorkbookBuffer([moneyRow(DELIVERED_SALE)]));

    expect(result.rows[0].grossRevenue).toBe(55);
    expect(result.rows[0].netTotal).toBe(39.12);
  });

  it("pega a data de entrega do bloco de envio, não a da devolução", () => {
    const row = moneyRow(DELIVERED_SALE);
    // Segunda ocorrência de "Data de entrega" — bloco de Devoluções.
    row[HEADERS.lastIndexOf("Data de entrega")] = "15 de setembro | 08:00";

    const result = parseMercadoLivreWorkbook(buildWorkbookBuffer([row]));
    expect(result.rows[0].deliveredAt).toEqual(new Date(Date.UTC(2026, 7, 30)));
  });

  it("vira o ano quando a entrega cai no mês seguinte ao da virada", () => {
    const result = parseMercadoLivreWorkbook(
      buildWorkbookBuffer([
        moneyRow({
          ...DELIVERED_SALE,
          "Data da venda": "30 de dezembro de 2026 09:12 hs.",
          "Data de entrega": "3 de janeiro | 10:00",
        }),
      ]),
    );

    expect(result.rows[0].deliveredAt).toEqual(new Date(Date.UTC(2027, 0, 3)));
  });

  it("aceita entrega anterior à venda sem jogar a data pro ano seguinte", () => {
    // Mercado Envios Full: o pacote já está no centro de distribuição e pode
    // ser entregue com data anterior à do fechamento da venda.
    const result = parseMercadoLivreWorkbook(
      buildWorkbookBuffer([
        moneyRow({
          ...DELIVERED_SALE,
          "Data da venda": "31 de agosto de 2026 16:04 hs.",
          "Data de entrega": "6 de agosto | 16:45",
        }),
      ]),
    );

    expect(result.rows[0].deliveredAt).toEqual(new Date(Date.UTC(2026, 7, 6)));
  });

  it("mantém a linha-mãe de pacote multiproduto sob um SKU marcador", () => {
    // O dinheiro e a entrega ficam nessa linha; os produtos vêm em vendas
    // separadas, com SKU e valor zerado. Descartá-la perderia receita real.
    const result = parseMercadoLivreWorkbook(
      buildWorkbookBuffer([
        moneyRow({
          ...DELIVERED_SALE,
          Estado: "Pacote de 3 produtos",
          SKU: null,
          "Título do anúncio": null,
        }),
      ]),
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].sku).toBe(PACKAGE_SKU);
    expect(result.rows[0].productName).toBe("Pacote de 3 produtos");
    expect(result.rows[0].netTotal).toBe(39.12);
    expect(result.skippedRows).toBe(0);
  });

  it("deixa deliveredAt nulo enquanto a venda não foi entregue", () => {
    const result = parseMercadoLivreWorkbook(
      buildWorkbookBuffer([
        moneyRow({ ...DELIVERED_SALE, Estado: "A caminho", "Data de entrega": " " }),
      ]),
    );

    expect(result.rows[0].deliveredAt).toBeNull();
  });

  it("junta as linhas extras de um pacote multiproduto numa venda só", () => {
    const parent = moneyRow({ ...DELIVERED_SALE, Estado: "Pacote de 2 produtos", SKU: null });
    const child = moneyRow({
      "N.º de venda": DELIVERED_SALE["N.º de venda"],
      "Data da venda": DELIVERED_SALE["Data da venda"],
      Estado: "Entregue",
      Unidades: 2,
      SKU: "COUM.1001M",
      "Título do anúncio": "Conjunto Branco Masculino",
    });

    const result = parseMercadoLivreWorkbook(buildWorkbookBuffer([parent, child]));

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].sku).toBe("COUM.1001M");
    expect(result.rows[0].netTotal).toBe(39.12);
    expect(result.rows[0].quantity).toBe(3);
  });

  it("descarta linha sem SKU e sem dinheiro em vez de interromper o arquivo", () => {
    const result = parseMercadoLivreWorkbook(
      buildWorkbookBuffer([
        moneyRow({
          "N.º de venda": "2000014799999999",
          "Data da venda": "28 de agosto de 2026 09:12 hs.",
          Estado: "Cancelada pelo comprador",
        }),
        moneyRow(DELIVERED_SALE),
      ]),
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].orderId).toBe(DELIVERED_SALE["N.º de venda"]);
    expect(result.skippedRows).toBe(1);
  });

  it("rejeita planilha de outro formato pra que o importador tente o parser seguinte", () => {
    const sheet = XLSX.utils.json_to_sheet([{ "ID Venda": "1", SKU: "X" }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "table-pedidos1");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    expect(() => parseMercadoLivreWorkbook(buffer)).toThrow(/N\.º de venda/);
  });
});
