import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { parseOfx } from "@/parsers/ofx/ofxParser";
import { parseMemo } from "@/parsers/ofx/memoPatterns";
import { accountRepository } from "@/repositories/accountRepository";
import { counterpartyRepository } from "@/repositories/counterpartyRepository";
import { importBatchRepository } from "@/repositories/importBatchRepository";
import { importedTransactionRepository } from "@/repositories/importedTransactionRepository";
import { reconciliationService } from "@/services/reconciliationService";
import { NotFoundError, DomainError } from "@/domain/errors";
import type { Prisma } from "@/generated/prisma/client";

export type ImportOfxResult = {
  batchId: string;
  alreadyImported: boolean;
  totalTransactions: number;
  newTransactions: number;
  duplicateTransactions: number;
  balanceCheck: {
    expectedDelta: string | null;
    actualDelta: string;
    matches: boolean | null;
  };
};

export const ofxImportService = {
  async importFile(
    bankAccountId: string,
    fileName: string,
    buffer: Buffer,
  ): Promise<ImportOfxResult> {
    const account = await accountRepository.findById(bankAccountId);
    if (!account) throw new NotFoundError("Conta", bankAccountId);

    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    const existingBatch = await importBatchRepository.findByHash(bankAccountId, fileHash);
    if (existingBatch) {
      return {
        batchId: existingBatch.id,
        alreadyImported: true,
        totalTransactions: existingBatch.transactionCount,
        newTransactions: 0,
        duplicateTransactions: existingBatch.transactionCount,
        balanceCheck: { expectedDelta: null, actualDelta: "0", matches: null },
      };
    }

    const statement = parseOfx(buffer);
    if (statement.bankId !== account.bankId || statement.acctId !== account.acctId) {
      throw new DomainError(
        `O extrato pertence à conta ${statement.bankId}/${statement.acctId}, diferente da conta selecionada.`,
      );
    }

    const previousBatch = await importBatchRepository.findLatestByAccount(bankAccountId);
    const actualDelta = statement.transactions
      .reduce((acc, t) => acc + Number(t.amount), 0)
      .toFixed(2);
    const expectedDelta = previousBatch?.ledgerBalance
      ? (Number(statement.ledgerBalance) - Number(previousBatch.ledgerBalance)).toFixed(2)
      : null;

    const enrichedTransactions: Prisma.ImportedTransactionUncheckedCreateInput[] =
      await Promise.all(
        statement.transactions.map(async (t) => {
          const parsedMemo = parseMemo(t.memo);
          let parsedDocument: string | undefined;
          let parsedCounterpartyName: string | undefined;
          let parsedCity: string | undefined;
          let isSelfTransfer = false;

          if (parsedMemo.kind === "PIX_DEBIT" || parsedMemo.kind === "PIX_CREDIT") {
            parsedDocument = parsedMemo.document;
            parsedCounterpartyName = parsedMemo.name;
            const counterparty = await counterpartyRepository.findByDocument(
              parsedMemo.document,
            );
            isSelfTransfer = counterparty?.isOwnEntity ?? false;
          } else if (parsedMemo.kind === "CARD_PURCHASE") {
            parsedCounterpartyName = parsedMemo.name;
            parsedCity = parsedMemo.city;
          }

          return {
            bankAccountId,
            importBatchId: "", // filled in after batch creation
            fitId: t.fitId,
            trnType: t.trnType,
            postedAt: t.postedAt,
            amount: t.amount,
            memo: t.memo,
            parsedKind: parsedMemo.kind,
            parsedDocument,
            parsedCounterpartyName,
            parsedCity,
            isSelfTransfer,
          };
        }),
      );

    const result = await prisma.$transaction(async (tx) => {
      const batch = await importBatchRepository.create(
        {
          bankAccountId,
          source: "OFX",
          fileName,
          fileHash,
          startDate: statement.dtStart,
          endDate: statement.dtEnd,
          ledgerBalance: statement.ledgerBalance,
          ledgerBalanceDate: statement.ledgerBalanceDate,
          transactionCount: statement.transactions.length,
        },
        tx,
      );

      const createResult = await importedTransactionRepository.createMany(
        enrichedTransactions.map((t) => ({ ...t, importBatchId: batch.id })),
        tx,
      );

      return { batch, newCount: createResult.count };
    });

    // Roda a conciliação automática assim que o extrato entra — assim as
    // sugestões de vínculo com lançamentos já pendentes aparecem prontas
    // antes de alguém ir direto em "Transações sem par" e criar um
    // lançamento novo duplicado sem perceber que já existia um pendente.
    await reconciliationService.runMatching();

    return {
      batchId: result.batch.id,
      alreadyImported: false,
      totalTransactions: statement.transactions.length,
      newTransactions: result.newCount,
      duplicateTransactions: statement.transactions.length - result.newCount,
      balanceCheck: {
        expectedDelta,
        actualDelta,
        matches: expectedDelta === null ? null : expectedDelta === actualDelta,
      },
    };
  },
};
