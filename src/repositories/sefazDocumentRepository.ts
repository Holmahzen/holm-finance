import { prisma } from "@/lib/prisma";
import type { SefazDocument } from "@/domain/sefazDistribution";

const STATE_ID = "default";

export const sefazDocumentRepository = {
  async getState() {
    return (
      (await prisma.sefazDistributionState.findUnique({ where: { id: STATE_ID } })) ?? {
        id: STATE_ID,
        lastNsu: "0",
        maxNsu: null,
        lastRunAt: null,
        lastStatus: null,
        lastMessage: null,
      }
    );
  },

  saveState(state: { lastNsu: string; maxNsu: string | null; lastStatus: string; lastMessage: string }) {
    const data = { ...state, lastRunAt: new Date() };
    return prisma.sefazDistributionState.upsert({
      where: { id: STATE_ID },
      update: data,
      create: { id: STATE_ID, ...data },
    });
  },

  /** Grava só o que ainda não veio; o mesmo NSU nunca muda de conteúdo. */
  async saveDocuments(documents: SefazDocument[]) {
    if (documents.length === 0) return 0;
    const result = await prisma.sefazDocument.createMany({
      data: documents.map((d) => ({
        nsu: d.nsu,
        schema: d.schema,
        kind: d.kind,
        accessKey: d.accessKey,
        issuerDocument: d.issuerDocument,
        issuerName: d.issuerName,
        issuedAt: d.issuedAt,
        total: d.total,
        situation: d.situation,
        xml: d.xml,
      })),
      skipDuplicates: true,
    });
    return result.count;
  },

  /** Notas inteiras que a Receita já entregou e ainda não viraram nota no sistema. */
  findFullNotesToImport(limit = 200) {
    return prisma.sefazDocument.findMany({
      where: { kind: "nota", imported: false },
      orderBy: { nsu: "asc" },
      take: limit,
    });
  },

  markImported(nsus: string[]) {
    return prisma.sefazDocument.updateMany({ where: { nsu: { in: nsus } }, data: { imported: true } });
  },

  /**
   * Resumos de notas de fornecedor que ainda não têm o XML completo no
   * sistema. É a lista do que falta pedir (ou manifestar) para ter a nota
   * inteira, com itens e impostos.
   */
  listPendingSummaries(): Promise<
    { nsu: string; accessKey: string | null; issuerName: string | null; issuerDocument: string | null; issuedAt: Date | null; total: unknown; situation: string | null }[]
  > {
    return prisma.$queryRaw`
      SELECT d."nsu", d."accessKey", d."issuerName", d."issuerDocument", d."issuedAt", d."total", d."situation"
      FROM "sefaz_documents" d
      LEFT JOIN "fiscal_notes" n ON n."accessKey" = d."accessKey"
      WHERE d."kind" = 'resumo' AND n."id" IS NULL
      ORDER BY d."issuedAt" DESC NULLS LAST
      LIMIT 500`;
  },

  async counts() {
    const rows = await prisma.sefazDocument.groupBy({ by: ["kind"], _count: { _all: true } });
    return Object.fromEntries(rows.map((r) => [r.kind, r._count._all])) as Record<string, number>;
  },
};
