import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ParsedFiscalNote } from "@/parsers/nfe/nfeParser";
import type { FiscalItemRow, FiscalNoteDirection } from "@/domain/fiscalNotes";

export type NoteToSave = ParsedFiscalNote & { direction: FiscalNoteDirection };

/** Um .zip do Tiny tem milhares de notas; `IN (...)` e createMany vão em partes. */
const CHUNK = 500;

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function noteData(n: NoteToSave) {
  return {
    accessKey: n.accessKey,
    direction: n.direction,
    purpose: n.purpose,
    operationType: n.operationType,
    natureOfOperation: n.natureOfOperation,
    number: n.number,
    series: n.series,
    issuedAt: n.issuedAt,
    issueMonth: n.issueMonth,
    issuerDocument: n.issuerDocument,
    issuerName: n.issuerName,
    issuerUf: n.issuerUf,
    issuerCrt: n.issuerCrt,
    recipientDocument: n.recipientDocument,
    recipientName: n.recipientName,
    recipientUf: n.recipientUf,
    finalConsumer: n.finalConsumer,
    intermediaryDocument: n.intermediaryDocument,
    productsTotal: round2(n.productsTotal),
    discountTotal: round2(n.discountTotal),
    freightTotal: round2(n.freightTotal),
    otherTotal: round2(n.otherTotal),
    total: round2(n.total),
    icmsTotal: round2(n.icmsTotal),
    icmsStTotal: round2(n.icmsStTotal),
    ipiTotal: round2(n.ipiTotal),
    pisTotal: round2(n.pisTotal),
    cofinsTotal: round2(n.cofinsTotal),
    difalTotal: round2(n.difalTotal),
    simplesCreditTotal: round2(n.simplesCreditTotal),
    referencedKeys: n.referencedKeys,
  } satisfies Prisma.FiscalNoteCreateManyInput;
}

export const fiscalNoteRepository = {
  async findExistingKeys(keys: string[], tx?: Prisma.TransactionClient): Promise<Set<string>> {
    const client = tx ?? prisma;
    const found = new Set<string>();
    for (const part of chunks(keys)) {
      const rows = await client.fiscalNote.findMany({
        where: { accessKey: { in: part } },
        select: { accessKey: true },
      });
      for (const r of rows) found.add(r.accessKey);
    }
    return found;
  },

  /**
   * Regrava as notas pela chave de acesso: apaga a versão anterior (os itens
   * vão junto, em cascata) e cria de novo. Nota autorizada não muda, então
   * reimportar só serve pra aproveitar melhorias na leitura do XML — e o
   * cancelamento, que fica em tabela própria, é reaplicado logo depois.
   */
  async replaceMany(notes: NoteToSave[], tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    for (const part of chunks(notes)) {
      await client.fiscalNote.deleteMany({ where: { accessKey: { in: part.map((n) => n.accessKey) } } });
      const created = await client.fiscalNote.createManyAndReturn({
        data: part.map(noteData),
        select: { id: true, accessKey: true },
      });
      const idByKey = new Map(created.map((c) => [c.accessKey, c.id]));
      const items = part.flatMap((n) =>
        n.items.map(
          (i) =>
            ({
              noteId: idByKey.get(n.accessKey)!,
              itemNumber: i.itemNumber,
              productCode: i.productCode,
              description: i.description,
              ncm: i.ncm,
              cfop: i.cfop,
              quantity: i.quantity,
              grossValue: round2(i.grossValue),
              discount: round2(i.discount),
              netValue: round2(i.netValue),
              icmsCode: i.icmsCode,
              icmsBase: round2(i.icmsBase),
              icmsRate: i.icmsRate,
              icmsValue: round2(i.icmsValue),
              simplesCreditValue: round2(i.simplesCreditValue),
            }) satisfies Prisma.FiscalNoteItemCreateManyInput,
        ),
      );
      for (const itemPart of chunks(items, 2000)) {
        await client.fiscalNoteItem.createMany({ data: itemPart });
      }
    }
  },

  /**
   * Guarda os cancelamentos novos e aplica todos os guardados às notas que
   * ainda não estavam marcadas — inclusive notas importadas agora cujo
   * cancelamento tinha vindo num .zip anterior.
   */
  async recordCancellations(
    list: { accessKey: string; cancelledAt: Date }[],
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? prisma;
    for (const part of chunks(list)) {
      await client.fiscalNoteCancellation.createMany({ data: part, skipDuplicates: true });
    }
    await client.$executeRaw`
      UPDATE "fiscal_notes" n
      SET "cancelledAt" = c."cancelledAt"
      FROM "fiscal_note_cancellations" c
      WHERE n."accessKey" = c."accessKey" AND n."cancelledAt" IS NULL`;
  },

  /** Uma linha por item, já com os campos da nota — base de todos os resumos. */
  findRowsSince(fromMonth: string): Promise<FiscalItemRow[]> {
    return prisma.$queryRaw<FiscalItemRow[]>`
      SELECT
        n."id" AS "noteId",
        n."issueMonth",
        n."direction"::text AS "direction",
        n."purpose",
        (n."cancelledAt" IS NOT NULL) AS "cancelled",
        n."recipientUf",
        n."intermediaryDocument",
        n."issuerDocument",
        n."issuerName",
        n."issuerCrt",
        i."ncm",
        i."description",
        i."cfop",
        i."netValue"::float8 AS "netValue",
        i."icmsCode",
        i."icmsValue"::float8 AS "icmsValue",
        i."simplesCreditValue"::float8 AS "simplesCreditValue"
      FROM "fiscal_note_items" i
      JOIN "fiscal_notes" n ON n."id" = i."noteId"
      WHERE n."issueMonth" >= ${fromMonth}`;
  },

  async getImportSummary() {
    const [noteCount, aggregate] = await Promise.all([
      prisma.fiscalNote.count(),
      prisma.fiscalNote.aggregate({ _max: { importedAt: true } }),
    ]);
    return { noteCount, lastImportedAt: aggregate._max.importedAt };
  },
};
