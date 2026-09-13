import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseTipiRows, parseTipiWorkbook } from "@/parsers/tipi/tipiParser";

/** Recorte das linhas como vêm no Excel da Receita (TIPI 2022 atualizada). */
const ROWS: unknown[][] = [
  ["", "", "", "", ""],
  [
    // O título real também diz "atualizado": a versão não pode vir daqui.
    "\nTABELA DE INCIDÊNCIA DO IMPOSTO SOBRE PRODUTOS INDUSTRIALIZADOS (TIPI)\n\n2 0 2 2\n" +
      "(Baseada no Sistema Harmonizado de Designação e de Codificação de Mercadorias, atualizado com sua VII Emenda)",
    "",
    "",
    "",
    "",
  ],
  ["Atualizações:\nDecreto nº 11.182, de 24 de agosto de 2022\nAto Declaratório Executivo RFB nº 1, de 2026", "", "", "", ""],
  ["NCM ", "EX", "DESCRIÇÃO ", "ALÍQUOTA (%)", ""],
  ["61.05", "", "Camisas de malha, de uso masculino.", "", ""],
  ["6105.10.00", "", "- De algodão ", 0, ""],
  ["6105.90.00", "", "- De outras matérias têxteis ", 0, ""],
  ["62.04", "", "Vestuário feminino de tecido plano.", "", ""],
  ["6204.5", "", "- Saias e saias-calças:", "", ""],
  ["6204.53.00", "", "-- De fibras sintéticas ", 0, ""],
  ["6204.6", "", "- Calças, jardineiras, bermudas e shorts:", "", ""],
  ["6204.63.00", "", "-- De fibras sintéticas ", 0, ""],
  ["63.09", "", "Artigos de matérias têxteis e artigos de uso semelhante, usados.", "", ""],
  ["6309.00", "", "Artigos de matérias têxteis e artigos de uso semelhante, usados.", "", ""],
  ["6309.00.10", "", "Vestuário, seus acessórios, e suas partes", "NT", ""],
  ["22.03", "", "Cervejas de malte.", "", ""],
  ["2203.00.00", "", "Cervejas de malte ", 6, ""],
  ["2203.00.00", "01", "Em garrafas de vidro ", 3.9, ""],
  ["84.71", "", "Máquinas automáticas para processamento de dados.", "", ""],
  ["8471.30", "", "- Máquinas portáteis ", "", ""],
  ["8471.30.12", "", "-- Com tela ", "9,75", ""],
];

describe("parseTipiRows", () => {
  const { entries, version } = parseTipiRows(ROWS);
  const byNcm = new Map(entries.map((e) => [e.ncm, e]));

  it("junta a descrição da posição com a do item", () => {
    expect(byNcm.get("61051000")).toEqual({
      ncm: "61051000",
      description: "Camisas de malha, de uso masculino — De algodão",
      rate: "0",
      numericRate: 0,
    });
  });

  it("inclui a subposição, que é o que diz que é saia ou calça", () => {
    expect(byNcm.get("62045300")?.description).toBe(
      "Vestuário feminino de tecido plano — Saias e saias-calças — De fibras sintéticas",
    );
    expect(byNcm.get("62046300")?.description).toBe(
      "Vestuário feminino de tecido plano — Calças, jardineiras, bermudas e shorts — De fibras sintéticas",
    );
  });

  it("não repete a subposição quando ela é igual à posição", () => {
    expect(byNcm.get("63090010")?.description).toBe(
      "Artigos de matérias têxteis e artigos de uso semelhante, usados — Vestuário, seus acessórios, e suas partes",
    );
  });

  it("guarda NT separado de zero", () => {
    expect(byNcm.get("63090010")).toMatchObject({ rate: "NT", numericRate: null });
  });

  it("ignora exceções (EX) e posições, e alíquota com vírgula vira ponto", () => {
    expect(byNcm.get("22030000")).toMatchObject({ rate: "6", numericRate: 6, description: "Cervejas de malte" });
    expect(entries.filter((e) => e.ncm === "22030000")).toHaveLength(1);
    expect(byNcm.get("84713012")).toMatchObject({
      rate: "9.75",
      numericRate: 9.75,
      description: "Máquinas automáticas para processamento de dados — Máquinas portáteis — Com tela",
    });
    expect(entries.map((e) => e.ncm)).not.toContain("6105");
  });

  it("lê a versão pela última atualização do cabeçalho, e não pelo título", () => {
    expect(version).toBe("Ato Declaratório Executivo RFB nº 1, de 2026");
  });
});

describe("parseTipiWorkbook", () => {
  it("lê a aba da tabela a partir do arquivo Excel", () => {
    const sheet = XLSX.utils.aoa_to_sheet(ROWS);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Tabela Completa");
    const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
    expect(parseTipiWorkbook(buffer).entries).toHaveLength(7);
  });
});
