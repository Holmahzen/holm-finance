import { describe, it, expect } from "vitest";
import { parseProductionServiceXml } from "@/parsers/nfse/productionServiceXmlParser";

// Reprodução (sem o bloco de assinatura, que o parser não lê) de uma NFS-e
// real do padrão nacional: prestador MEI faturando corte/enfesto contra a
// Holm (CNPJ da Regimar Souza Silva Ltda).
const SAMPLE_XML = `<?xml version="1.0" encoding="utf-8"?><NFSe versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS35503082242402730000169000000000000226097118843510"><xLocEmi>São Paulo</xLocEmi><nNFSe>2</nNFSe><xTribNac>Alfaiataria e costura, quando o material for fornecido pelo usuário final, exceto aviamento.</xTribNac><dhProc>2026-09-14T20:32:19-03:00</dhProc><emit><CNPJ>42402730000169</CNPJ><xNome>42.402.730 RICHARD MARX DE OLIVEIRA SILVA</xNome></emit><valores><vLiq>4000.00</vLiq></valores><DPS versao="1.01"><infDPS Id="DPS355030824240273000016970000000000000000002"><dhEmi>2026-09-14T20:32:19-03:00</dhEmi><dCompet>2026-09-14</dCompet><prest><CNPJ>42402730000169</CNPJ></prest><toma><CNPJ>49046940000100</CNPJ><xNome>REGIMAR SOUZA SILVA LTDA</xNome></toma><serv><cServ><cTribNac>140901</cTribNac><xDescServ>Cortador e enfestador</xDescServ></cServ></serv><valores><vServPrest><vServ>4000.00</vServ></vServPrest></valores></infDPS></DPS></infNFSe></NFSe>`;

describe("parseProductionServiceXml", () => {
  it("lê prestador, tomador, serviço e valor da NFS-e nacional", () => {
    const result = parseProductionServiceXml(SAMPLE_XML);
    expect(result.kind).toBe("note");
    if (result.kind !== "note") return;

    expect(result.note.accessKey).toBe("35503082242402730000169000000000000226097118843510");
    expect(result.note.providerDocument).toBe("42402730000169");
    expect(result.note.providerName).toBe("42.402.730 RICHARD MARX DE OLIVEIRA SILVA");
    expect(result.note.recipientDocument).toBe("49046940000100");
    expect(result.note.recipientName).toBe("REGIMAR SOUZA SILVA LTDA");
    expect(result.note.serviceDescription).toBe("Cortador e enfestador");
    expect(result.note.amount).toBe(4000);
    expect(result.note.referenceMonth).toBe("2026-09");
    expect(result.note.documentNumber).toBe("2");
  });

  it("ignora XML que não é uma NFS-e do padrão nacional", () => {
    const result = parseProductionServiceXml("<NFe><infNFe /></NFe>");
    expect(result.kind).toBe("ignored");
  });

  it("ignora XML ilegível sem lançar exceção", () => {
    const result = parseProductionServiceXml("não é xml");
    expect(result.kind).toBe("ignored");
  });
});
