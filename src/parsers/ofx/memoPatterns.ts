import type { ParsedMemo } from "./types";

const PIX_DEBIT_RE = /^PAGAMENTO PIX-PIX_DEB\s+(\d+)\s+(.+?)\s*$/;
const PIX_CREDIT_RE = /^RECEBIMENTO PIX-PIX_CRED\s+(\d+)\s+(.+?)\s*$/;
// Formato do Sicredi (diferente do Nubank acima): "Transferência recebida
// pelo Pix - NOME - DOCUMENTO - BANCO Agência: X Conta: Y". CNPJ vem por
// extenso; CPF de pessoa física vem mascarado ("•••.575.478-••") por
// privacidade — nesse caso o documento extraído fica parcial e
// propositalmente não bate com nenhuma contraparte cadastrada.
const TRANSFERENCIA_PIX_RE = /^Transferência (Recebida|Enviada)(?: pelo Pix)? - (.+?) - ([\d.\-/•]+) - .+$/i;
const CARD_PURCHASE_RE = /^COMPRAS NACIONAIS-VE\d+\s+(.+)$/;

function onlyDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Best-effort extraction from OFX MEMO free text. Real bank memos vary; an
 * unrecognized shape always falls back to OTHER rather than throwing, so a
 * new memo format never breaks an import.
 */
export function parseMemo(memo: string): ParsedMemo {
  const trimmed = memo.trim();

  const pixDebit = trimmed.match(PIX_DEBIT_RE);
  if (pixDebit) {
    return { kind: "PIX_DEBIT", document: pixDebit[1], name: pixDebit[2].trim() };
  }

  const pixCredit = trimmed.match(PIX_CREDIT_RE);
  if (pixCredit) {
    return { kind: "PIX_CREDIT", document: pixCredit[1], name: pixCredit[2].trim() };
  }

  const transferencia = trimmed.match(TRANSFERENCIA_PIX_RE);
  if (transferencia) {
    const [, direction, name, document] = transferencia;
    const kind = direction.toLowerCase() === "recebida" ? "PIX_CREDIT" : "PIX_DEBIT";
    return { kind, document: onlyDigits(document), name: name.trim() };
  }

  const card = trimmed.match(CARD_PURCHASE_RE);
  if (card) {
    const parts = card[1]
      .split(/\s{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    return {
      kind: "CARD_PURCHASE",
      name: parts[0] ?? "",
      city: parts.length >= 2 ? parts[parts.length - 2] : "",
    };
  }

  return { kind: "OTHER" };
}
