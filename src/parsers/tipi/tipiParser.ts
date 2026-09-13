import * as XLSX from "xlsx";

/**
 * TIPI (Tabela de Incidência do IPI) no Excel que a Receita publica em
 * gov.br/receitafederal. As linhas são hierárquicas:
 *   "62.04"      posição     — "Tailleurs, conjuntos, ..., de uso feminino."
 *   "6204.6"     subposição  — "- Calças, jardineiras, bermudas e shorts:"
 *   "6204.63.00" item        — "-- De fibras sintéticas"   → 0
 * e só o item de 8 dígitos tem alíquota. A descrição do item sozinha ("-- De
 * fibras sintéticas") não diz o que é a peça — é a subposição que diz que é
 * calça —, então as três são guardadas juntas.
 *
 * A alíquota vem como número ou "NT" (não tributado: fora do campo do IPI).
 * Linhas com "EX" são exceções com regra própria e ficam de fora.
 */

export type TipiEntry = {
  ncm: string;
  description: string;
  /** "NT" ou o número com ponto decimal ("0", "5", "3.25"). */
  rate: string;
  /** null quando a alíquota é "NT". */
  numericRate: number | null;
};

export type ParsedTipi = { entries: TipiEntry[]; version: string | null };

function clean(text: unknown): string {
  return String(text ?? "")
    .replace(/^[\s-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tira o ":" ou "." do fim, que só servem de pontuação na tabela. */
function heading(text: string): string {
  return text.replace(/[:.]\s*$/, "").trim();
}

function parseRate(raw: unknown): { rate: string; numericRate: number | null } | null {
  if (raw === "" || raw == null) return null;
  const text = String(raw).trim().toUpperCase();
  if (text === "NT") return { rate: "NT", numericRate: null };
  const n = Number(text.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return { rate: String(n), numericRate: n };
}

/** "Atualizações: Decreto ... \n ADE RFB nº 1, de ... 2026" → a última atualização listada. */
function findVersion(rows: unknown[][]): string | null {
  for (const row of rows.slice(0, 10)) {
    const cell = String(row?.[0] ?? "");
    // Só a célula que começa com "Atualizações:" — o título também tem "atualizado".
    if (!/^\s*Atualiza[çc][õo]es\s*:/i.test(cell)) continue;
    const lines = cell
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== "" && !/^Atualiza/i.test(l));
    return lines.at(-1) ?? null;
  }
  return null;
}

export function parseTipiRows(rows: unknown[][]): ParsedTipi {
  const entries: TipiEntry[] = [];
  let position = { code: "", text: "" };
  let subposition = { code: "", text: "" };

  for (const row of rows) {
    const code = String(row?.[0] ?? "").replace(/\D/g, "");
    const ex = String(row?.[1] ?? "").trim();
    const description = clean(row?.[2]);

    if (code.length === 4) {
      position = { code, text: heading(description) };
      subposition = { code: "", text: "" };
      continue;
    }
    if (code.length === 5 || code.length === 6) {
      subposition = { code, text: heading(description) };
      continue;
    }
    if (code.length !== 8 || ex !== "") continue;

    const rate = parseRate(row?.[3]);
    if (!rate) continue;

    const item = heading(description);
    const parts: string[] = [];
    if (position.text && code.startsWith(position.code)) parts.push(position.text);
    if (
      subposition.text &&
      code.startsWith(subposition.code) &&
      subposition.text !== position.text &&
      subposition.text !== item
    ) {
      parts.push(subposition.text);
    }
    if (item && item !== position.text) parts.push(item);

    entries.push({ ncm: code, description: parts.join(" — ") || item, ...rate });
  }

  return { entries, version: findVersion(rows) };
}

export function parseTipiWorkbook(buffer: Buffer): ParsedTipi {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames.find((n) => /tabela/i.test(n)) ?? workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "" });
  return parseTipiRows(rows);
}
