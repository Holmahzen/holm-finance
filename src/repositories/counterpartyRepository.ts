import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const counterpartyRepository = {
  findMany() {
    return prisma.counterparty.findMany({ orderBy: { name: "asc" } });
  },

  findById(id: string) {
    return prisma.counterparty.findUnique({ where: { id } });
  },

  findByDocument(document: string) {
    return prisma.counterparty.findUnique({ where: { document } });
  },

  /**
   * Busca várias contrapartes de uma vez, por CPF/CNPJ.
   *
   * Existe para a importação de extrato: ela precisa saber, para cada Pix, se
   * a contraparte já está cadastrada. Fazendo `findByDocument` por transação,
   * um extrato de cinco semanas dispara centenas de consultas simultâneas —
   * contra um Postgres remoto isso satura o pooler e estoura o tempo da
   * função. Uma consulta só resolve o mesmo.
   */
  findManyByDocuments(documents: string[]) {
    if (documents.length === 0) return Promise.resolve([]);
    return prisma.counterparty.findMany({
      where: { document: { in: [...new Set(documents)] } },
    });
  },

  create(data: Prisma.CounterpartyUncheckedCreateInput) {
    return prisma.counterparty.create({ data });
  },

  update(id: string, data: Prisma.CounterpartyUncheckedUpdateInput) {
    return prisma.counterparty.update({ where: { id }, data });
  },
};
