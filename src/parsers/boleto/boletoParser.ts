import { PDFParse } from "pdf-parse";
import { extractLinhaDigitavel, decodeLinhaDigitavel, type ParsedBoleto } from "@/domain/boletoBarcode";

export type { ParsedBoleto };

/**
 * Fallback pra quando o código de barras não aparece como dígitos no texto
 * extraído — comum em contas de concessionária/operadora, que costumam
 * desenhar o código de barras com uma fonte especial (não é texto de
 * verdade). Nesses casos o valor e o vencimento normalmente aparecem como
 * texto legível de qualquer forma, perto dos rótulos "Vencimento" e
 * "Total a pagar" / "Valor do documento".
 */
export function extractFromLabels(rawText: string): ParsedBoleto | null {
  const amountMatch = rawText.match(
    /(?:total a pagar|valor do documento|valor cobrado)\D{0,20}?([\d.]+,\d{2})/i,
  );
  if (!amountMatch) return null;

  const dueDateMatch = rawText.match(/vencimento\D{0,10}?(\d{2})\/(\d{2})\/(\d{4})/i);
  let dueDate: Date | null = null;
  if (dueDateMatch) {
    const [, dd, mm, yyyy] = dueDateMatch;
    dueDate = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  }

  const amount = amountMatch[1].replace(/\./g, "").replace(",", ".");

  return {
    linhaDigitavel: null,
    bankCode: null,
    bankName: null,
    amount,
    dueDate,
    source: "texto",
  };
}

export async function parseBoletoPdf(buffer: Buffer): Promise<ParsedBoleto> {
  const parser = new PDFParse({ data: buffer });
  let text: string;
  try {
    const result = await parser.getText();
    text = result.text;
  } finally {
    await parser.destroy();
  }

  const linha = extractLinhaDigitavel(text);
  if (linha) return decodeLinhaDigitavel(linha);

  const fallback = extractFromLabels(text);
  if (fallback) return fallback;

  throw new Error(
    "Não foi possível encontrar o valor e o vencimento nesse PDF. Confira se é um boleto com texto selecionável (não uma imagem escaneada).",
  );
}
