import { describe, it, expect } from "vitest";
import { parseNfeXml, type ParsedFiscalNote } from "@/parsers/nfe/nfeParser";

const KEY = "35260949046940000100550040000231101485461920";

type NoteOptions = {
  key?: string;
  mod?: string;
  tpAmb?: string;
  tpNF?: string;
  finNFe?: string;
  cStat?: string | null;
  crt?: string;
  emitCnpj?: string;
  dest?: string;
  items?: string;
  extraIde?: string;
  extraInf?: string;
  totals?: string;
};

function noteXml(o: NoteOptions = {}): string {
  const key = o.key ?? KEY;
  const nfe = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe versao="4.00" Id="NFe${key}">
    <ide><cUF>35</cUF><natOp>Venda de mercadorias</natOp><mod>${o.mod ?? "55"}</mod><serie>4</serie><nNF>23110</nNF>
      <dhEmi>2026-08-31T23:45:25-03:00</dhEmi><tpNF>${o.tpNF ?? "1"}</tpNF><idDest>2</idDest><tpAmb>${o.tpAmb ?? "1"}</tpAmb>
      <finNFe>${o.finNFe ?? "1"}</finNFe><indFinal>1</indFinal><indIntermed>1</indIntermed>${o.extraIde ?? ""}</ide>
    <emit><CNPJ>${o.emitCnpj ?? "49046940000100"}</CNPJ><xNome>Holm Confeccoes</xNome>
      <enderEmit><UF>SP</UF></enderEmit><CRT>${o.crt ?? "1"}</CRT></emit>
    ${o.dest ?? `<dest><CPF>12345678909</CPF><xNome>Cliente Teste</xNome><enderDest><UF>RJ</UF></enderDest><indIEDest>9</indIEDest></dest>`}
    ${o.items ?? `<det nItem="1"><prod><cProd>JACA1002G</cProd><xProd>JALECO - G</xProd><NCM>61059000</NCM><CFOP>6102</CFOP>
      <qCom>2.0000</qCom><vProd>89.80</vProd><vDesc>9.80</vDesc><vFrete>5.00</vFrete></prod>
      <imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS></imposto></det>`}
    <total><ICMSTot>${o.totals ?? "<vBC>0.00</vBC><vICMS>0.00</vICMS><vProd>89.80</vProd><vFrete>5.00</vFrete><vDesc>9.80</vDesc><vNF>85.00</vNF>"}</ICMSTot></total>
    ${o.extraInf ?? `<infIntermed><CNPJ>03007331000141</CNPJ></infIntermed>`}
  </infNFe></NFe>`;
  if (o.cStat === null) return `<?xml version="1.0" encoding="UTF-8"?>${nfe}`;
  return `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${nfe}
    <protNFe versao="4.00"><infProt><chNFe>${key}</chNFe><cStat>${o.cStat ?? "100"}</cStat></infProt></protNFe></nfeProc>`;
}

function parseNote(xml: string): ParsedFiscalNote {
  const result = parseNfeXml(xml);
  if (result.kind !== "note") throw new Error(`esperava nota, veio ${JSON.stringify(result)}`);
  return result.note;
}

describe("parseNfeXml — notas", () => {
  it("lê uma venda do Simples para consumidor de outro estado, via Mercado Livre", () => {
    const note = parseNote(noteXml());
    expect(note.accessKey).toBe(KEY);
    expect(note.operationType).toBe(1);
    expect(note.purpose).toBe(1);
    expect(note.issuerDocument).toBe("49046940000100");
    expect(note.issuerCrt).toBe(1);
    expect(note.recipientDocument).toBe("12345678909");
    expect(note.recipientUf).toBe("RJ");
    expect(note.finalConsumer).toBe(true);
    expect(note.intermediaryDocument).toBe("03007331000141");
    expect(note.total).toBe(85);
    expect(note.items).toHaveLength(1);
    expect(note.items[0]).toMatchObject({ cfop: "6102", ncm: "61059000", icmsCode: "102", quantity: 2 });
    expect(note.items[0].netValue).toBeCloseTo(85, 2);
  });

  it("usa o mês do texto de dhEmi, não o de UTC (23h45 de 31/08 em SP ainda é agosto)", () => {
    const note = parseNote(noteXml());
    expect(note.issueMonth).toBe("2026-08");
    expect(note.issuedAt.toISOString()).toBe("2026-09-01T02:45:25.000Z");
  });

  it("guarda o ICMS destacado de fornecedor do regime normal", () => {
    const note = parseNote(
      noteXml({
        emitCnpj: "41631822000158",
        crt: "3",
        dest: `<dest><CNPJ>49046940000100</CNPJ><xNome>REGIMAR SOUZA SILVA</xNome><enderDest><UF>SP</UF></enderDest></dest>`,
        items: `<det nItem="1"><prod><cProd>024699</cProd><xProd>BORDADO</xProd><NCM>58042100</NCM><CFOP>5102</CFOP>
          <qCom>50.0000</qCom><vProd>410.00</vProd><vDesc>20.50</vDesc></prod>
          <imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST><vBC>389.50</vBC><pICMS>18.00</pICMS><vICMS>70.11</vICMS></ICMS00></ICMS></imposto></det>`,
        totals: "<vBC>389.50</vBC><vICMS>70.11</vICMS><vProd>410.00</vProd><vDesc>20.50</vDesc><vNF>389.50</vNF>",
        extraInf: "",
      }),
    );
    expect(note.recipientDocument).toBe("49046940000100");
    expect(note.intermediaryDocument).toBeNull();
    expect(note.icmsTotal).toBe(70.11);
    expect(note.items[0]).toMatchObject({ icmsCode: "00", icmsBase: 389.5, icmsRate: 18, icmsValue: 70.11 });
  });

  it("soma o crédito de ICMS que fornecedor do Simples autoriza (CSOSN 101)", () => {
    const note = parseNote(
      noteXml({
        items: `<det nItem="1"><prod><cProd>A</cProd><xProd>TECIDO</xProd><NCM>54075210</NCM><CFOP>5101</CFOP><qCom>1</qCom><vProd>1000.00</vProd></prod>
          <imposto><ICMS><ICMSSN101><orig>0</orig><CSOSN>101</CSOSN><pCredSN>3.95</pCredSN><vCredICMSSN>39.50</vCredICMSSN></ICMSSN101></ICMS></imposto></det>`,
      }),
    );
    expect(note.items[0].icmsCode).toBe("101");
    expect(note.simplesCreditTotal).toBe(39.5);
  });

  it("lê a devolução com a chave da venda original", () => {
    const original = "35260849046940000100550040000200001000000001";
    const note = parseNote(
      noteXml({ tpNF: "0", finNFe: "4", extraIde: `<NFref><refNFe>${original}</refNFe></NFref>` }),
    );
    expect(note.operationType).toBe(0);
    expect(note.purpose).toBe(4);
    expect(note.referencedKeys).toEqual([original]);
  });

  it("aceita NF-e sem protocolo, tirando a chave do Id", () => {
    expect(parseNote(noteXml({ cStat: null })).accessKey).toBe(KEY);
  });
});

describe("parseNfeXml — o que não vira nota", () => {
  it("ignora nota não autorizada", () => {
    expect(parseNfeXml(noteXml({ cStat: "110" }))).toMatchObject({ kind: "ignored" });
  });

  it("ignora nota de homologação", () => {
    expect(parseNfeXml(noteXml({ tpAmb: "2" }))).toMatchObject({ kind: "ignored", reason: "nota de teste (homologação)" });
  });

  it("ignora NFC-e (modelo 65)", () => {
    expect(parseNfeXml(noteXml({ mod: "65" }))).toMatchObject({ kind: "ignored" });
  });

  it("ignora XML quebrado e XML que não é de nota", () => {
    expect(parseNfeXml("<nfeProc><NFe>")).toMatchObject({ kind: "ignored" });
    expect(parseNfeXml("<?xml version=\"1.0\"?><outra><coisa/></outra>")).toMatchObject({ kind: "ignored" });
  });
});

describe("parseNfeXml — eventos", () => {
  function eventXml(tpEvento: string, cStat = "135", desc = "Cancelamento") {
    return `<?xml version="1.0" encoding="UTF-8"?><procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
      <evento versao="1.00"><infEvento Id="ID${tpEvento}${KEY}01"><chNFe>${KEY}</chNFe><dhEvento>2026-09-02T10:00:00-03:00</dhEvento>
        <tpEvento>${tpEvento}</tpEvento><detEvento versao="1.00"><descEvento>${desc}</descEvento></detEvento></infEvento></evento>
      <retEvento versao="1.00"><infEvento><cStat>${cStat}</cStat><chNFe>${KEY}</chNFe><dhRegEvento>2026-09-02T10:00:05-03:00</dhRegEvento></infEvento></retEvento>
    </procEventoNFe>`;
  }

  it("lê o cancelamento homologado", () => {
    const result = parseNfeXml(eventXml("110111"));
    expect(result).toMatchObject({ kind: "cancellation", accessKey: KEY });
    if (result.kind === "cancellation") expect(result.cancelledAt.toISOString()).toBe("2026-09-02T13:00:05.000Z");
  });

  it("ignora cancelamento recusado e outros eventos", () => {
    expect(parseNfeXml(eventXml("110111", "573"))).toMatchObject({ kind: "ignored" });
    expect(parseNfeXml(eventXml("110110", "135", "Carta de Correcao"))).toMatchObject({
      kind: "ignored",
      reason: 'evento "Carta de Correcao" (só o cancelamento é usado)',
    });
  });
});
