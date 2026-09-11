/**
 * "Demonstrativo de Nota Fiscal Eletrônica" que o Mercado Livre manda para
 * cada NFS-e emitida contra a Holm por uma empresa do grupo (Ebazar e suas
 * filiais de envios, Mercado Pago). É só uma folha de rosto: prestador,
 * valor, mês de referência e um link para a nota de verdade na prefeitura.
 * Não traz o tipo de serviço, então a classificação sai do CNPJ do
 * prestador (ver `classifyMlService`).
 */
export type ParsedMlServiceStatement = {
  providerName: string;
  /** Só dígitos. */
  providerDocument: string;
  providerCity: string;
  amount: number;
  /** "YYYY-MM" do campo MÊS REF. */
  referenceMonth: string;
  /** Data do campo PERÍODO (dia em que a nota foi emitida), meia-noite UTC. */
  issuedOn: Date;
  /** Link para a NFS-e na prefeitura/Sovos; null se o PDF não trouxer. */
  link: string | null;
};

function field(text: string, pattern: RegExp): string | null {
  return pattern.exec(text)?.[1]?.trim() ?? null;
}

export function parseMlServiceStatementText(text: string): ParsedMlServiceStatement {
  if (!/DEMONSTRATIVO DE NOTA FISCAL/i.test(text) || !/GRUPO MERCADO LIVRE/i.test(text)) {
    throw new Error("não é um demonstrativo de nota fiscal do Mercado Livre");
  }

  const providerName = field(text, /Raz[aã]o Social\/Nome:\s*(.+)/i);
  const document = field(text, /CNPJ\/CPF:\s*([\d./-]+)/i);
  const amount = field(text, /Valor Total da Nota \(R\$\):\s*([\d.]+,\d{2})/i);
  const month = /M[EÊ]S REF:\s*(\d{2})\/(\d{4})/i.exec(text);
  const period = /PER[IÍ]ODO:\s*(\d{2})\.(\d{2})\.(\d{4})/i.exec(text);

  if (!providerName || !document || !amount || !month || !period) {
    throw new Error("demonstrativo sem prestador, valor, mês ou data");
  }

  return {
    providerName,
    providerDocument: document.replace(/\D/g, ""),
    providerCity: field(text, /Munic[ií]pio:\s*(.+)/i) ?? "",
    amount: Number(amount.replace(/\./g, "").replace(",", ".")),
    referenceMonth: `${month[2]}-${month[1]}`,
    issuedOn: new Date(Date.UTC(Number(period[3]), Number(period[2]) - 1, Number(period[1]))),
    link: field(text, /(https?:\/\/\S+)/),
  };
}

export async function parseMlServiceStatementPdf(buffer: Buffer): Promise<ParsedMlServiceStatement> {
  // Import dinâmico: se o binário nativo de alguma dependência do pdf-parse
  // falhar ao carregar em produção, o erro vira uma exceção normal, pega
  // pelo try/catch de quem chama esta função (por arquivo) — em vez de um
  // import estático travando o carregamento do módulo inteiro da rota, que
  // aparece como erro 500 genérico do Next sem nenhuma mensagem útil.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  let text: string;
  try {
    text = (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
  return parseMlServiceStatementText(text);
}
