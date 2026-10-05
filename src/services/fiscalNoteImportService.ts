import { prisma } from "@/lib/prisma";
import { parseNfeXml } from "@/parsers/nfe/nfeParser";
import { isBarueriNfseXml } from "@/parsers/nfse/barueriNfseXmlParser";
import { mlServiceImportService } from "@/services/mlServiceImportService";
import { classifyDirection } from "@/domain/fiscalNotes";
import { fiscalNoteRepository, type NoteToSave } from "@/repositories/fiscalNoteRepository";

export type XmlFile = { name: string; content: string };

export type ImportFiscalNotesResult = {
  files: number;
  newNotes: number;
  /** Notas que já estavam no sistema e foram regravadas. */
  updatedNotes: number;
  cancellations: number;
  /** Notas de serviço de Barueri (frete do Flex) que vieram em XML junto com as NF-e. */
  serviceNotes: { newInvoices: number; existingInvoices: number };
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

    // XML de NFS-e de Barueri (frete do Flex) não é NF-e: vai pro módulo de
    // notas de serviço do Mercado Livre/transportadora.
    const barueriFiles = files.filter((f) => isBarueriNfseXml(f.content));
    let serviceNotes = { newInvoices: 0, existingInvoices: 0 };
    if (barueriFiles.length > 0) {
      const result = await mlServiceImportService.importBarueriXmlFiles(barueriFiles);
      serviceNotes = { newInvoices: result.newInvoices, existingInvoices: result.existingInvoices };
      for (const i of result.ignored) {
        const entry = ignored.get(i.reason);
        if (entry) entry.count += i.count;
        else ignored.set(i.reason, { count: i.count, example: i.example });
      }
    }

    for (const file of files) {
      if (isBarueriNfseXml(file.content)) continue;
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
      serviceNotes,
      ignored: [...ignored].map(([reason, e]) => ({ reason, count: e.count, example: e.example })),
    };
  },
};
