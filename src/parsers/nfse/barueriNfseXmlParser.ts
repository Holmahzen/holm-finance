import { XMLParser } from "fast-xml-parser";
import type { ParsedNfse } from "@/parsers/nfse/barueriNfseParser";

/**
 * XML da NFS-e da Prefeitura de Barueri ("ConsultarNfeServPrestadoResposta") —
 * o arquivo que a prefeitura entrega no modelo próprio dela (anterior ao
 * padrão nacional). É assim que a J3 Envios (Flex) cobra o frete. Mais seguro
 * de ler que o PDF: tudo vem em campos separados.
 *
 * O arquivo costuma declarar `encoding="utf-16"` mesmo com os bytes em UTF-8;
 * como o texto já chega decodificado, a declaração é ignorada.
 */

export type ParsedBarueriNfseXml =
  | { kind: "notes"; notes: ParsedNfse[]; cancelled: number }
  | { kind: "ignored"; reason: string };

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

type XmlNode = Record<string, unknown>;

function node(value: unknown): XmlNode {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as XmlNode) : {};
}

function list(value: unknown): unknown[] {
  if (value == null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return String((value as XmlNode)["#text"] ?? "");
  return String(value);
}

function money(value: unknown): number {
  const t = text(value);
  if (t === "") return 0;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** "2026-10-05T11:19:27" → meia-noite UTC do dia (mesma convenção do leitor de PDF). */
function utcDay(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}

export function isBarueriNfseXml(xml: string): boolean {
  return xml.includes("ConsultarNfeServPrestadoResposta");
}

export function parseBarueriNfseXml(xml: string): ParsedBarueriNfseXml {
  let doc: XmlNode;
  try {
    doc = parser.parse(xml) as XmlNode;
  } catch {
    return { kind: "ignored", reason: "XML ilegível" };
  }

  const root = node(doc.ConsultarNfeServPrestadoResposta);
  if (!root.ListaNfeServPrestado) return { kind: "ignored", reason: "não é um XML de NFS-e de Barueri" };

  const notes: ParsedNfse[] = [];
  let cancelled = 0;

  for (const comp of list(node(root.ListaNfeServPrestado).CompNfeServPrestado)) {
    const inf = node(node(node(comp).NfeServPrestado).InfNfeServPrestado);
    const documentNumber = text(inf.NumeroNfe);
    if (!documentNumber) continue;

    // Nota cancelada traz dados dentro de <CancelamentoNFe>; vazio = ativa.
    const cancellation = inf.CancelamentoNFe;
    if (cancellation && (typeof cancellation === "object" ? Object.keys(cancellation).length > 0 : text(cancellation) !== "")) {
      cancelled += 1;
      continue;
    }

    const prestador = node(inf.PrestadorServico);
    const declaracao = node(node(inf.DeclaracaoServicoPrestado).InfDeclaracaoServicoPrestado);
    const servico = node(declaracao.ServicoPrestado);
    const valoresServico = node(servico.ValoresServicoPrestado);
    const tomador = node(declaracao.TomadorServico);
    const valoresNfe = node(inf.ValoresNfe);

    const prestadorDoc = node(node(node(prestador.IdentificacaoPrestador).CpfCnpj));
    const tomadorDoc = node(node(node(tomador.IdentificacaoTomador).CpfCnpj));
    const issuedOn = utcDay(text(inf.DataEmissao));
    if (!issuedOn) continue;
    const competence = utcDay(text(declaracao.Competencia)) ?? issuedOn;

    const amount = money(valoresServico.ValorServicos) || money(valoresNfe.BaseCalculo);
    const issAmount = money(valoresNfe.ValorIss) || money(valoresServico.ValorIss);
    const serviceCode = text(servico.CodigoServico);

    notes.push({
      providerName: text(prestador.RazaoSocial),
      providerDocument: text(prestadorDoc.Cnpj) || text(prestadorDoc.Cpf),
      providerCity: text(node(prestador.Endereco).Cidade),
      recipientDocument: text(tomadorDoc.Cnpj) || text(tomadorDoc.Cpf),
      recipientName: text(tomador.RazaoSocial),
      serviceDescription: text(servico.DescricaoServico).replace(/,\s*$/, ""),
      amount,
      netAmount: money(valoresNfe.ValorLiquidoNfe) || amount,
      issAmount,
      issRate: money(valoresNfe.Aliquota) || money(valoresServico.Aliquota),
      // IssRetido: 1 = retido pelo tomador, 2 = não retido.
      issWithheld: text(servico.IssRetido) === "1" ? issAmount : 0,
      issuedOn,
      referenceMonth: competence.toISOString().slice(0, 7),
      documentNumber,
      verificationCode: text(inf.CodigoVerificacao),
      serviceCode,
      serviceItem: serviceCode.length >= 4 ? `${serviceCode.slice(0, 2)}.${serviceCode.slice(2, 4)}` : "",
    });
  }

  if (notes.length === 0 && cancelled === 0) return { kind: "ignored", reason: "XML de Barueri sem nenhuma nota" };
  return { kind: "notes", notes, cancelled };
}
