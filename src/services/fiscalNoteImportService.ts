import { prisma } from "@/lib/prisma";
import { parseNfeXml } from "@/parsers/nfe/nfeParser";
import { classifyDirection } from "@/domain/fiscalNotes";
import { fiscalNoteRepository, type NoteToSave } from "@/repositories/fiscalNoteRepository";

export type XmlFile = { name: string; content: string };

export type ImportFiscalNotesResult = {
  files: number;
  newNotes: number;
  /** Notas que já estavam no sistema e foram regravadas. */
  updatedNotes: number;
  cancellations: number;
  ignored: { reason: string; count: number; example: string }[];
};

export const fiscalNoteImportService = {
  /**
   * Recebe um lote de XMLs já em texto (o navegador abre o .zip — ver
   * `src/lib/zipReader.ts`). Arquivo repetido no mesmo lote, como o
   * "nota (1).xml" que o navegador cria ao baixar duas vezes, vira uma nota só.
   */
  async importXmlFiles(files: XmlFile[]): Promise<ImportFiscalNotesResult> {
    const notes = new Map<string, NoteToSave>();
    const cancellations = new Map<string, Date>();
    const ignored = new Map<string, { count: number; example: string }>();

    const ignore = (reason: string, fileName: string) => {
      const entry = ignored.get(reason);
      if (entry) entry.count += 1;
      else ignored.set(reason, { count: 1, example: fileName });
    };

    for (const file of files) {
      const parsed = parseNfeXml(file.content);
      if (parsed.kind === "ignored") {
        ignore(parsed.reason, file.name);
        continue;
      }
      if (parsed.kind === "cancellation") {
        cancellations.set(parsed.accessKey, parsed.cancelledAt);
        continue;
      }
      const direction = classifyDirection(parsed.note);
      if (!direction) {
        ignore("nota em que a Holm não é emitente nem destinatária", file.name);
        continue;
      }
      notes.set(parsed.note.accessKey, { ...parsed.note, direction });
    }

    const list = [...notes.values()];
    const existing = await prisma.$transaction(
      async (tx) => {
        const found = await fiscalNoteRepository.findExistingKeys(
          list.map((n) => n.accessKey),
          tx,
        );
        await fiscalNoteRepository.replaceMany(list, tx);
        await fiscalNoteRepository.recordCancellations(
          [...cancellations].map(([accessKey, cancelledAt]) => ({ accessKey, cancelledAt })),
          tx,
        );
        return found;
      },
      { timeout: 120_000 },
    );

    return {
      files: files.length,
      newNotes: list.length - existing.size,
      updatedNotes: existing.size,
      cancellations: cancellations.size,
      ignored: [...ignored].map(([reason, e]) => ({ reason, count: e.count, example: e.example })),
    };
  },
};
