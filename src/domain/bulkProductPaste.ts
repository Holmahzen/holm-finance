export type ParsedProductRow = {
  sku: string;
  name: string;
  salePrice: number;
  tecidoCost: number;
  costuraCost: number;
  aviamentosCost: number;
};

export type ParseError = { line: number; message: string };

export type ParseBulkProductPasteResult = {
  rows: ParsedProductRow[];
  errors: ParseError[];
};

/**
 * Números colados de planilha brasileira podem vir como "42,29" (vírgula
 * decimal), "1.234,56" (milhar com ponto + vírgula decimal) ou "42.29"
 * (ponto decimal, se a planilha estiver configurada em inglês). Também
 * tolera "R$" e espaços colados junto do número.
 */
function parseBrNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  let normalized = trimmed.replace(/[^\d,.\-]/g, "");
  if (normalized === "") return null;

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Interpreta texto colado de uma planilha (linhas separadas por quebra de
 * linha, colunas separadas por tab — o formato padrão ao colar do Excel):
 * SKU, Nome, Preço, Tecido, Costura, Aviamentos. Tecido/Costura/Aviamentos
 * são opcionais (viram 0 se vazios ou ausentes); SKU, Nome e Preço são
 * obrigatórios. Uma linha de cabeçalho (ex.: "SKU  Nome  Preço...") é
 * detectada e ignorada automaticamente.
 */
export function parseBulkProductPaste(raw: string): ParseBulkProductPasteResult {
  // Não usa .trim() na linha inteira antes de separar por tab — isso comeria
  // uma célula vazia no início (ex.: SKU em branco), desalinhando as
  // colunas seguintes. Só descarta linhas totalmente em branco.
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const rows: ParsedProductRow[] = [];
  const errors: ParseError[] = [];

  lines.forEach((line, idx) => {
    const cells = line.split("\t").map((c) => c.trim());
    if (idx === 0 && /^sku$/i.test(cells[0] ?? "")) return;

    const [sku, name, salePriceRaw, tecidoRaw, costuraRaw, aviamentosRaw] = cells;
    const lineNumber = idx + 1;

    if (!sku) {
      errors.push({ line: lineNumber, message: "SKU vazio." });
      return;
    }
    if (!name) {
      errors.push({ line: lineNumber, message: `SKU ${sku}: nome vazio.` });
      return;
    }
    const salePrice = parseBrNumber(salePriceRaw);
    if (salePrice === null) {
      errors.push({ line: lineNumber, message: `SKU ${sku}: preço inválido ("${salePriceRaw ?? ""}").` });
      return;
    }

    rows.push({
      sku,
      name,
      salePrice,
      tecidoCost: parseBrNumber(tecidoRaw) ?? 0,
      costuraCost: parseBrNumber(costuraRaw) ?? 0,
      aviamentosCost: parseBrNumber(aviamentosRaw) ?? 0,
    });
  });

  return { rows, errors };
}
