function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ALIASES = {
  date: ["data", "date", "dt"],
  description: ["descricao", "description", "memo", "historico", "detalhes"],
  externalId: ["id operacao", "id operacao", "id", "operacao", "referencia", "codigo"],
  entrada: ["entrada", "credito", "receita", "valor recebido"],
  saida: ["saida", "debito", "despesa", "valor pago"],
  amount: ["valor", "amount", "valor r"],
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
