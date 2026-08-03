import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { parseExcel } from "@/parsers/excel/excelParser";
import { accountRepository } from "@/repositories/accountRepository";
import { importBatchRepository } from "@/repositories/importBatchRepository";
import { importedTransactionRepository } from "@/repositories/importedTransactionRepository";
import { NotFoundError, DomainError } from "@/domain/errors";
import type { Prisma } from "@/generated/prisma/client";

export type ImportExcelResult = {
  batchId: string;
  alreadyImported: boolean;
  format: "mercado_pago" | "generic";
  totalTransactions: number;
  newTransactions: number;
  duplicateTransactions: number;
};

export const excelImportService = {
  async importFile(
    bankAccountId: string,
    fileName: string,
    buffer: Buffer,
  ): Promise<ImportExcelResult> {
    const account = await accountRepository.findById(bankAccountId);
    if (!account) throw new NotFoundError("Conta", bankAccountId);

    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    const existingBatch = await importBatchRepository.findByHash(bankAccountId, fileHash);
    if (existingBatch) {
      return {
        batchId: existingBatch.id,
        alreadyImported: true,
        format: "generic",
        totalTransactions: existingBatch.transactionCount,
        newTransactions: 0,
        duplicateTransactions: existingBatch.transactionCount,
      };
    }

    let statement: ReturnType<typeof parseExcel>;
    try {
      statement = parseExcel(buffer);
    } catch (err) {
      throw new DomainError(err instanceof Error ? err.message : "Falha ao ler a planilha.");
    }

    if (statement.transactions.length === 0) {
      throw new DomainError("Nenhuma transação reconhecida na planilha.");
    }

    const dates = statement.transactions.map((t) => t.postedAt.getTime());
    const startDate = new Date(Math.min(...dates));
    const endDate = new Date(Math.max(...dates));

    const rows: Prisma.ImportedTransactionUncheckedCreateInput[] = statement.transactions.map(
      (t) => ({
        bankAccountId,
        importBatchId: "",
        fitId: t.externalId,
        trnType: t.trnType,
        postedAt: t.postedAt,
        amount: t.amount,
        memo: t.memo,
        parsedKind: "OTHER",
        parsedCounterpartyName: t.counterpartyName,
        isSelfTransfer: false,
      }),
    );

    const result = await prisma.$transaction(async (tx) => {
      const batch = await importBatchRepository.create(
        {
          bankAccountId,
          source: "XLSX",
          fileName,
          fileHash,
          startDate,
          endDate,
          transactionCount: statement.transactions.length,
        },
        tx,
      );

      const createResult = await importedTransactionRepository.createMany(
        rows.map((r) => ({ ...r, importBatchId: batch.id })),
        tx,
      );

      return { batch, newCount: createResult.count };
    });

    return {
      batchId: result.batch.id,
      alreadyImported: false,
      format: statement.format,
      totalTransactions: statement.transactions.length,
      newTransactions: result.newCount,
      duplicateTransactions: statement.transactions.length - result.newCount,
    };
  },
};
