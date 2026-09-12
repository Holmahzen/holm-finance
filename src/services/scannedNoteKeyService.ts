import { DomainError } from "@/domain/errors";
import { digitsOnly, parseAccessKey } from "@/domain/accessKey";
import { scannedNoteKeyRepository } from "@/repositories/scannedNoteKeyRepository";

export const scannedNoteKeyService = {
  /**
   * Registra uma nota impressa pelo codigo de barras. Se o XML ja tiver sido
   * importado, so confirma; se nao, a chave fica na lista de pendentes ate o
   * XML chegar (a lista e um LEFT JOIN, entao some sozinha na importacao).
   */
  async register(raw: string) {
    const digits = digitsOnly(raw);
    if (digits.length !== 44) {
      const plural = digits.length === 1 ? "dígito" : "dígitos";
      throw new DomainError(
        "O código lido tem " + digits.length + " " + plural +
          " e a chave de acesso tem 44. Bipe o código de barras comprido do DANFE, o que fica no alto da nota.",
      );
    }
    const key = parseAccessKey(digits)!;
    if (!key.valid) {
      throw new DomainError(
        "Os 44 dígitos vieram, mas o dígito verificador não confere — normalmente é leitura incompleta. Bipe de novo, mais devagar.",
      );
    }

    const note = await scannedNoteKeyRepository.findNote(digits);
    if (note) return { status: "importada" as const, key, note };

    await scannedNoteKeyRepository.save(digits);
    return { status: "pendente" as const, key, note: null };
  },

  async listPending() {
    const rows = await scannedNoteKeyRepository.listPending();
    return rows.map((row) => ({ ...row, key: parseAccessKey(row.accessKey) }));
  },

  forget(raw: string) {
    return scannedNoteKeyRepository.remove(digitsOnly(raw));
  },
};
