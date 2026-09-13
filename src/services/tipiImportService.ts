import { DomainError } from "@/domain/errors";
import { parseTipiWorkbook } from "@/parsers/tipi/tipiParser";
import { tipiRepository } from "@/repositories/tipiRepository";

/** A TIPI tem mais de 10 mil NCMs; um arquivo com bem menos que isso não é ela. */
const MIN_ENTRIES = 5000;

export const tipiImportService = {
  async importWorkbook(buffer: Buffer) {
    let parsed;
    try {
      parsed = parseTipiWorkbook(buffer);
    } catch {
      throw new DomainError("Não consegui abrir o arquivo. Envie o Excel (.xlsx) da TIPI baixado do site da Receita.");
    }
    if (parsed.entries.length < MIN_ENTRIES) {
      throw new DomainError(
        `O arquivo tem só ${parsed.entries.length} NCMs com alíquota — não parece a TIPI completa. Baixe a "Tabela Completa" em Excel no site da Receita.`,
      );
    }
    await tipiRepository.replaceAll(parsed.entries, parsed.version);
    return { entries: parsed.entries.length, version: parsed.version };
  },
};
