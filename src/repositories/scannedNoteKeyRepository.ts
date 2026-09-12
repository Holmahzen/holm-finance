import { prisma } from "@/lib/prisma";

export const scannedNoteKeyRepository = {
  async findNote(accessKey: string) {
    const note = await prisma.fiscalNote.findUnique({
      where: { accessKey },
      select: {
        issuerName: true,
        issuerDocument: true,
        issuedAt: true,
        total: true,
        direction: true,
        cancelledAt: true,
      },
    });
    return note ? { ...note, total: Number(note.total) } : null;
  },

  /** Guarda a chave bipada; bipar de novo nao duplica nem apaga a data original. */
  save(accessKey: string) {
    return prisma.scannedNoteKey.upsert({ where: { accessKey }, update: {}, create: { accessKey } });
  },

  remove(accessKey: string) {
    return prisma.scannedNoteKey.deleteMany({ where: { accessKey } });
  },

  /** So as chaves bipadas que ainda nao tem o XML importado. */
  listPending(): Promise<{ accessKey: string; scannedAt: Date }[]> {
    return prisma.$queryRaw`
      SELECT s."accessKey", s."scannedAt"
      FROM "scanned_note_keys" s
      LEFT JOIN "fiscal_notes" n ON n."accessKey" = s."accessKey"
      WHERE n."id" IS NULL
      ORDER BY s."scannedAt" DESC`;
  },
};
