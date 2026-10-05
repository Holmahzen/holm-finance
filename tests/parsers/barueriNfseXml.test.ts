import { describe, it, expect } from "vitest";
import { isBarueriNfseXml, parseBarueriNfseXml } from "@/parsers/nfse/barueriNfseXmlParser";

/** XML real da NFS-e de Barueri da J3 Envios (frete do Flex), nota 162113. */
function xml(cancelamento = "<CancelamentoNFe />", tomadorCnpj = "49046940000100") {
  return `<?xml version="1.0" encoding="utf-16"?><ConsultarNfeServPrestadoResposta xmlns:xsd="http://www.w3.org/2001/XMLSchema"><ListaNfeServPrestado xmlns="http://www.barueri.sp.gov.br/nfe"><CompNfeServPrestado><NfeServPrestado><InfNfeServPrestado><NumeroNfe>162113</NumeroNfe><SerieNfe /><CodigoVerificacao>954V.2114.8115.2303899-Y</CodigoVerificacao><DataEmissao>2026-10-05T11:19:27</DataEmissao><ValoresNfe><BaseCalculo>5221.98</BaseCalculo><Aliquota>2</Aliquota><ValorIss>104.44</ValorIss><ValorLiquidoNfe>5221.98</ValorLiquidoNfe></ValoresNfe><PrestadorServico><IdentificacaoPrestador><CpfCnpj><Cnpj>58556821000270</Cnpj></CpfCnpj><InscricaoMunicipal>4BK6217</InscricaoMunicipal></IdentificacaoPrestador><RazaoSocial>J3 ENVIOS LTDA</RazaoSocial><Endereco><Endereco>ALAMEDA RIO NEGRO</Endereco><Cidade>BARUERI</Cidade><Uf>SP</Uf></Endereco></PrestadorServico><DeclaracaoServicoPrestado><InfDeclaracaoServicoPrestado><Competencia>2026-10-05T00:00:00</Competencia><ServicoPrestado><ValoresServicoPrestado><ValorServicos>5221.98</ValorServicos><ValorIss>104.44</ValorIss><Aliquota>2</Aliquota></ValoresServicoPrestado><IssRetido>2</IssRetido><CodigoServico>260101220</CodigoServico><DescricaoServico>Serviços de coleta, remessa ou entrega de correspondências, </DescricaoServico></ServicoPrestado><TomadorServico><IdentificacaoTomador><CpfCnpj><Cnpj>${tomadorCnpj}</Cnpj></CpfCnpj></IdentificacaoTomador><RazaoSocial>Regimar Souza Silva Ltda</RazaoSocial></TomadorServico></InfDeclaracaoServicoPrestado></DeclaracaoServicoPrestado><CartaCorrecao />${cancelamento}</InfNfeServPrestado></NfeServPrestado></CompNfeServPrestado><Pagina>1</Pagina><Paginas>1</Paginas></ListaNfeServPrestado></ConsultarNfeServPrestadoResposta>`;
}

describe("parseBarueriNfseXml", () => {
  it("reconhece o XML de Barueri", () => {
    expect(isBarueriNfseXml(xml())).toBe(true);
    expect(isBarueriNfseXml("<NFe></NFe>")).toBe(false);
  });

  it("lê a nota da J3 Envios com todos os campos", () => {
    const r = parseBarueriNfseXml(xml());
    expect(r.kind).toBe("notes");
    if (r.kind !== "notes") return;
    expect(r.cancelled).toBe(0);
    expect(r.notes).toHaveLength(1);
    const n = r.notes[0];
    expect(n.providerName).toBe("J3 ENVIOS LTDA");
    expect(n.providerDocument).toBe("58556821000270");
    expect(n.providerCity).toBe("BARUERI");
    expect(n.recipientDocument).toBe("49046940000100");
    expect(n.recipientName).toBe("Regimar Souza Silva Ltda");
    expect(n.amount).toBeCloseTo(5221.98, 2);
    expect(n.issAmount).toBeCloseTo(104.44, 2);
    expect(n.issRate).toBe(2);
    expect(n.issWithheld).toBe(0);
    expect(n.documentNumber).toBe("162113");
    expect(n.verificationCode).toBe("954V.2114.8115.2303899-Y");
    expect(n.serviceCode).toBe("260101220");
    expect(n.serviceItem).toBe("26.01");
    expect(n.serviceDescription).toBe("Serviços de coleta, remessa ou entrega de correspondências,".replace(/,$/, ""));
    expect(n.issuedOn.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(n.referenceMonth).toBe("2026-10");
  });

  it("não importa nota cancelada", () => {
    const r = parseBarueriNfseXml(xml("<CancelamentoNFe><Pedido>x</Pedido></CancelamentoNFe>"));
    expect(r).toEqual({ kind: "notes", notes: [], cancelled: 1 });
  });

  it("ignora XML que não é de Barueri", () => {
    expect(parseBarueriNfseXml("<NFe><infNFe/></NFe>")).toEqual({
      kind: "ignored",
      reason: "não é um XML de NFS-e de Barueri",
    });
  });
});
