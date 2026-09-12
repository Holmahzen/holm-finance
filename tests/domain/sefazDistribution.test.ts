import { describe, it, expect } from "vitest";
import { gzipSync } from "node:zlib";
import {
  buildDistributionEnvelope,
  hasMore,
  parseDistributionResponse,
} from "@/domain/sefazDistribution";

const RESUMO = `<resNFe versao="1.01"><chNFe>35260641631822000158550030000112431012300146</chNFe>` +
  `<CNPJ>41631822000158</CNPJ><xNome>LA ARTE COMERCIAL LTDA</xNome><dhEmi>2026-06-17T08:43:00-03:00</dhEmi>` +
  `<tpNF>1</tpNF><vNF>1035.50</vNF><cSitNFe>1</cSitNFe></resNFe>`;

const NOTA = `<nfeProc versao="4.00"><NFe><infNFe versao="4.00" Id="NFe35260641631822000158550030000112611012100161">` +
  `<ide><dhEmi>2026-06-18T09:50:00-03:00</dhEmi></ide><emit><CNPJ>41631822000158</CNPJ>` +
  `<xNome>LA ARTE COMERCIAL LTDA</xNome></emit><total><ICMSTot><vNF>323.00</vNF></ICMSTot></total>` +
  `</infNFe></NFe></nfeProc>`;

const EVENTO = `<resEvento versao="1.01"><cOrgao>35</cOrgao><CNPJ>41631822000158</CNPJ>` +
  `<chNFe>35260641631822000158550030000112431012300146</chNFe><dhEvento>2026-06-20T10:00:00-03:00</dhEvento>` +
  `<tpEvento>110111</tpEvento></resEvento>`;

function soap(documents: { nsu: string; schema: string; xml: string }[], extra = "") {
  const docs = documents
    .map((d) => `<docZip NSU="${d.nsu}" schema="${d.schema}">${gzipSync(Buffer.from(d.xml)).toString("base64")}</docZip>`)
    .join("");
  return `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body>
    <nfeDistDFeInteresseResponse><nfeDistDFeInteresseResult>
      <retDistDFeInt versao="1.01"><tpAmb>1</tpAmb><cStat>138</cStat><xMotivo>Documento(s) localizado(s)</xMotivo>
        <ultNSU>000000000000015</ultNSU><maxNSU>000000000000042</maxNSU>${extra}
        <loteDistDFeInt>${docs}</loteDistDFeInt>
      </retDistDFeInt>
    </nfeDistDFeInteresseResult></nfeDistDFeInteresseResponse>
  </soap:Body></soap:Envelope>`;
}

describe("buildDistributionEnvelope", () => {
  it("completa o NSU com zeros à esquerda e usa o CNPJ da empresa", () => {
    const xml = buildDistributionEnvelope({ cnpj: "49046940000100", environment: "1", ufCode: "35", lastNsu: "15" });
    expect(xml).toContain("<ultNSU>000000000000015</ultNSU>");
    expect(xml).toContain("<CNPJ>49046940000100</CNPJ>");
    expect(xml).toContain("<tpAmb>1</tpAmb>");
    expect(xml).toContain("<cUFAutor>35</cUFAutor>");
  });
});

describe("parseDistributionResponse", () => {
  it("descompacta cada documento e resume resumo, nota e evento", () => {
    const result = parseDistributionResponse(
      soap([
        { nsu: "000000000000013", schema: "resNFe_v1.01", xml: RESUMO },
        { nsu: "000000000000014", schema: "procNFe_v4.00", xml: NOTA },
        { nsu: "000000000000015", schema: "resEvento_v1.01", xml: EVENTO },
      ]),
    );

    expect(result).toMatchObject({ status: "138", lastNsu: "000000000000015", maxNsu: "000000000000042" });
    expect(result.documents).toHaveLength(3);

    expect(result.documents[0]).toMatchObject({
      kind: "resumo",
      accessKey: "35260641631822000158550030000112431012300146",
      issuerDocument: "41631822000158",
      issuerName: "LA ARTE COMERCIAL LTDA",
      total: 1035.5,
      situation: "1",
    });
    expect(result.documents[0].xml).toContain("<resNFe");

    expect(result.documents[1]).toMatchObject({
      kind: "nota",
      accessKey: "35260641631822000158550030000112611012100161",
      issuerName: "LA ARTE COMERCIAL LTDA",
      total: 323,
    });

    expect(result.documents[2]).toMatchObject({
      kind: "evento",
      accessKey: "35260641631822000158550030000112431012300146",
      situation: "110111",
    });
  });

  it("entende a resposta sem documentos", () => {
    const vazio = `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body>
      <nfeDistDFeInteresseResponse><nfeDistDFeInteresseResult>
        <retDistDFeInt><cStat>137</cStat><xMotivo>Nenhum documento localizado</xMotivo>
        <ultNSU>000000000000042</ultNSU><maxNSU>000000000000042</maxNSU></retDistDFeInt>
      </nfeDistDFeInteresseResult></nfeDistDFeInteresseResponse></soap:Body></soap:Envelope>`;
    const result = parseDistributionResponse(vazio);
    expect(result).toMatchObject({ status: "137", documents: [] });
    expect(hasMore(result)).toBe(false);
  });
});

describe("hasMore", () => {
  it("diz que ainda há documentos quando o último NSU é menor que o máximo", () => {
    const result = parseDistributionResponse(soap([{ nsu: "000000000000013", schema: "resNFe_v1.01", xml: RESUMO }]));
    expect(hasMore(result)).toBe(true);
    expect(hasMore({ ...result, lastNsu: "000000000000042" })).toBe(false);
  });
});
