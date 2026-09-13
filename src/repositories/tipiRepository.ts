import { prisma } from "@/lib/prisma";
import type { TipiEntry } from "@/parsers/tipi/tipiParser";

export type TipiInfo = { rate: string; numericRate: number | null; description: string };

const CHUNK = 2000;

export const tipiRepository = {
  /**
   * Troca a tabela inteira pela nova versão. A TIPI é publicada completa a
   * cada atualização, então não há o que mesclar: sai a antiga, entra a nova.
   *
   * Transação em lote, e não interativa: a interativa precisa reservar uma
   * conexão em até 2 segundos, e com a tela inicial carregando ao mesmo tempo
   * ela não conseguia ("Unable to start a transaction in the given time").
   * O lote continua tudo-ou-nada.
   */
  async replaceAll(entries: TipiEntry[], version: string | null) {
    const data = entries.map((e) => ({
      ncm: e.ncm,
      description: e.description,
      rate: e.rate,
      numericRate: e.numericRate,
      version,
    }));
    const inserts = [];
    for (let i = 0; i < data.length; i += CHUNK) {
      inserts.push(prisma.tipiRate.createMany({ data: data.slice(i, i + CHUNK) }));
    }
    await prisma.$transaction([prisma.tipiRate.deleteMany({}), ...inserts]);
  },

  async findByNcms(ncms: string[]): Promise<Map<string, TipiInfo>> {
    if (ncms.length === 0) return new Map();
    const rows = await prisma.tipiRate.findMany({ where: { ncm: { in: ncms } } });
    return new Map(
      rows.map((r) => [
        r.ncm,
        {
          rate: r.rate,
          numericRate: r.numericRate == null ? null : Number(r.numericRate),
          description: r.description,
        },
      ]),
    );
  },

  async getSummary() {
    const [count, latest] = await Promise.all([
      prisma.tipiRate.count(),
      prisma.tipiRate.findFirst({ orderBy: { importedAt: "desc" }, select: { version: true, importedAt: true } }),
    ]);
    return { count, version: latest?.version ?? null, importedAt: latest?.importedAt ?? null };
  },
};
