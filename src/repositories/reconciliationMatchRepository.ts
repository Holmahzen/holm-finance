import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const reconciliationMatchRepository = {
  findMany(where?: Prisma.ReconciliationMatchWhereInput) {
    return prisma.reconciliationMatch.findMany({
      where,
      include: {
        importedTransaction: true,
        entry: { include: { category: true, counterparty: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  findById(id: string) {
    return prisma.reconciliationMatch.findUnique({
      where: { id },
      include: { importedTransaction: true, entry: true },
    });
  },

  upsertSuggested(
    importedTransactionId: string,
    entryId: string,
    matchScore: number,
    matchReasons: string[],
  ) {
    return prisma.reconciliationMatch.upsert({
      where: { importedTransactionId },
      create: {
        importedTransactionId,
        entryId,
        matchScore,
        matchReasons,
        status: "SUGGESTED",
      },
      update: { entryId, matchScore, matchReasons, status: "SUGGESTED" },
    });
  },

  update(id: string, data: Prisma.ReconciliationMatchUncheckedUpdateInput) {
    return prisma.reconciliationMatch.update({ where: { id }, data });
  },

  findUnmatchedEntries(type?: "PAYABLE" | "RECEIVABLE") {
    return prisma.entry.findMany({
      where: {
        status: "PENDING",
        reconciliationMatch: null,
        ...(type ? { type } : {}),
      },
      include: { counterparty: true },
    });
  },

  /**
   * `importBatchId` restringe a busca a um lote recém-importado.
   *
   * Sem ele, a varredura pega TODA transação sem conciliação desde sempre — o
   * que é o certo quando a analista pede a conciliação na tela, mas caro
   * demais para rodar dentro da importação, que ainda tem o limite de tempo da
   * função do servidor para respeitar.
   */
  /**
   * Sem limite, isso já devolveu 6,5 MB numa conta com extrato grande (o CSV
   * do Mercado Pago tem milhares de linhas) — o navegador travava tentando
   * desenhar uma tabela com uma dessas por linha. `limit`/`offset` paginam;
   * o total vem à parte pra tela saber quanto ainda falta sem carregar tudo.
   */
  findUnmatchedTransactions(opts: {
    importBatchId?: string;
    bankAccountId?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const where = {
      OR: [{ reconciliationMatch: null }, { reconciliationMatch: { status: "REJECTED" as const } }],
      ...(opts.importBatchId ? { importBatchId: opts.importBatchId } : {}),
      ...(opts.bankAccountId ? { bankAccountId: opts.bankAccountId } : {}),
    };
    return prisma.importedTransaction.findMany({
      where,
      include: { bankAccount: true },
      orderBy: { postedAt: "asc" },
      take: opts.limit,
      skip: opts.offset,
    });
  },

  countUnmatchedTransactions(opts: { importBatchId?: string; bankAccountId?: string } = {}) {
    return prisma.importedTransaction.count({
      where: {
        OR: [{ reconciliationMatch: null }, { reconciliationMatch: { status: "REJECTED" as const } }],
        ...(opts.importBatchId ? { importBatchId: opts.importBatchId } : {}),
        ...(opts.bankAccountId ? { bankAccountId: opts.bankAccountId } : {}),
      },
    });
  },

  findAllRejectedPairs() {
    return prisma.rejectedMatchPair.findMany({
      select: { entryId: true, importedTransactionId: true },
    });
  },

  recordRejectedPair(importedTransactionId: string, entryId: string) {
    return prisma.rejectedMatchPair.upsert({
      where: { importedTransactionId_entryId: { importedTransactionId, entryId } },
      create: { importedTransactionId, entryId },
      update: {},
    });
  },
};
