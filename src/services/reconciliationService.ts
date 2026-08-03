import { prisma } from "@/lib/prisma";
import { reconciliationMatchRepository } from "@/repositories/reconciliationMatchRepository";
import { matchEntriesToTransactions } from "@/matching/reconciliationMatcher";
import { NotFoundError, DomainError } from "@/domain/errors";

export const reconciliationService = {
  async runMatching() {
    const [entries, transactions] = await Promise.all([
      reconciliationMatchRepository.findUnmatchedEntries(),
      reconciliationMatchRepository.findUnmatchedTransactions(),
    ]);

    const candidates = matchEntriesToTransactions(
      entries.map((e) => ({
        id: e.id,
        type: e.type,
        amount: e.amount.toString(),
        dueDate: e.dueDate,
        counterpartyName: e.counterparty?.name,
        counterpartyDocument: e.counterparty?.document,
      })),
      transactions.map((t) => ({
        id: t.id,
        trnType: t.trnType,
        amount: t.amount.toString(),
        postedAt: t.postedAt,
        parsedDocument: t.parsedDocument,
        parsedCounterpartyName: t.parsedCounterpartyName,
      })),
    );

    for (const candidate of candidates) {
      await reconciliationMatchRepository.upsertSuggested(
        candidate.importedTransactionId,
        candidate.entryId,
        candidate.score,
        candidate.reasons,
      );
    }

    return { suggested: candidates.length };
  },

  list() {
    // A tela só exibe sugestões pendentes — matches já confirmados/rejeitados
    // nunca aparecem ali, então não vale a pena trazê-los (a lista só cresce).
    return reconciliationMatchRepository.findMany({ status: "SUGGESTED" });
  },

  listUnmatchedTransactions() {
    return reconciliationMatchRepository.findUnmatchedTransactions();
  },

  async confirmMatch(id: string) {
    const match = await reconciliationMatchRepository.findById(id);
    if (!match) throw new NotFoundError("Sugestão de conciliação", id);
    if (match.status !== "SUGGESTED") {
      throw new DomainError(`Sugestão já está com status ${match.status}.`);
    }
    if (!match.entryId) {
      throw new DomainError("Sugestão sem lançamento vinculado.");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.reconciliationMatch.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });

      // Se o lançamento ainda não tem contraparte, tenta reconhecer pelo
      // CPF/CNPJ do Pix — assim, cadastrar o fornecedor/cliente uma vez só
      // já vale pros pagamentos/recebimentos seguintes dele.
      const document = match.importedTransaction.parsedDocument;
      const counterparty =
        !match.entry?.counterpartyId && document
          ? await tx.counterparty.findUnique({ where: { document } })
          : null;

      await tx.entry.update({
        where: { id: match.entryId! },
        data: {
          status: "PAID",
          paidAt: match.importedTransaction.postedAt,
          paidAmount: match.importedTransaction.amount.abs(),
          bankAccountId: match.importedTransaction.bankAccountId,
          ...(counterparty ? { counterpartyId: counterparty.id } : {}),
        },
      });

      return updated;
    });
  },

  async rejectMatch(id: string) {
    const match = await reconciliationMatchRepository.findById(id);
    if (!match) throw new NotFoundError("Sugestão de conciliação", id);
    if (match.status !== "SUGGESTED") {
      throw new DomainError(`Sugestão já está com status ${match.status}.`);
    }

    return reconciliationMatchRepository.update(id, {
      status: "REJECTED",
      entryId: null,
    });
  },

  async createEntryFromTransaction(importedTransactionId: string, categoryId?: string) {
    const transaction = await prisma.importedTransaction.findUnique({
      where: { id: importedTransactionId },
    });
    if (!transaction) throw new NotFoundError("Transação importada", importedTransactionId);

    return prisma.$transaction(async (tx) => {
      // Reconhece a contraparte pelo CPF/CNPJ do Pix, se já estiver
      // cadastrada — evita ter que escolher na mão toda vez que o mesmo
      // fornecedor/cliente aparecer num extrato novo.
      const counterparty = transaction.parsedDocument
        ? await tx.counterparty.findUnique({ where: { document: transaction.parsedDocument } })
        : null;

      const entry = await tx.entry.create({
        data: {
          type: transaction.trnType === "DEBIT" ? "PAYABLE" : "RECEIVABLE",
          description: transaction.parsedCounterpartyName || transaction.memo,
          amount: transaction.amount.abs(),
          dueDate: transaction.postedAt,
          status: "PAID",
          paidAt: transaction.postedAt,
          paidAmount: transaction.amount.abs(),
          bankAccountId: transaction.bankAccountId,
          categoryId: categoryId || undefined,
          counterpartyId: counterparty?.id,
        },
      });

      const match = await tx.reconciliationMatch.upsert({
        where: { importedTransactionId },
        create: {
          importedTransactionId,
          entryId: entry.id,
          status: "CONFIRMED",
          matchScore: 1,
          matchReasons: ["manual_entry"],
          confirmedAt: new Date(),
        },
        update: {
          entryId: entry.id,
          status: "CONFIRMED",
          matchScore: 1,
          matchReasons: ["manual_entry"],
          confirmedAt: new Date(),
        },
      });

      return { entry, match };
    });
  },

  async createEntriesFromTransactions(items: { transactionId: string; categoryId?: string }[]) {
    const BATCH_SIZE = 10;
    let created = 0;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((item) => this.createEntryFromTransaction(item.transactionId, item.categoryId)),
      );
      created += batch.length;
    }
    return { created };
  },
};
