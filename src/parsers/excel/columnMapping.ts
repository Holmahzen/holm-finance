function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ALIASES = {
  date: ["data", "date", "dt", "release date"],
  description: ["descricao", "description", "memo", "historico", "detalhes", "transaction type"],
  externalId: ["id operacao", "id operacao", "id", "operacao", "referencia", "codigo"],
  // No extrato do Mercado Pago o REFERENCE_ID se repete em várias linhas
  // diferentes (ex.: liberação + retenção do mesmo pedido), então não serve
  // como externalId direto (viraria falso "duplicado" ao gravar) — só reforça
  // o hash sintético (data+descrição+valor) pra reduzir colisão entre linhas
  // que por coincidência têm a mesma descrição e o mesmo valor no mesmo dia.
  referenceHint: ["reference id"],
  entrada: ["entrada", "credito", "receita", "valor recebido"],
  saida: ["saida", "debito", "despesa", "valor pago"],
  amount: ["valor", "amount", "valor r", "transaction net amount"],
  type: ["tipo", "type"],
  counterparty: ["contraparte", "counterparty", "favorecido", "pagador", "beneficiario"],
} as const;

export type ColumnRole = keyof typeof ALIASES;

export function mapHeaders(headers: string[]): Partial<Record<ColumnRole, string>> {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  const mapping: Partial<Record<ColumnRole, string>> = {};

  for (const role of Object.keys(ALIASES) as ColumnRole[]) {
    const aliases = ALIASES[role];
    const match = normalized.find((h) => (aliases as readonly string[]).includes(h.norm));
    if (match) mapping[role] = match.raw;
  }

  return mapping;
}

export function detectFormat(
  mapping: Partial<Record<ColumnRole, string>>,
): "mercado_pago" | "generic" | null {
  if (!mapping.date || !mapping.description) return null;
  if (mapping.entrada && mapping.saida) return "mercado_pago";
  if (mapping.amount) return "generic";
  return null;
}
